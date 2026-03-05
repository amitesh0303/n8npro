import type {
  NodeHandler,
  NodeExecutionContext,
  NodeExecutionResult,
  TransformNodeConfig,
  FilterNodeConfig,
  AggregateNodeConfig,
  AggregateOperation,
} from '@n8npro/shared';

function getFirstInput(ctx: NodeExecutionContext): unknown {
  const vals = Object.values(ctx.inputs);
  return vals.length > 0 ? vals[0] : null;
}

// ─── Transform Node ──────────────────────────────────────────────────────────

export const transformHandler: NodeHandler = {
  kind: 'transform',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as Partial<TransformNodeConfig>;
    const { expression } = config;
    if (!expression) {
      return { output: null, error: 'Transform node requires an "expression" config field' };
    }

    const input = getFirstInput(ctx);
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('input', `"use strict"; return (${expression})(input)`);
      const output = fn(input) as unknown;
      return { output };
    } catch (err) {
      return { output: null, error: `Transform expression error: ${String(err)}` };
    }
  },
};

// ─── Filter Node ─────────────────────────────────────────────────────────────

export const filterHandler: NodeHandler = {
  kind: 'filter',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as Partial<FilterNodeConfig>;
    const { condition } = config;
    if (!condition) {
      return { output: null, error: 'Filter node requires a "condition" config field' };
    }

    const input = getFirstInput(ctx);
    if (!Array.isArray(input)) {
      return { output: null, error: 'Filter node requires an array input' };
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('item', `"use strict"; return (${condition})(item)`);
      const output = (input as unknown[]).filter((item) => fn(item) as boolean);
      return { output };
    } catch (err) {
      return { output: null, error: `Filter condition error: ${String(err)}` };
    }
  },
};

// ─── Aggregate Node ──────────────────────────────────────────────────────────

export const aggregateHandler: NodeHandler = {
  kind: 'aggregate',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as Partial<AggregateNodeConfig>;
    const { operation = 'count', field, separator = ', ' } = config;

    const input = getFirstInput(ctx);
    if (!Array.isArray(input)) {
      return { output: null, error: 'Aggregate node requires an array input' };
    }

    const arr = input as unknown[];
    const values: number[] = field
      ? arr.map((item) => {
          if (typeof item === 'object' && item !== null) {
            const v = (item as Record<string, unknown>)[field];
            return typeof v === 'number' ? v : parseFloat(String(v));
          }
          return parseFloat(String(item));
        })
      : arr.map((item) => (typeof item === 'number' ? item : parseFloat(String(item))));

    const output = applyAggregation(operation, arr, values, separator);
    return { output };
  },
};

function applyAggregation(
  operation: AggregateOperation,
  arr: unknown[],
  numericValues: number[],
  separator: string
): unknown {
  switch (operation) {
    case 'count':
      return arr.length;
    case 'sum':
      return numericValues.reduce((a, b) => a + b, 0);
    case 'average':
      return arr.length === 0 ? 0 : numericValues.reduce((a, b) => a + b, 0) / arr.length;
    case 'min':
      return arr.length === 0 ? null : Math.min(...numericValues);
    case 'max':
      return arr.length === 0 ? null : Math.max(...numericValues);
    case 'join':
      return arr.map(String).join(separator);
    case 'first':
      return arr[0] ?? null;
    case 'last':
      return arr[arr.length - 1] ?? null;
    default:
      return null;
  }
}

// ─── Code Node ───────────────────────────────────────────────────────────────

export const codeHandler: NodeHandler = {
  kind: 'code',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = ctx.config as { code?: string };
    const { code } = config;
    if (!code) {
      return { output: null, error: 'Code node requires a "code" config field' };
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('inputs', `"use strict"; ${code}`);
      const output = fn(ctx.inputs) as unknown;
      return { output };
    } catch (err) {
      return { output: null, error: `Code node error: ${String(err)}` };
    }
  },
};

// ─── Output Node ─────────────────────────────────────────────────────────────

export const outputHandler: NodeHandler = {
  kind: 'output',

  async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
    // Pass inputs through as output (used to collect final results)
    const vals = Object.values(ctx.inputs);
    return { output: vals.length === 1 ? vals[0] : vals };
  },
};
