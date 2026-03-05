import type { NodeKind, LLMProvider, ExecutionStatus, StepStatus } from './shared';

export type { NodeKind, LLMProvider, ExecutionStatus, StepStatus };

export interface WorkflowNode {
  id: string;
  workflowId: string;
  kind: NodeKind;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeKind: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  triggerPayload?: Record<string, unknown>;
  createdAt: string;
  steps: ExecutionStep[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Workspace {
  id: string;
  name: string;
}
