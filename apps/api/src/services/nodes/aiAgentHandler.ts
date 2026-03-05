import type {
  NodeHandler,
  NodeExecutionContext,
  NodeExecutionResult,
  AIAgentNodeConfig,
  LLMGenerateOptions,
} from '@n8npro/shared';
import { createLLMClient, parseJSON, jsonSchemaPromptSuffix } from '@n8npro/shared';
import { prisma } from '../../db/prisma.js';

export const aiAgentHandler: NodeHandler = {
  kind: 'ai_agent',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as Partial<AIAgentNodeConfig>;
    const {
      provider = 'mock',
      model,
      systemPrompt = 'You are a helpful assistant.',
      userPromptTemplate,
      temperature,
      maxTokens,
      outputSchema,
      outputFormat = 'text',
    } = config;

    // Build user prompt from template or stringify inputs
    const inputData = Object.values(ctx.inputs).length === 1
      ? Object.values(ctx.inputs)[0]
      : ctx.inputs;

    let userPrompt = userPromptTemplate
      ? interpolate(userPromptTemplate, ctx.inputs, inputData)
      : `Process the following input:\n${JSON.stringify(inputData, null, 2)}`;

    // If structured output requested, append schema instructions
    let finalSystemPrompt = systemPrompt;
    if (outputFormat === 'json' && outputSchema) {
      finalSystemPrompt += jsonSchemaPromptSuffix(outputSchema);
    }

    // Load credentials from DB if available
    let credConfig: Record<string, string> = {};
    try {
      const nodeWorkflow = await prisma.node.findFirst({
        where: { id: ctx.nodeId },
        select: { workflowId: true },
      });
      if (nodeWorkflow) {
        const workflow = await prisma.workflow.findUnique({
          where: { id: nodeWorkflow.workflowId },
          select: { workspaceId: true },
        });
        if (workflow) {
          const cred = await prisma.credential.findFirst({
            where: { workspaceId: workflow.workspaceId, type: provider },
          });
          if (cred) {
            credConfig = JSON.parse(cred.data) as Record<string, string>;
          }
        }
      }
    } catch {
      // credentials not found; use mock
    }

    let client;
    try {
      client = createLLMClient(provider, credConfig);
    } catch {
      // Fall back to mock for V0
      const { mockLLMClient } = await import('../../services/llm/mockAdapter.js');
      client = mockLLMClient;
    }

    const options: LLMGenerateOptions = {
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model,
      temperature,
      maxTokens,
      responseFormat: outputFormat,
    };

    try {
      const result = await client.generate(options);

      if (outputFormat === 'json') {
        const parsed = parseJSON(result.text);
        if (parsed.success) {
          return { output: { result: parsed.data, raw: result.text, usage: result.usage } };
        }
        return {
          output: { result: result.text, raw: result.text, usage: result.usage },
          error: `JSON parse failed: ${parsed.error}`,
        };
      }

      return { output: { result: result.text, usage: result.usage } };
    } catch (err) {
      return { output: null, error: `LLM call failed: ${String(err)}` };
    }
  },
};

function interpolate(template: string, inputs: Record<string, unknown>, inputData: unknown): string {
  let result = template;
  // Replace {{input}} with entire input data
  result = result.replace(/\{\{input\}\}/g, JSON.stringify(inputData));
  // Replace {{nodeId.field}} or {{nodeId}}
  for (const [key, val] of Object.entries(inputs)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), JSON.stringify(val));
  }
  return result;
}
