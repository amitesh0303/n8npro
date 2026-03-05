import { Router, type Router as ExpressRouter } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router: ExpressRouter = Router();

// POST /executions - trigger a workflow execution
router.post('/', requireAuth, async (req, res) => {
  try {
    const { workflowId, triggerPayload } = req.body as {
      workflowId?: string;
      triggerPayload?: Record<string, unknown>;
    };
    if (!workflowId) {
      res.status(400).json({ error: 'workflowId is required' });
      return;
    }

    // Verify access
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId } });
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workflow.workspaceId, userId: req.auth!.userId },
    });
    if (!member) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const execution = await prisma.execution.create({
      data: {
        workflowId,
        status: 'queued',
        triggerPayload: triggerPayload ? JSON.stringify(triggerPayload) : null,
      },
    });

    // Dispatch to worker queue (BullMQ or in-process for V0)
    await dispatchExecution(execution.id);

    res.status(202).json({ executionId: execution.id, status: execution.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /executions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const execution = await prisma.execution.findFirst({
      where: { id: req.params['id']! },
      include: { steps: { orderBy: { createdAt: 'asc' } } },
    });
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    res.json({ execution: serializeExecution(execution) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /executions?workflowId=xxx
router.get('/', requireAuth, async (req, res) => {
  try {
    const workflowId = req.query['workflowId'] as string | undefined;
    if (!workflowId) {
      res.status(400).json({ error: 'workflowId query param required' });
      return;
    }

    const executions = await prisma.execution.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { steps: { orderBy: { createdAt: 'asc' } } },
    });

    res.json({ executions: executions.map(serializeExecution) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ExecutionWithSteps = Awaited<ReturnType<typeof prisma.execution.findFirst>> & {
  steps: Awaited<ReturnType<typeof prisma.executionStep.findMany>>;
};

function serializeExecution(e: NonNullable<ExecutionWithSteps>) {
  return {
    id: e.id,
    workflowId: e.workflowId,
    status: e.status,
    startedAt: e.startedAt?.toISOString(),
    finishedAt: e.finishedAt?.toISOString(),
    error: e.error,
    triggerPayload: e.triggerPayload ? (JSON.parse(e.triggerPayload) as unknown) : undefined,
    createdAt: e.createdAt.toISOString(),
    steps: e.steps.map((s) => ({
      id: s.id,
      executionId: s.executionId,
      nodeId: s.nodeId,
      nodeKind: s.nodeKind,
      status: s.status,
      startedAt: s.startedAt?.toISOString(),
      finishedAt: s.finishedAt?.toISOString(),
      input: s.input ? (JSON.parse(s.input) as unknown) : undefined,
      output: s.output ? (JSON.parse(s.output) as unknown) : undefined,
      error: s.error,
      durationMs: s.durationMs,
    })),
  };
}

async function dispatchExecution(executionId: string): Promise<void> {
  // V0: call worker inline via dynamic import
  // In V1+, this would publish to a BullMQ queue
  setImmediate(async () => {
    try {
      const { runExecution } = await import('../services/executor.js');
      await runExecution(executionId);
    } catch (err) {
      console.error('[dispatchExecution] failed:', err);
    }
  });
}

export default router;
