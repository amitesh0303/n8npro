import { Router, type Router as ExpressRouter } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router: ExpressRouter = Router();

// GET /credentials?workspaceId=xxx
router.get('/', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.query['workspaceId'] as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId required' });
      return;
    }
    await requireWorkspaceMember(workspaceId, req.auth!.userId, res);
    if (res.headersSent) return;

    const credentials = await prisma.credential.findMany({
      where: { workspaceId },
      select: { id: true, name: true, type: true, createdAt: true, updatedAt: true },
    });
    res.json({ credentials });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /credentials
router.post('/', requireAuth, async (req, res) => {
  try {
    const { workspaceId, name, type, data } = req.body as {
      workspaceId?: string;
      name?: string;
      type?: string;
      data?: Record<string, string>;
    };
    if (!workspaceId || !name || !type) {
      res.status(400).json({ error: 'workspaceId, name, and type are required' });
      return;
    }
    await requireWorkspaceMember(workspaceId, req.auth!.userId, res);
    if (res.headersSent) return;

    const cred = await prisma.credential.create({
      data: {
        workspaceId,
        name,
        type,
        data: JSON.stringify(data ?? {}),
      },
      select: { id: true, name: true, type: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json({ credential: cred });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /credentials/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const cred = await prisma.credential.findFirst({ where: { id: req.params['id']! } });
    if (!cred) {
      res.status(404).json({ error: 'Credential not found' });
      return;
    }
    await requireWorkspaceMember(cred.workspaceId, req.auth!.userId, res);
    if (res.headersSent) return;

    await prisma.credential.delete({ where: { id: req.params['id']! } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
  res: import('express').Response
): Promise<void> {
  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId } });
  if (!member) {
    res.status(403).json({ error: 'Forbidden' });
  }
}

export default router;
