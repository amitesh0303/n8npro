'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Node as RFNode, Edge as RFEdge } from 'reactflow';
import { workflowsApi, executionsApi } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { WorkflowEditor } from '../../../components/flow/WorkflowEditor';
import { ExecutionViewer } from '../../../components/flow/ExecutionViewer';
import type { Workflow, Execution, WorkflowNode, WorkflowEdge } from '../../../types';
import type { NodeKind } from '../../../types/shared';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WorkflowDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [latestExecution, setLatestExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'executions'>('editor');
  const [error, setError] = useState('');

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    loadWorkflow();
  }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const [wfRes, exRes] = await Promise.all([
        workflowsApi.get(id),
        executionsApi.list(id),
      ]);
      setWorkflow((wfRes.data as { workflow: Workflow }).workflow);
      const execs = (exRes.data as { executions: Execution[] }).executions;
      setExecutions(execs);
      if (execs.length > 0) setLatestExecution(execs[0]!);
    } catch {
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (nodes: RFNode[], edges: RFEdge[]) => {
    if (!workflow) return;
    setSaving(true);
    try {
      // Convert ReactFlow nodes/edges back to API format
      const apiNodes: WorkflowNode[] = nodes.map((n) => ({
        id: n.id,
        workflowId: workflow.id,
        kind: (n.data as { kind: NodeKind }).kind,
        label: (n.data as { label: string }).label,
        position: n.position,
        config: (n.data as { config: Record<string, unknown> }).config ?? {},
        createdAt: '',
        updatedAt: '',
      }));

      const apiEdges: WorkflowEdge[] = edges.map((e) => ({
        id: e.id,
        workflowId: workflow.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      }));

      const res = await workflowsApi.saveGraph(workflow.id, apiNodes, apiEdges);
      setWorkflow((res.data as { workflow: Workflow }).workflow);
    } catch {
      setError('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!workflow) return;
    setRunning(true);
    setError('');
    try {
      const res = await executionsApi.trigger(workflow.id);
      const { executionId } = res.data as { executionId: string };

      // Poll for result
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const execRes = await executionsApi.get(executionId);
          const exec = (execRes.data as { execution: Execution }).execution;
          setLatestExecution(exec);
          if (exec.status === 'running' || exec.status === 'queued') {
            if (attempts < 30) setTimeout(poll, 1000);
          } else {
            setRunning(false);
            setExecutions((prev) => [exec, ...prev.filter((e) => e.id !== exec.id)]);
          }
        } catch {
          setRunning(false);
        }
      };
      setTimeout(poll, 500);
    } catch {
      setError('Failed to trigger execution');
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading workflow…</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Workflow not found</p>
          <Link href="/workflows" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to workflows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0">
        <Link href="/workflows" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Workflows
        </Link>
        <h1 className="text-white font-medium">{workflow.name}</h1>
        <div className="flex-1" />

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'editor' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('executions')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'executions' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Executions
            {executions.length > 0 && (
              <span className="ml-1.5 bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
                {executions.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {error && (
        <div className="bg-red-900/30 border-b border-red-800 text-red-300 text-sm px-4 py-2 shrink-0">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'editor' ? (
          <WorkflowEditor
            workflow={workflow}
            onSave={handleSave}
            onRun={handleRun}
            isSaving={saving}
            isRunning={running}
          />
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <div className="max-w-3xl space-y-4">
              {latestExecution && running && (
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">Current Execution</h3>
                  <ExecutionViewer execution={latestExecution} />
                </div>
              )}
              <h3 className="text-white font-medium text-sm">Execution History</h3>
              {executions.length === 0 ? (
                <p className="text-slate-400 text-sm">No executions yet. Run the workflow first.</p>
              ) : (
                executions.map((exec) => (
                  <ExecutionViewer key={exec.id} execution={exec} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
