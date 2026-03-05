// ─── Node Types ─────────────────────────────────────────────────────────────

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

export interface NodeDefinition {
  id: string;
  workflowId: string;
  kind: NodeKind;
  label: string;
  /** x,y position on canvas */
  position: { x: number; y: number };
  /** node-specific configuration (varies by kind) */
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EdgeDefinition {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  /** optional port/handle labels */
  sourceHandle?: string;
  targetHandle?: string;
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  createdAt: string;
  updatedAt: string;
}

// ─── Execution ───────────────────────────────────────────────────────────────

export type ExecutionStatus = 'queued' | 'running' | 'success' | 'error' | 'cancelled';

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  triggerPayload?: Record<string, unknown>;
}

export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeKind: NodeKind;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

// ─── Node Execution Context ──────────────────────────────────────────────────

export interface NodeExecutionContext {
  nodeId: string;
  kind: NodeKind;
  config: Record<string, unknown>;
  /** outputs from predecessor nodes, keyed by nodeId */
  inputs: Record<string, unknown>;
  /** resolved credentials if any */
  credentials?: Record<string, string>;
}

export interface NodeExecutionResult {
  output: unknown;
  error?: string;
}

// ─── Node Handler Interface ──────────────────────────────────────────────────

export interface NodeHandler {
  kind: NodeKind;
  execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult>;
}

// ─── LLM Client Abstraction ──────────────────────────────────────────────────

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'vercel_ai' | 'langchain' | 'mock';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMToolDefinition[];
  responseFormat?: 'text' | 'json';
  systemPrompt?: string;
}

export interface LLMGenerateResult {
  text: string;
  toolCalls?: LLMToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  model?: string;
  finishReason?: string;
}

export interface LLMClient {
  provider: LLMProvider;
  generate(options: LLMGenerateOptions): Promise<LLMGenerateResult>;
}

// ─── AI Agent Node Config ────────────────────────────────────────────────────

export interface AIAgentNodeConfig {
  provider: LLMProvider;
  model?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[]; // names of tool nodes to expose
  outputSchema?: Record<string, unknown>; // JSON Schema for structured output
  outputFormat?: 'text' | 'json';
}

// ─── HTTP Request Node Config ────────────────────────────────────────────────

export interface HttpRequestNodeConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  responseType?: 'json' | 'text';
  timeoutMs?: number;
}

// ─── Transform Node Config ───────────────────────────────────────────────────

export interface TransformNodeConfig {
  /** JavaScript expression evaluated as `(input) => output` */
  expression: string;
}

// ─── Filter Node Config ──────────────────────────────────────────────────────

export interface FilterNodeConfig {
  /** JavaScript expression evaluated as `(item) => boolean` */
  condition: string;
}

// ─── Aggregate Node Config ───────────────────────────────────────────────────

export type AggregateOperation = 'sum' | 'average' | 'min' | 'max' | 'count' | 'join' | 'first' | 'last';

export interface AggregateNodeConfig {
  operation: AggregateOperation;
  /** dot-path to the field within each array item to aggregate, e.g. "price" */
  field?: string;
  /** separator for join operation */
  separator?: string;
}

// ─── Output Parsers ──────────────────────────────────────────────────────────

export interface ParsedOutput<T = unknown> {
  success: boolean;
  data?: T;
  raw: string;
  error?: string;
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export interface CredentialRecord {
  id: string;
  workspaceId: string;
  name: string;
  type: string; // e.g. 'gemini', 'openai', 'http_basic'
  /** encrypted in production; plain in dev */
  data: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ─── User / Auth ─────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}
