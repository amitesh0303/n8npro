import { create } from 'zustand';
import type { User, Workspace } from '../types';

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
  setAuth: (user: User, workspace: Workspace | null, token: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  workspace: null,
  token: null,

  setAuth: (user, workspace, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (workspace) localStorage.setItem('workspace', JSON.stringify(workspace));
    }
    set({ user, workspace, token });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('workspace');
    }
    set({ user: null, workspace: null, token: null });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const workspaceStr = localStorage.getItem('workspace');
    if (token && userStr) {
      set({
        token,
        user: JSON.parse(userStr) as User,
        workspace: workspaceStr ? (JSON.parse(workspaceStr) as Workspace) : null,
      });
    }
  },
}));
