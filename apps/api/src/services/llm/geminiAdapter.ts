import type { LLMClient, LLMGenerateOptions, LLMGenerateResult } from '@n8npro/shared';
import { registerLLMClient } from '@n8npro/shared';

/**
 * Google Gemini adapter.
 * Uses the @google/generative-ai SDK when available.
 * Falls back gracefully if SDK is not installed.
 */
class GeminiAdapter implements LLMClient {
  provider: 'gemini' = 'gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(config: Record<string, string>) {
    this.apiKey = config['apiKey'] ?? '';
    this.defaultModel = config['model'] ?? 'gemini-1.5-flash';
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = options.model ?? this.defaultModel;

    // Build messages into Gemini format
    const systemInstruction = options.messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const contents = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const requestBody = {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    return {
      text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      model,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }
}

// Register the adapter
registerLLMClient('gemini', (config) => new GeminiAdapter(config));

export { GeminiAdapter };
