import type { LLMClient, LLMProvider } from './types.js';
/**
 * Registry of LLM client factories.
 * Each adapter is registered by provider name and instantiated on demand.
 */
export type LLMClientFactory = (config: Record<string, string>) => LLMClient;
export declare function registerLLMClient(provider: LLMProvider, factory: LLMClientFactory): void;
export declare function createLLMClient(provider: LLMProvider, config: Record<string, string>): LLMClient;
export declare function listRegisteredProviders(): LLMProvider[];
