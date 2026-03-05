'use client';

import { useState } from 'react';
import type { NodeKind } from '../../types/shared';

interface AddNodePanelProps {
  onAdd: (kind: NodeKind, label: string) => void;
}

const NODE_OPTIONS: { kind: NodeKind; label: string; icon: string; description: string }[] = [
  { kind: 'manual_trigger', label: 'Manual Trigger', icon: '▶️', description: 'Start workflow manually' },
  { kind: 'webhook_trigger', label: 'Webhook', icon: '🪝', description: 'Trigger from HTTP webhook' },
  { kind: 'cron_trigger', label: 'Schedule', icon: '⏰', description: 'Run on a schedule' },
  { kind: 'http_request', label: 'HTTP Request', icon: '🌐', description: 'Make API calls' },
  { kind: 'ai_agent', label: 'AI Agent', icon: '🤖', description: 'Call an LLM' },
  { kind: 'transform', label: 'Transform', icon: '⚙️', description: 'Transform data with JS' },
  { kind: 'filter', label: 'Filter', icon: '🔍', description: 'Filter arrays' },
  { kind: 'aggregate', label: 'Aggregate', icon: '📊', description: 'Sum, average, min, max...' },
  { kind: 'code', label: 'Code', icon: '💻', description: 'Run arbitrary code' },
  { kind: 'output', label: 'Output', icon: '📤', description: 'Collect final result' },
];

export function AddNodePanel({ onAdd }: AddNodePanelProps) {
  const [search, setSearch] = useState('');

  const filtered = NODE_OPTIONS.filter(
    (n) =>
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-800 rounded-lg p-3 w-64 shadow-xl border border-slate-700">
      <h3 className="text-white font-semibold text-sm mb-2">Add Node</h3>
      <input
        type="text"
        placeholder="Search nodes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 mb-2 outline-none border border-slate-600 focus:border-blue-500"
      />
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {filtered.map((opt) => (
          <button
            key={opt.kind}
            onClick={() => onAdd(opt.kind, opt.label)}
            className="w-full text-left flex items-center gap-2 px-2 py-2 rounded hover:bg-slate-700 transition-colors group"
          >
            <span className="text-base">{opt.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium">{opt.label}</div>
              <div className="text-slate-400 text-xs truncate">{opt.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
