import type { LLMClient, LLMGenerateOptions, LLMGenerateResult } from '@n8npro/shared';
import { registerLLMClient } from '@n8npro/shared';

/**
 * LangChain-style adapter stub.
 * In a full implementation this would use @langchain/core LLM wrappers.
 * For V0 it demonstrates the integration pattern with a direct HTTP call.
 */
class LangChainAdapter implements LLMClient {
  provider: 'langchain' = 'langchain';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: Record<string, string>) {
    this.apiKey = config['apiKey'] ?? '';
    this.baseUrl = config['baseUrl'] ?? 'https://api.openai.com/v1';
    this.defaultModel = config['model'] ?? 'gpt-4o-mini';
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    /**
     * LangChain pattern: build a chain from prompt template + LLM + output parser.
     * V0 implements the HTTP call directly; V1 would use @langchain/openai ChatOpenAI.
     *
     * Example LangChain chain (pseudocode):
     *   const llm = new ChatOpenAI({ apiKey, model });
     *   const chain = RunnableSequence.from([systemPromptTemplate, llm, outputParser]);
     *   const result = await chain.invoke({ input: userMessage });
     */

    if (!this.apiKey) {
      throw new Error('LangChain adapter: API key not configured');
    }

    // Delegate to OpenAI-compatible endpoint for now
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? this.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LangChain adapter error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model ?? this.defaultModel,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }
}

registerLLMClient('langchain', (config) => new LangChainAdapter(config));

export { LangChainAdapter };
