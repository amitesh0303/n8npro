import type { LLMClient, LLMGenerateOptions, LLMGenerateResult } from '@n8npro/shared';

/**
 * Mock LLM client for development/testing.
 * Returns a predictable response without making real API calls.
 */
export const mockLLMClient: LLMClient = {
  provider: 'mock',

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
    const userContent = lastUserMessage?.content ?? '';

    let text: string;
    if (options.responseFormat === 'json') {
      text = JSON.stringify({
        result: `Mock analysis of: ${userContent.slice(0, 80)}`,
        confidence: 0.95,
        model: 'mock-v1',
      });
    } else {
      text = `[Mock LLM] Processed: "${userContent.slice(0, 100)}" — this is a placeholder response. Configure a real LLM provider in your credentials.`;
    }

    return {
      text,
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      model: 'mock-v1',
      finishReason: 'stop',
    };
  },
};
