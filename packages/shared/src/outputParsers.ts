import type { ParsedOutput } from './types.js';

// ─── JSON Parser ─────────────────────────────────────────────────────────────

/**
 * Extracts JSON from an LLM response. Handles markdown code fences.
 */
export function parseJSON<T = unknown>(raw: string): ParsedOutput<T> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return { success: true, data, raw };
  } catch {
    // Try to extract the first JSON object or array
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        const data = JSON.parse(match[1]) as T;
        return { success: true, data, raw };
      } catch {
        // fall through
      }
    }
    return { success: false, raw, error: 'Failed to parse JSON from LLM response' };
  }
}

// ─── Enum Parser ─────────────────────────────────────────────────────────────

export function parseEnum<T extends string>(
  raw: string,
  allowed: readonly T[]
): ParsedOutput<T> {
  const trimmed = raw.trim().toLowerCase();
  const match = allowed.find((v) => v.toLowerCase() === trimmed);
  if (match) {
    return { success: true, data: match, raw };
  }
  return {
    success: false,
    raw,
    error: `Expected one of [${allowed.join(', ')}], got "${trimmed}"`,
  };
}

// ─── Numeric Parser ──────────────────────────────────────────────────────────

export function parseNumber(raw: string): ParsedOutput<number> {
  const cleaned = raw.replace(/[^0-9.\-+eE]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) {
    return { success: false, raw, error: `Could not parse number from "${raw}"` };
  }
  return { success: true, data: n, raw };
}

// ─── Schema Validator ─────────────────────────────────────────────────────────

/** Very lightweight "required fields" validator – not a full JSON Schema engine */
export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: string[]
): ParsedOutput<T> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { success: false, raw: JSON.stringify(obj), error: 'Expected an object' };
  }
  const missing = requiredKeys.filter((k) => !(k in (obj as Record<string, unknown>)));
  if (missing.length > 0) {
    return {
      success: false,
      raw: JSON.stringify(obj),
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }
  return { success: true, data: obj as T, raw: JSON.stringify(obj) };
}

// ─── Prompt helpers ──────────────────────────────────────────────────────────

/** Build a prompt suffix that instructs the LLM to respond in JSON matching schema */
export function jsonSchemaPromptSuffix(schema: Record<string, unknown>): string {
  return `\n\nRespond ONLY with valid JSON that matches this schema (no markdown fences):\n${JSON.stringify(schema, null, 2)}`;
}
