import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth
export const authApi = {
  signup: (email: string, password: string, name?: string) =>
    api.post('/auth/signup', { email, password, name }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// Workflows
export const workflowsApi = {
  list: (workspaceId: string) =>
    api.get('/workflows', { params: { workspaceId } }),
  get: (id: string) => api.get(`/workflows/${id}`),
  create: (workspaceId: string, name: string, description?: string) =>
    api.post('/workflows', { workspaceId, name, description }),
  update: (id: string, data: { name?: string; description?: string; active?: boolean }) =>
    api.put(`/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  saveGraph: (id: string, nodes: unknown[], edges: unknown[]) =>
    api.put(`/workflows/${id}/graph`, { nodes, edges }),
};

// Executions
export const executionsApi = {
  trigger: (workflowId: string, triggerPayload?: Record<string, unknown>) =>
    api.post('/executions', { workflowId, triggerPayload }),
  get: (id: string) => api.get(`/executions/${id}`),
  list: (workflowId: string) =>
    api.get('/executions', { params: { workflowId } }),
};

// Credentials
export const credentialsApi = {
  list: (workspaceId: string) =>
    api.get('/credentials', { params: { workspaceId } }),
  create: (workspaceId: string, name: string, type: string, data: Record<string, string>) =>
    api.post('/credentials', { workspaceId, name, type, data }),
  delete: (id: string) => api.delete(`/credentials/${id}`),
};
