'use client';

import { useState } from 'react';
import type { WorkflowNode } from '../../types';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (config: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(node.config ?? {});

  const setField = (key: string, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onUpdate(next);
  };

  const renderFields = () => {
    switch (node.kind) {
      case 'http_request':
        return (
          <>
            <Field label="URL" value={String(config['url'] ?? '')} onChange={(v) => setField('url', v)} placeholder="https://api.example.com/data" />
            <SelectField label="Method" value={String(config['method'] ?? 'GET')} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} onChange={(v) => setField('method', v)} />
            <TextareaField label="Body (JSON)" value={typeof config['body'] === 'object' ? JSON.stringify(config['body'], null, 2) : String(config['body'] ?? '')} onChange={(v) => { try { setField('body', JSON.parse(v)); } catch { setField('body', v); } }} placeholder='{"key": "value"}' />
          </>
        );

      case 'transform':
        return (
          <TextareaField
            label="Expression (JavaScript)"
            value={String(config['expression'] ?? '(input) => input')}
            onChange={(v) => setField('expression', v)}
            placeholder="(input) => input.data"
            rows={5}
          />
        );

      case 'filter':
        return (
          <TextareaField
            label="Condition (JavaScript)"
            value={String(config['condition'] ?? '(item) => true')}
            onChange={(v) => setField('condition', v)}
            placeholder="(item) => item.active === true"
            rows={4}
          />
        );

      case 'aggregate':
        return (
          <>
            <SelectField
              label="Operation"
              value={String(config['operation'] ?? 'count')}
              options={['sum', 'average', 'min', 'max', 'count', 'join', 'first', 'last']}
              onChange={(v) => setField('operation', v)}
            />
            <Field
              label="Field (optional)"
              value={String(config['field'] ?? '')}
              onChange={(v) => setField('field', v)}
              placeholder="price"
            />
          </>
        );

      case 'ai_agent':
        return (
          <>
            <SelectField
              label="LLM Provider"
              value={String(config['provider'] ?? 'mock')}
              options={['mock', 'gemini', 'openai', 'vercel_ai', 'langchain']}
              onChange={(v) => setField('provider', v)}
            />
            <Field
              label="Model (optional)"
              value={String(config['model'] ?? '')}
              onChange={(v) => setField('model', v)}
              placeholder="gemini-1.5-flash"
            />
            <TextareaField
              label="System Prompt"
              value={String(config['systemPrompt'] ?? 'You are a helpful assistant.')}
              onChange={(v) => setField('systemPrompt', v)}
              rows={4}
            />
            <TextareaField
              label="User Prompt Template"
              value={String(config['userPromptTemplate'] ?? '')}
              onChange={(v) => setField('userPromptTemplate', v)}
              placeholder="Analyze: {{input}}"
              rows={4}
            />
            <SelectField
              label="Output Format"
              value={String(config['outputFormat'] ?? 'text')}
              options={['text', 'json']}
              onChange={(v) => setField('outputFormat', v)}
            />
          </>
        );

      case 'code':
        return (
          <TextareaField
            label="Code"
            value={String(config['code'] ?? 'return inputs;')}
            onChange={(v) => setField('code', v)}
            placeholder="// Access inputs object\nreturn Object.values(inputs)[0];"
            rows={8}
          />
        );

      case 'manual_trigger':
      case 'output':
        return (
          <p className="text-slate-400 text-xs">No configuration required for this node.</p>
        );

      case 'cron_trigger':
        return (
          <>
            <Field
              label="Cron Expression"
              value={String(config['expression'] ?? '* * * * *')}
              onChange={(v) => setField('expression', v)}
              placeholder="*/5 * * * *"
            />
            <div className="bg-slate-900 rounded p-2 text-xs text-slate-400 space-y-0.5">
              <div className="text-slate-300 font-medium mb-1">Format: minute hour dom month dow</div>
              <div><code className="text-green-400">* * * * *</code> – every minute</div>
              <div><code className="text-green-400">*/5 * * * *</code> – every 5 minutes</div>
              <div><code className="text-green-400">0 9 * * 1-5</code> – 09:00 on weekdays</div>
              <div><code className="text-green-400">0 0 * * *</code> – midnight daily</div>
            </div>
          </>
        );

      case 'webhook_trigger': {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
        const webhookUrl = `${apiBase}/webhooks/${node.workflowId}`;
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Webhook URL</label>
              <div className="bg-slate-900 rounded p-2 text-xs break-all">
                <span className="text-blue-400 font-medium">POST </span>
                <span className="text-green-300">{webhookUrl}</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs">
              Activate the workflow and send a <code className="text-blue-300">POST</code> request to the URL
              above. The request body, query parameters, and headers will be available as the trigger payload.
            </p>
            <div className="bg-slate-900 rounded p-2 text-xs text-slate-400">
              <div className="text-slate-300 font-medium mb-1">Example (curl):</div>
              <code className="text-green-300 block whitespace-pre-wrap">{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}</code>
            </div>
          </div>
        );
      }

      default:
        return (
          <TextareaField
            label="Config (JSON)"
            value={JSON.stringify(config, null, 2)}
            onChange={(v) => { try { setConfig(JSON.parse(v) as Record<string, unknown>); } catch { /* noop */ } }}
            rows={8}
          />
        );
    }
  };

  return (
    <div className="bg-slate-800 border-l border-slate-700 w-80 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div>
          <h3 className="text-white font-semibold text-sm">{node.label}</h3>
          <span className="text-slate-400 text-xs">{node.kind.replace(/_/g, ' ')}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderFields()}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600 focus:border-blue-500 outline-none font-mono resize-vertical"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600 focus:border-blue-500 outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
