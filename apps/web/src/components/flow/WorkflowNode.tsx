'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeKind } from '../../types/shared';

interface WorkflowNodeData {
  label: string;
  kind: NodeKind;
  config: Record<string, unknown>;
}

const NODE_COLORS: Record<NodeKind, string> = {
  http_request: 'bg-blue-500',
  transform: 'bg-purple-500',
  filter: 'bg-orange-500',
  aggregate: 'bg-yellow-500',
  ai_agent: 'bg-green-500',
  code: 'bg-gray-600',
  manual_trigger: 'bg-teal-500',
  cron_trigger: 'bg-teal-600',
  webhook_trigger: 'bg-teal-700',
  output: 'bg-red-500',
};

const NODE_ICONS: Record<NodeKind, string> = {
  http_request: '🌐',
  transform: '⚙️',
  filter: '🔍',
  aggregate: '📊',
  ai_agent: '🤖',
  code: '💻',
  manual_trigger: '▶️',
  cron_trigger: '⏰',
  webhook_trigger: '🪝',
  output: '📤',
};

export const WorkflowNodeComponent = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const color = NODE_COLORS[data.kind] ?? 'bg-slate-500';
  const icon = NODE_ICONS[data.kind] ?? '📦';

  return (
    <div
      className={`rounded-lg border-2 ${
        selected ? 'border-white' : 'border-transparent'
      } shadow-lg min-w-[160px]`}
    >
      {/* Header */}
      <div className={`${color} text-white px-3 py-2 rounded-t-lg flex items-center gap-2`}>
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium truncate max-w-[120px]">{data.label}</span>
      </div>
      {/* Body */}
      <div className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-b-lg">
        <span className="text-xs opacity-70">{data.kind.replace(/_/g, ' ')}</span>
      </div>

      {/* Handles */}
      {data.kind !== 'manual_trigger' &&
        data.kind !== 'cron_trigger' &&
        data.kind !== 'webhook_trigger' && (
          <Handle
            type="target"
            position={Position.Left}
            className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-700"
          />
        )}
      {data.kind !== 'output' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-700"
        />
      )}
    </div>
  );
});

WorkflowNodeComponent.displayName = 'WorkflowNodeComponent';
