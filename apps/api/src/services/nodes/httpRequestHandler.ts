import type {
  NodeHandler,
  NodeExecutionContext,
  NodeExecutionResult,
  HttpRequestNodeConfig,
} from '@n8npro/shared';

export const httpRequestHandler: NodeHandler = {
  kind: 'http_request',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as Partial<HttpRequestNodeConfig>;
    const { url, method = 'GET', headers = {}, body, responseType = 'json', timeoutMs = 10000 } = config;

    if (!url) {
      return { output: null, error: 'HTTP Request node requires a "url" config field' };
    }

    // Interpolate {{nodeId}} template variables from inputs
    const resolvedUrl = interpolate(url, ctx.inputs);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
      };

      if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(resolvedUrl, fetchOptions);
      const status = response.status;

      let data: unknown;
      if (responseType === 'json') {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        data = await response.text();
      }

      return {
        output: {
          status,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          ok: response.ok,
        },
      };
    } catch (err) {
      return { output: null, error: String(err) };
    } finally {
      clearTimeout(timeout);
    }
  },
};

function interpolate(template: string, inputs: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = inputs[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
