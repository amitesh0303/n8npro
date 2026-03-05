import { Router, type Router as ExpressRouter } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { NodeDefinition, EdgeDefinition } from '@n8npro/shared';

const router: ExpressRouter = Router();

// GET /workflows - list workflows for the authenticated user's workspace
router.get('/', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.query['workspaceId'] as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId query param required' });
      return;
    }

    // Verify the user has access
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.auth!.userId },
    });
    if (!member) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const workflows = await prisma.workflow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: { nodes: true, edges: true },
    });

    res.json({ workflows: workflows.map(serializeWorkflow) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /workflows - create a new workflow
router.post('/', requireAuth, async (req, res) => {
  try {
    const { workspaceId, name, description } = req.body as {
      workspaceId?: string;
      name?: string;
      description?: string;
    };
    if (!workspaceId || !name) {
      res.status(400).json({ error: 'workspaceId and name are required' });
      return;
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.auth!.userId },
    });
    if (!member) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const workflow = await prisma.workflow.create({
      data: { workspaceId, name, description },
      include: { nodes: true, edges: true },
    });

    res.status(201).json({ workflow: serializeWorkflow(workflow) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /workflows/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const workflow = await findWorkflowForUser(req.params['id']!, req.auth!.userId);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json({ workflow: serializeWorkflow(workflow) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /workflows/:id - update workflow metadata
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await findWorkflowForUser(req.params['id']!, req.auth!.userId);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const { name, description, active } = req.body as {
      name?: string;
      description?: string;
      active?: boolean;
    };

    const updated = await prisma.workflow.update({
      where: { id: req.params['id']! },
      data: { name, description, active },
      include: { nodes: true, edges: true },
    });

    res.json({ workflow: serializeWorkflow(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /workflows/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await findWorkflowForUser(req.params['id']!, req.auth!.userId);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    await prisma.workflow.delete({ where: { id: req.params['id']! } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /workflows/:id/graph - replace nodes and edges for a workflow
router.put('/:id/graph', requireAuth, async (req, res) => {
  try {
    const existing = await findWorkflowForUser(req.params['id']!, req.auth!.userId);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const { nodes, edges } = req.body as {
      nodes?: NodeDefinition[];
      edges?: EdgeDefinition[];
    };

    await prisma.$transaction([
      prisma.node.deleteMany({ where: { workflowId: req.params['id']! } }),
      prisma.edge.deleteMany({ where: { workflowId: req.params['id']! } }),
      prisma.node.createMany({
        data: (nodes ?? []).map((n) => ({
          id: n.id,
          workflowId: req.params['id']!,
          kind: n.kind,
          label: n.label,
          positionX: n.position.x,
          positionY: n.position.y,
          config: JSON.stringify(n.config ?? {}),
        })),
      }),
      prisma.edge.createMany({
        data: (edges ?? []).map((e) => ({
          id: e.id,
          workflowId: req.params['id']!,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      }),
    ]);

    const updated = await prisma.workflow.findUnique({
      where: { id: req.params['id']! },
      include: { nodes: true, edges: true },
    });

    res.json({ workflow: serializeWorkflow(updated!) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type WorkflowWithGraph = Awaited<
  ReturnType<typeof prisma.workflow.findUnique>
> & { nodes: Awaited<ReturnType<typeof prisma.node.findMany>>; edges: Awaited<ReturnType<typeof prisma.edge.findMany>> };

async function findWorkflowForUser(workflowId: string, userId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId },
    include: { nodes: true, edges: true },
  });
  if (!workflow) return null;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workflow.workspaceId, userId },
  });
  if (!member) return null;

  return workflow;
}

function serializeWorkflow(w: NonNullable<WorkflowWithGraph>) {
  return {
    id: w.id,
    workspaceId: w.workspaceId,
    name: w.name,
    description: w.description,
    active: w.active,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    nodes: w.nodes.map((n) => ({
      id: n.id,
      workflowId: n.workflowId,
      kind: n.kind,
      label: n.label,
      position: { x: n.positionX, y: n.positionY },
      config: JSON.parse(n.config) as Record<string, unknown>,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
    edges: w.edges.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}

export default router;
