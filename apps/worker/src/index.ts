/**
 * Standalone worker process.
 *
 * In V0, the execution happens inline within the API process (via setImmediate).
 * This worker is the V1+ design: it consumes jobs from a BullMQ queue backed by Redis.
 *
 * To use: set REDIS_URL env var and ensure the API enqueues jobs via BullMQ.
 * The DATABASE_URL env var must point to the same database as the API.
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const QUEUE_NAME = 'workflow-executions';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Parse redis connection
const redisConnection = {
  host: new URL(redisUrl).hostname,
  port: parseInt(new URL(redisUrl).port || '6379', 10),
};

console.log(`[worker] Connecting to Redis at ${redisUrl}`);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { executionId } = job.data as { executionId: string };
    console.log(`[worker] Processing execution ${executionId}`);

    await runExecution(executionId);
  },
  { connection: redisConnection, concurrency: 5 }
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

// ─── Execution Logic (mirrors apps/api/src/services/executor.ts) ─────────────

type NodeKind = string;

interface GraphNode {
  id: string;
  kind: NodeKind;
  config: Record<string, unknown>;
}

interface GraphEdge {
  sourceNodeId: string;
  targetNodeId: string;
}

function topologicalSort(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }
  for (const e of edges) {
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) ?? 0) + 1);
    adjacency.get(e.sourceNodeId)?.push(e.targetNodeId);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const sorted: GraphNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id);
    if (node) sorted.push(node);
    for (const neighborId of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, newDeg);
      if (newDeg === 0) queue.push(neighborId);
    }
  }
  return sorted;
}

async function runExecution(executionId: string): Promise<void> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { workflow: { include: { nodes: true, edges: true } } },
  });

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'running', startedAt: new Date() },
  });

  const { nodes, edges } = execution.workflow;
  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    config: JSON.parse(n.config) as Record<string, unknown>,
  }));
  const graphEdges: GraphEdge[] = edges.map((e) => ({
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
  }));
  const sorted = topologicalSort(graphNodes, graphEdges);
  const outputs = new Map<string, unknown>();
  const triggerPayload = execution.triggerPayload
    ? (JSON.parse(execution.triggerPayload) as Record<string, unknown>)
    : {};

  let executionError: string | undefined;

  for (const node of sorted) {
    if (['manual_trigger', 'cron_trigger', 'webhook_trigger'].includes(node.kind)) {
      outputs.set(node.id, triggerPayload);
      continue;
    }

    const predecessorEdges = graphEdges.filter((e) => e.targetNodeId === node.id);
    const inputs: Record<string, unknown> = {};
    for (const e of predecessorEdges) {
      inputs[e.sourceNodeId] = outputs.get(e.sourceNodeId);
    }

    const step = await prisma.executionStep.create({
      data: {
        executionId,
        nodeId: node.id,
        nodeKind: node.kind,
        status: 'running',
        startedAt: new Date(),
        input: JSON.stringify(inputs),
      },
    });

    const startTs = Date.now();
    let output: unknown = null;
    let stepError: string | undefined;

    try {
      output = await executeNode(node, inputs);
    } catch (err) {
      stepError = String(err);
    }

    const durationMs = Date.now() - startTs;

    await prisma.executionStep.update({
      where: { id: step.id },
      data: {
        status: stepError ? 'error' : 'success',
        finishedAt: new Date(),
        output: JSON.stringify(output),
        error: stepError,
        durationMs,
      },
    });

    if (stepError) {
      executionError = stepError;
      break;
    }

    outputs.set(node.id, output);
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status: executionError ? 'error' : 'success',
      finishedAt: new Date(),
      error: executionError,
    },
  });
}

async function executeNode(
  node: GraphNode,
  inputs: Record<string, unknown>
): Promise<unknown> {
  const firstInput = () => {
    const vals = Object.values(inputs);
    return vals.length > 0 ? vals[0] : null;
  };

  switch (node.kind) {
    case 'manual_trigger':
    case 'cron_trigger':
    case 'webhook_trigger':
      return firstInput() ?? {};

    case 'output': {
      const vals = Object.values(inputs);
      return vals.length === 1 ? vals[0] : vals;
    }

    case 'transform': {
      const { expression } = node.config as { expression?: string };
      if (!expression) throw new Error('Transform node missing expression');
      const input = firstInput();
      // eslint-disable-next-line no-new-func
      const fn = new Function('input', `"use strict"; return (${expression})(input)`);
      return fn(input) as unknown;
    }

    case 'filter': {
      const { condition } = node.config as { condition?: string };
      if (!condition) throw new Error('Filter node missing condition');
      const input = firstInput();
      if (!Array.isArray(input)) throw new Error('Filter node requires an array input');
      // eslint-disable-next-line no-new-func
      const fn = new Function('item', `"use strict"; return (${condition})(item)`);
      return (input as unknown[]).filter((item) => fn(item) as boolean);
    }

    case 'aggregate': {
      const { operation = 'count', field, separator = ', ' } = node.config as {
        operation?: string;
        field?: string;
        separator?: string;
      };
      const input = firstInput();
      if (!Array.isArray(input)) throw new Error('Aggregate node requires an array input');
      const arr = input as unknown[];

      const numericValues = field
        ? arr.map((item) => {
            if (typeof item === 'object' && item !== null) {
              const v = (item as Record<string, unknown>)[field];
              return typeof v === 'number' ? v : parseFloat(String(v));
            }
            return parseFloat(String(item));
          })
        : arr.map((item) => (typeof item === 'number' ? item : parseFloat(String(item))));

      switch (operation) {
        case 'count': return arr.length;
        case 'sum': return numericValues.reduce((a, b) => a + b, 0);
        case 'average': return arr.length === 0 ? 0 : numericValues.reduce((a, b) => a + b, 0) / arr.length;
        case 'min': return arr.length === 0 ? null : Math.min(...numericValues);
        case 'max': return arr.length === 0 ? null : Math.max(...numericValues);
        case 'join': return arr.map(String).join(separator);
        case 'first': return arr[0] ?? null;
        case 'last': return arr[arr.length - 1] ?? null;
        default: return null;
      }
    }

    case 'code': {
      const { code } = node.config as { code?: string };
      if (!code) throw new Error('Code node requires a "code" config field');
      // eslint-disable-next-line no-new-func
      const fn = new Function('inputs', `"use strict"; ${code}`);
      return fn(inputs) as unknown;
    }

    case 'http_request': {
      const {
        url,
        method = 'GET',
        headers = {},
        body,
        responseType = 'json',
        timeoutMs = 10000,
      } = node.config as {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
        responseType?: string;
        timeoutMs?: number;
      };
      if (!url) throw new Error('HTTP Request node requires a "url" config field');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          signal: controller.signal,
        };
        if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const response = await fetch(url, fetchOptions);
        let data: unknown;
        if (responseType === 'json') {
          try { data = await response.json(); } catch { data = await response.text(); }
        } else {
          data = await response.text();
        }
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          ok: response.ok,
        };
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error(`HTTP request timed out after ${timeoutMs}ms: ${url}`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    default:
      throw new Error(`Worker: unhandled node kind "${node.kind}"`);
  }
}

export {};
