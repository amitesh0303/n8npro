'use client';

import type { Execution, ExecutionStep } from '../../types';

interface ExecutionViewerProps {
  execution: Execution;
}

const STATUS_COLORS = {
  queued: 'bg-slate-500',
  running: 'bg-blue-500 animate-pulse',
  success: 'bg-green-500',
  error: 'bg-red-500',
  cancelled: 'bg-orange-500',
  pending: 'bg-slate-400',
  skipped: 'bg-slate-400',
} as const;

const STATUS_ICONS = {
  queued: '⏳',
  running: '⚡',
  success: '✅',
  error: '❌',
  cancelled: '🚫',
  pending: '•',
  skipped: '⏭',
} as const;

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString();
}

function StepRow({ step }: { step: ExecutionStep }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[step.status] ?? 'bg-slate-500';
  const statusIcon = STATUS_ICONS[step.status] ?? '•';

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-center gap-3 p-3 hover:bg-slate-750 transition-colors"
      >
        <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
        <span className="text-xs">{statusIcon}</span>
        <span className="text-white text-xs font-medium flex-1">{step.nodeKind.replace(/_/g, ' ')}</span>
        <span className="text-slate-400 text-xs">{formatDate(step.startedAt)}</span>
        {step.durationMs != null && (
          <span className="text-slate-400 text-xs">{formatDuration(step.durationMs)}</span>
        )}
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-3 space-y-2">
          {step.error && (
            <div>
              <div className="text-red-400 text-xs font-medium mb-1">Error</div>
              <pre className="bg-slate-900 text-red-300 text-xs p-2 rounded overflow-x-auto">
                {step.error}
              </pre>
            </div>
          )}
          {step.input !== undefined && (
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Input</div>
              <pre className="bg-slate-900 text-slate-300 text-xs p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output !== undefined && (
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Output</div>
              <pre className="bg-slate-900 text-green-300 text-xs p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Need to import useState separately since this is a 'use client' sub-component
import { useState } from 'react';

export function ExecutionViewer({ execution }: ExecutionViewerProps) {
  const statusColor = STATUS_COLORS[execution.status] ?? 'bg-slate-500';
  const statusIcon = STATUS_ICONS[execution.status] ?? '•';

  const duration =
    execution.startedAt && execution.finishedAt
      ? new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()
      : undefined;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700">
        <span className={`inline-block w-3 h-3 rounded-full ${statusColor}`} />
        <span className="text-sm">{statusIcon}</span>
        <div className="flex-1">
          <div className="text-white text-sm font-medium">
            Execution <span className="text-slate-400 font-normal text-xs">{execution.id.slice(0, 8)}…</span>
          </div>
          <div className="text-slate-400 text-xs capitalize">{execution.status}</div>
        </div>
        <div className="text-right">
          {execution.startedAt && (
            <div className="text-slate-400 text-xs">{formatDate(execution.startedAt)}</div>
          )}
          {duration != null && (
            <div className="text-slate-300 text-xs font-medium">{formatDuration(duration)}</div>
          )}
        </div>
      </div>

      {/* Error */}
      {execution.error && (
        <div className="p-3 border-b border-slate-700 bg-red-900/20">
          <div className="text-red-400 text-xs font-medium mb-1">Execution Error</div>
          <pre className="text-red-300 text-xs">{execution.error}</pre>
        </div>
      )}

      {/* Steps */}
      {execution.steps.length > 0 && (
        <div className="p-3 space-y-2">
          <div className="text-slate-400 text-xs font-medium mb-2">
            Steps ({execution.steps.length})
          </div>
          {execution.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
