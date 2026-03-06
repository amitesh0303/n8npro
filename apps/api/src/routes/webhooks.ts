import { Router, type Router as ExpressRouter } from 'express';
import { prisma } from '../db/prisma.js';

const router: ExpressRouter = Router();

/**
 * POST /webhooks/:workflowId
 * Public endpoint – no auth required. Triggers the workflow if it is active
 * and has a webhook_trigger node.
 */
router.post('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    if (!workflowId) {
      res.status(400).json({ error: 'workflowId is required' });
      return;
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { nodes: true },
    });

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    if (!workflow.active) {
      res.status(400).json({ error: 'Workflow is not active' });
      return;
    }

    const triggerNode = workflow.nodes.find((n) => n.kind === 'webhook_trigger');
    if (!triggerNode) {
      res.status(400).json({ error: 'Workflow has no webhook trigger node' });
      return;
    }

    const triggerPayload: Record<string, unknown> = {
      body: req.body as unknown,
      query: req.query,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => !k.toLowerCase().startsWith('x-'))
      ),
      timestamp: new Date().toISOString(),
    };

    const execution = await prisma.execution.create({
      data: {
        workflowId,
        status: 'queued',
        triggerPayload: JSON.stringify(triggerPayload),
      },
    });

    // Dispatch async (V0 inline; V1+ would enqueue to BullMQ)
    setImmediate(async () => {
      try {
        const { runExecution } = await import('../services/executor.js');
        await runExecution(execution.id);
      } catch (err) {
        console.error('[webhook] execution failed:', err);
      }
    });

    res.status(202).json({
      executionId: execution.id,
      status: 'queued',
      message: 'Webhook received – execution queued',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /webhooks/:workflowId
 * Returns webhook metadata so callers can verify the endpoint is active.
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params['workflowId']! },
      include: { nodes: true },
    });

    if (!workflow || !workflow.active) {
      res.status(404).json({ error: 'Workflow not found or not active' });
      return;
    }

    const triggerNode = workflow.nodes.find((n) => n.kind === 'webhook_trigger');
    if (!triggerNode) {
      res.status(404).json({ error: 'No webhook trigger node found' });
      return;
    }

    res.json({
      workflowId: workflow.id,
      name: workflow.name,
      active: workflow.active,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
