import { prisma } from '../db/prisma.js';
import type {
  NodeExecutionContext,
  NodeExecutionResult,
  NodeHandler,
  NodeKind,
} from '@n8npro/shared';

// ─── Node Handler Registry ───────────────────────────────────────────────────

const handlers = new Map<NodeKind, NodeHandler>();

export function registerHandler(handler: NodeHandler): void {
  handlers.set(handler.kind, handler);
}

export function getHandler(kind: NodeKind): NodeHandler | undefined {
  return handlers.get(kind);
}

// ─── Topological Sort ───────────────────────────────────────────────────────

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

// ─── Main Executor ───────────────────────────────────────────────────────────

export async function runExecution(executionId: string): Promise<void> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: { nodes: true, edges: true },
      },
    },
  });

  if (!execution) {
    console.error(`[executor] Execution ${executionId} not found`);
    return;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'running', startedAt: new Date() },
  });

  const { nodes, edges } = execution.workflow;

  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.kind as NodeKind,
    config: JSON.parse(n.config) as Record<string, unknown>,
  }));

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
  }));

  const sorted = topologicalSort(graphNodes, graphEdges);

  // Track outputs by nodeId
  const outputs = new Map<string, unknown>();

  // Parse trigger payload
  const triggerPayload = execution.triggerPayload
    ? (JSON.parse(execution.triggerPayload) as Record<string, unknown>)
    : {};

  let executionError: string | undefined;

  for (const node of sorted) {
    // Skip trigger nodes unless they carry initial data
    if (node.kind === 'manual_trigger' || node.kind === 'cron_trigger' || node.kind === 'webhook_trigger') {
      outputs.set(node.id, triggerPayload);
      continue;
    }

    // Build inputs from predecessor outputs
    const predecessorEdges = graphEdges.filter((e) => e.targetNodeId === node.id);
    const inputs: Record<string, unknown> = {};
    for (const e of predecessorEdges) {
      inputs[e.sourceNodeId] = outputs.get(e.sourceNodeId);
    }

    // Create a step record
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

    const handler = getHandler(node.kind);
    if (!handler) {
      await prisma.executionStep.update({
        where: { id: step.id },
        data: {
          status: 'error',
          finishedAt: new Date(),
          error: `No handler registered for node kind "${node.kind}"`,
        },
      });
      executionError = `No handler for kind "${node.kind}"`;
      break;
    }

    const ctx: NodeExecutionContext = {
      nodeId: node.id,
      kind: node.kind,
      config: node.config,
      inputs,
    };

    const startTs = Date.now();
    let result: NodeExecutionResult;
    try {
      result = await handler.execute(ctx);
    } catch (err) {
      result = { output: null, error: String(err) };
    }

    const durationMs = Date.now() - startTs;
    const hasError = !!result.error;

    await prisma.executionStep.update({
      where: { id: step.id },
      data: {
        status: hasError ? 'error' : 'success',
        finishedAt: new Date(),
        output: JSON.stringify(result.output ?? null),
        error: result.error,
        durationMs,
      },
    });

    if (hasError) {
      executionError = result.error;
      break;
    }

    outputs.set(node.id, result.output);
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
