import type { ParsedOutput } from './types.js';
/**
 * Extracts JSON from an LLM response. Handles markdown code fences.
 */
export declare function parseJSON<T = unknown>(raw: string): ParsedOutput<T>;
export declare function parseEnum<T extends string>(raw: string, allowed: readonly T[]): ParsedOutput<T>;
export declare function parseNumber(raw: string): ParsedOutput<number>;
/** Very lightweight "required fields" validator – not a full JSON Schema engine */
export declare function validateRequiredFields<T extends Record<string, unknown>>(obj: unknown, requiredKeys: string[]): ParsedOutput<T>;
/** Build a prompt suffix that instructs the LLM to respond in JSON matching schema */
export declare function jsonSchemaPromptSuffix(schema: Record<string, unknown>): string;
