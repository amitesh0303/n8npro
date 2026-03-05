/**
 * In-process cron scheduler.
 *
 * Checks every minute for active workflows that have a cron_trigger node whose
 * expression matches the current time, then dispatches an execution for each.
 *
 * Supports standard 5-field cron expressions: minute hour dom month dow
 * Examples (use without quotes in the node config):
 *   "* * * * *"   – every minute
 *   every 5 min:  minute field = every-5 (*&#47;5), rest wildcard
 *   "0 9 * * 1-5" – 09:00 on weekdays
 */

import { prisma } from '../db/prisma.js';

// ─── Cron Expression Parser ──────────────────────────────────────────────────

function matchesCronPart(part: string, value: number): boolean {
  if (part === '*') return true;

  // Step: */N or start-end/N
  if (part.includes('/')) {
    const [rangeStr, stepStr] = part.split('/');
    const step = parseInt(stepStr!, 10);
    if (isNaN(step) || step <= 0) return false;

    let start = 0;
    let end = Infinity;
    if (rangeStr && rangeStr !== '*') {
      if (rangeStr.includes('-')) {
        const [s, e] = rangeStr.split('-').map(Number);
        start = s!;
        end = e!;
      } else {
        start = parseInt(rangeStr, 10);
        end = start;
      }
    }
    if (value < start || value > end) return false;
    return (value - start) % step === 0;
  }

  // Range: N-M
  if (part.includes('-')) {
    const [startStr, endStr] = part.split('-');
    const start = parseInt(startStr!, 10);
    const end = parseInt(endStr!, 10);
    return value >= start && value <= end;
  }

  // List: N,M,P
  if (part.includes(',')) {
    return part.split(',').map((v) => parseInt(v.trim(), 10)).includes(value);
  }

  // Exact value
  return parseInt(part, 10) === value;
}

function cronMatches(expression: string, now: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minutePart, hourPart, domPart, monthPart, dowPart] = parts;

  return (
    matchesCronPart(minutePart!, now.getMinutes()) &&
    matchesCronPart(hourPart!, now.getHours()) &&
    matchesCronPart(domPart!, now.getDate()) &&
    matchesCronPart(monthPart!, now.getMonth() + 1) &&
    matchesCronPart(dowPart!, now.getDay())
  );
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startCronScheduler(): void {
  if (schedulerTimer) return;

  // Align to the next full minute, then tick every 60 s
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => {
    void checkAndRunCronWorkflows();
    schedulerTimer = setInterval(() => {
      void checkAndRunCronWorkflows();
    }, 60_000);
  }, msUntilNextMinute);

  console.log('[cron] Scheduler started');
}

export function stopCronScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

async function checkAndRunCronWorkflows(): Promise<void> {
  const now = new Date();

  try {
    const workflows = await prisma.workflow.findMany({
      where: { active: true },
      include: { nodes: true },
    });

    for (const workflow of workflows) {
      const cronNode = workflow.nodes.find((n) => n.kind === 'cron_trigger');
      if (!cronNode) continue;

      const config = JSON.parse(cronNode.config) as { expression?: string };
      const expression = config.expression?.trim();
      if (!expression) continue;

      if (!cronMatches(expression, now)) continue;

      console.log(`[cron] Triggering workflow "${workflow.name}" (${workflow.id})`);

      try {
        const execution = await prisma.execution.create({
          data: {
            workflowId: workflow.id,
            status: 'queued',
            triggerPayload: JSON.stringify({
              source: 'cron',
              expression,
              triggeredAt: now.toISOString(),
            }),
          },
        });

        setImmediate(async () => {
          try {
            const { runExecution } = await import('./executor.js');
            await runExecution(execution.id);
          } catch (err) {
            console.error('[cron] execution failed:', err);
          }
        });
      } catch (err) {
        console.error(`[cron] Failed to queue workflow ${workflow.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[cron] Scheduler error:', err);
  }
}
