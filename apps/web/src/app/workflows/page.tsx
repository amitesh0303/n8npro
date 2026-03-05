'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { workflowsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { Workflow } from '../../types';
import type { AxiosError } from 'axios';

export default function WorkflowsPage() {
  const router = useRouter();
  const { user, workspace, loadFromStorage, clearAuth } = useAuthStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!workspace) return;
    loadWorkflows();
  }, [user, workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWorkflows = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const res = await workflowsApi.list(workspace.id);
      setWorkflows((res.data as { workflows: Workflow[] }).workflows);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      if (axiosErr.response?.status === 401) {
        clearAuth();
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await workflowsApi.create(workspace.id, newName.trim());
      const newWorkflow = (res.data as { workflow: Workflow }).workflow;
      setWorkflows((prev) => [newWorkflow, ...prev]);
      setNewName('');
      setShowCreate(false);
      router.push(`/workflows/${newWorkflow.id}`);
    } catch {
      setError('Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      await workflowsApi.delete(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError('Failed to delete workflow');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">
            n8n<span className="text-blue-500">pro</span>
          </h1>
          {workspace && (
            <span className="text-slate-500 text-sm">/ {workspace.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user?.email}</span>
          <button
            onClick={() => { clearAuth(); router.push('/auth/login'); }}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">Workflows</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Workflow
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h3 className="text-white font-medium mb-4">New Workflow</h3>
            {error && (
              <div className="text-red-400 text-sm mb-3">{error}</div>
            )}
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Workflow name"
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm"
                autoFocus
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-white px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Workflow list */}
        {loading ? (
          <div className="text-slate-400 text-sm animate-pulse">Loading workflows…</div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔄</div>
            <p className="text-slate-400 text-sm">No workflows yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex items-center justify-between hover:border-slate-600 transition-colors"
              >
                <div>
                  <Link href={`/workflows/${w.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                    {w.name}
                  </Link>
                  {w.description && (
                    <p className="text-slate-400 text-sm mt-0.5">{w.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-slate-500 text-xs">
                      {w.nodes.length} node{w.nodes.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-500 text-xs">
                      Updated {new Date(w.updatedAt).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${w.active ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/workflows/${w.id}`}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-slate-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
