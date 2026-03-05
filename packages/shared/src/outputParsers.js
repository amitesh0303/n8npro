"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSON = parseJSON;
exports.parseEnum = parseEnum;
exports.parseNumber = parseNumber;
exports.validateRequiredFields = validateRequiredFields;
exports.jsonSchemaPromptSuffix = jsonSchemaPromptSuffix;
// ─── JSON Parser ─────────────────────────────────────────────────────────────
/**
 * Extracts JSON from an LLM response. Handles markdown code fences.
 */
function parseJSON(raw) {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
    try {
        const data = JSON.parse(cleaned);
        return { success: true, data, raw };
    }
    catch {
        // Try to extract the first JSON object or array
        const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
            try {
                const data = JSON.parse(match[1]);
                return { success: true, data, raw };
            }
            catch {
                // fall through
            }
        }
        return { success: false, raw, error: 'Failed to parse JSON from LLM response' };
    }
}
// ─── Enum Parser ─────────────────────────────────────────────────────────────
function parseEnum(raw, allowed) {
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
function parseNumber(raw) {
    const cleaned = raw.replace(/[^0-9.\-+eE]/g, '');
    const n = parseFloat(cleaned);
    if (isNaN(n)) {
        return { success: false, raw, error: `Could not parse number from "${raw}"` };
    }
    return { success: true, data: n, raw };
}
// ─── Schema Validator ─────────────────────────────────────────────────────────
/** Very lightweight "required fields" validator – not a full JSON Schema engine */
function validateRequiredFields(obj, requiredKeys) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return { success: false, raw: JSON.stringify(obj), error: 'Expected an object' };
    }
    const missing = requiredKeys.filter((k) => !(k in obj));
    if (missing.length > 0) {
        return {
            success: false,
            raw: JSON.stringify(obj),
            error: `Missing required fields: ${missing.join(', ')}`,
        };
    }
    return { success: true, data: obj, raw: JSON.stringify(obj) };
}
// ─── Prompt helpers ──────────────────────────────────────────────────────────
/** Build a prompt suffix that instructs the LLM to respond in JSON matching schema */
function jsonSchemaPromptSuffix(schema) {
    return `\n\nRespond ONLY with valid JSON that matches this schema (no markdown fences):\n${JSON.stringify(schema, null, 2)}`;
}
//# sourceMappingURL=outputParsers.js.map