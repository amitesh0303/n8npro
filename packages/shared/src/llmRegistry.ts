import type { LLMClient, LLMProvider } from './types.js';

/**
 * Registry of LLM client factories.
 * Each adapter is registered by provider name and instantiated on demand.
 */
export type LLMClientFactory = (config: Record<string, string>) => LLMClient;

const registry = new Map<LLMProvider, LLMClientFactory>();

export function registerLLMClient(provider: LLMProvider, factory: LLMClientFactory): void {
  registry.set(provider, factory);
}

export function createLLMClient(
  provider: LLMProvider,
  config: Record<string, string>
): LLMClient {
  const factory = registry.get(provider);
  if (!factory) {
    throw new Error(`No LLM client registered for provider "${provider}"`);
  }
  return factory(config);
}

export function listRegisteredProviders(): LLMProvider[] {
  return Array.from(registry.keys());
}
