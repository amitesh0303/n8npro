/**
 * Boot module: registers all node handlers and LLM adapters.
 * Import this once at application startup.
 */
import { registerHandler } from './executor.js';
import { httpRequestHandler } from './nodes/httpRequestHandler.js';
import {
  transformHandler,
  filterHandler,
  aggregateHandler,
  codeHandler,
  outputHandler,
} from './nodes/utilityHandlers.js';
import { aiAgentHandler } from './nodes/aiAgentHandler.js';

// LLM adapters (register on import)
import './llm/geminiAdapter.js';
import './llm/openaiAdapter.js';
import './llm/langchainAdapter.js';

export function registerAll(): void {
  registerHandler(httpRequestHandler);
  registerHandler(transformHandler);
  registerHandler(filterHandler);
  registerHandler(aggregateHandler);
  registerHandler(codeHandler);
  registerHandler(outputHandler);
  registerHandler(aiAgentHandler);
}
