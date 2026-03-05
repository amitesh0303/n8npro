// Shared type re-exports for the web frontend
// These mirror the shared package types without needing the package dependency

export type NodeKind =
  | 'http_request'
  | 'transform'
  | 'filter'
  | 'aggregate'
  | 'ai_agent'
  | 'code'
  | 'manual_trigger'
  | 'cron_trigger'
  | 'webhook_trigger'
  | 'output';

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'vercel_ai' | 'langchain' | 'mock';
export type ExecutionStatus = 'queued' | 'running' | 'success' | 'error' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
