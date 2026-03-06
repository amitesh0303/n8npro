/**
 * Database seed script.
 * Run with: pnpm --filter @n8npro/api prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database…');

  // ── Demo user ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@n8npro.dev' },
    update: { name: 'Demo User' },
    create: {
      email: 'demo@n8npro.dev',
      passwordHash,
      name: 'Demo User',
    },
  });

  console.log(`✅ User: ${user.email}`);

  // ── Default workspace ──────────────────────────────────────────────────────
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Demo's Workspace",
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
  } else {
    // Ensure the owner is a member
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role: 'owner' },
    });
  }

  console.log(`✅ Workspace: ${workspace.name} (${workspace.id})`);

  // ── Sample workflow: HTTP fetch + output ───────────────────────────────────
  const existingWorkflow = await prisma.workflow.findFirst({
    where: { workspaceId: workspace.id, name: 'Hello World' },
  });

  if (!existingWorkflow) {
    const workflow = await prisma.workflow.create({
      data: {
        workspaceId: workspace.id,
        name: 'Hello World',
        description: 'Fetches a public API and returns the result',
        active: true,
      },
    });

    const triggerNode = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        kind: 'manual_trigger',
        label: 'Start',
        positionX: 80,
        positionY: 200,
        config: '{}',
      },
    });

    const httpNode = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        kind: 'http_request',
        label: 'Fetch Todo',
        positionX: 340,
        positionY: 200,
        config: JSON.stringify({
          url: 'https://jsonplaceholder.typicode.com/todos/1',
          method: 'GET',
        }),
      },
    });

    const outputNode = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        kind: 'output',
        label: 'Result',
        positionX: 600,
        positionY: 200,
        config: '{}',
      },
    });

    await prisma.edge.createMany({
      data: [
        { workflowId: workflow.id, sourceNodeId: triggerNode.id, targetNodeId: httpNode.id },
        { workflowId: workflow.id, sourceNodeId: httpNode.id, targetNodeId: outputNode.id },
      ],
    });

    console.log(`✅ Workflow: ${workflow.name}`);
  } else {
    console.log(`ℹ️  Workflow "Hello World" already exists – skipped`);
  }

  // ── Sample workflow: Scheduled data fetch ──────────────────────────────────
  const existingCronWorkflow = await prisma.workflow.findFirst({
    where: { workspaceId: workspace.id, name: 'Scheduled Fetch (every 5 min)' },
  });

  if (!existingCronWorkflow) {
    const cronWorkflow = await prisma.workflow.create({
      data: {
        workspaceId: workspace.id,
        name: 'Scheduled Fetch (every 5 min)',
        description: 'Runs on a cron schedule and fetches an API',
        active: false, // disabled by default so it doesn't run unexpectedly
      },
    });

    const cronTrigger = await prisma.node.create({
      data: {
        workflowId: cronWorkflow.id,
        kind: 'cron_trigger',
        label: 'Every 5 min',
        positionX: 80,
        positionY: 200,
        config: JSON.stringify({ expression: '*/5 * * * *' }),
      },
    });

    const httpNode2 = await prisma.node.create({
      data: {
        workflowId: cronWorkflow.id,
        kind: 'http_request',
        label: 'Fetch Posts',
        positionX: 340,
        positionY: 200,
        config: JSON.stringify({
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
        }),
      },
    });

    const outputNode2 = await prisma.node.create({
      data: {
        workflowId: cronWorkflow.id,
        kind: 'output',
        label: 'Result',
        positionX: 600,
        positionY: 200,
        config: '{}',
      },
    });

    await prisma.edge.createMany({
      data: [
        { workflowId: cronWorkflow.id, sourceNodeId: cronTrigger.id, targetNodeId: httpNode2.id },
        { workflowId: cronWorkflow.id, sourceNodeId: httpNode2.id, targetNodeId: outputNode2.id },
      ],
    });

    console.log(`✅ Workflow: ${cronWorkflow.name}`);
  } else {
    console.log(`ℹ️  Cron workflow already exists – skipped`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('   Login: demo@n8npro.dev');
  console.log('   Password: demo1234');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
