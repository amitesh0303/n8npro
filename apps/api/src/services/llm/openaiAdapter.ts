import type { LLMClient, LLMGenerateOptions, LLMGenerateResult } from '@n8npro/shared';
import { registerLLMClient } from '@n8npro/shared';

/**
 * OpenAI-compatible adapter. Works with OpenAI and any OpenAI-compatible endpoint
 * (including Vercel AI SDK's proxy endpoints).
 */
class OpenAICompatibleAdapter implements LLMClient {
  provider: 'openai' | 'vercel_ai';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(provider: 'openai' | 'vercel_ai', config: Record<string, string>) {
    this.provider = provider;
    this.apiKey = config['apiKey'] ?? '';
    this.baseUrl = config['baseUrl'] ?? 'https://api.openai.com/v1';
    this.defaultModel = config['model'] ?? 'gpt-4o-mini';
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (!this.apiKey) {
      throw new Error(`${this.provider} API key not configured`);
    }

    const model = options.model ?? this.defaultModel;

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    if (options.tools && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.provider} API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? '';
    const toolCalls = choice?.message?.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      text,
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model ?? model,
      finishReason: choice?.finish_reason,
    };
  }
}

// Register adapters
registerLLMClient('openai', (config) => new OpenAICompatibleAdapter('openai', config));
registerLLMClient('vercel_ai', (config) => new OpenAICompatibleAdapter('vercel_ai', config));

export { OpenAICompatibleAdapter };
