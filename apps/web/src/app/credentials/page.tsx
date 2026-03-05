'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { credentialsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { AxiosError } from 'axios';

interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

const CREDENTIAL_TYPES = [
  { value: 'openai', label: 'OpenAI', fields: [{ key: 'apiKey', label: 'API Key', secret: true }] },
  { value: 'gemini', label: 'Google Gemini', fields: [{ key: 'apiKey', label: 'API Key', secret: true }] },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true }],
  },
  {
    value: 'vercel_ai',
    label: 'Vercel AI',
    fields: [
      { key: 'apiKey', label: 'API Key', secret: true },
      { key: 'baseUrl', label: 'Base URL', secret: false },
    ],
  },
  {
    value: 'http_basic',
    label: 'HTTP Basic Auth',
    fields: [
      { key: 'username', label: 'Username', secret: false },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    value: 'http_header',
    label: 'HTTP Header Auth',
    fields: [
      { key: 'headerName', label: 'Header Name', secret: false },
      { key: 'headerValue', label: 'Header Value', secret: true },
    ],
  },
];

const TYPE_ICONS: Record<string, string> = {
  openai: '🤖',
  gemini: '✨',
  anthropic: '🧠',
  vercel_ai: '▲',
  http_basic: '🔑',
  http_header: '🏷️',
};

export default function CredentialsPage() {
  const router = useRouter();
  const { user, workspace, loadFromStorage, clearAuth } = useAuthStore();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState(CREDENTIAL_TYPES[0]!.value);
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!workspace) return;
    loadCredentials();
  }, [user, workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCredentials = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const res = await credentialsApi.list(workspace.id);
      setCredentials((res.data as { credentials: Credential[] }).credentials);
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

  const selectedCredType = CREDENTIAL_TYPES.find((t) => t.value === formType) ?? CREDENTIAL_TYPES[0]!;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !formName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await credentialsApi.create(workspace.id, formName.trim(), formType, formFields);
      setFormName('');
      setFormType(CREDENTIAL_TYPES[0]!.value);
      setFormFields({});
      setShowCreate(false);
      await loadCredentials();
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      setError(axiosErr.response?.data?.error ?? 'Failed to create credential');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this credential? Workflows using it may stop working.')) return;
    try {
      await credentialsApi.delete(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Failed to delete credential');
    }
  };

  const resetCreateForm = () => {
    setFormName('');
    setFormType(CREDENTIAL_TYPES[0]!.value);
    setFormFields({});
    setError('');
    setShowCreate(false);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">
            n8n<span className="text-blue-500">pro</span>
          </h1>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Link href="/workflows" className="hover:text-slate-300 transition-colors">
              Workflows
            </Link>
            <span>/</span>
            <span className="text-slate-300">Credentials</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user?.email}</span>
          <button
            onClick={() => {
              clearAuth();
              router.push('/auth/login');
            }}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white text-2xl font-semibold">Credentials</h2>
            <p className="text-slate-400 text-sm mt-1">
              Securely store API keys and secrets used by your workflow nodes.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Credential
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h3 className="text-white font-medium mb-4">New Credential</h3>
            {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My OpenAI Key"
                  required
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => {
                    setFormType(e.target.value);
                    setFormFields({});
                  }}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm"
                >
                  {CREDENTIAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCredType.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-slate-300 text-xs font-medium mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    value={formFields[field.key] ?? ''}
                    onChange={(e) =>
                      setFormFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.secret ? '••••••••' : ''}
                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm font-mono"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || !formName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {creating ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="text-slate-400 hover:text-white px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Credential list */}
        {loading ? (
          <div className="text-slate-400 text-sm animate-pulse">Loading credentials…</div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔑</div>
            <p className="text-slate-400 text-sm">
              No credentials yet. Add your first API key to use in workflow nodes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => {
              const typeInfo = CREDENTIAL_TYPES.find((t) => t.value === cred.type);
              const icon = TYPE_ICONS[cred.type] ?? '🔐';
              return (
                <div
                  key={cred.id}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <div className="text-white font-medium text-sm">{cred.name}</div>
                      <div className="text-slate-400 text-xs">
                        {typeInfo?.label ?? cred.type} &middot; Updated{' '}
                        {new Date(cred.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(cred.id)}
                    className="text-slate-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
