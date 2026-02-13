import type { ExecutionContext } from '../types';

const INTERPOLATION_PATTERN = /\{\{([\w.\-]+)\}\}/g;
const SINGLE_EXPRESSION_PATTERN = /^\{\{([\w.\-]+)\}\}$/;

/**
 * Walk an object tree by dot-separated path segments.
 * Returns undefined when any intermediate key is missing.
 */
export function resolvePath(root: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = root;

    for (const segment of segments) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;

        // Handle numeric array indices (e.g. "content.0.text")
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (Number.isNaN(index)) return undefined;
            current = current[index];
        } else {
            current = (current as Record<string, unknown>)[segment];
        }
    }

    return current;
}

/**
 * Build the lookup root from an ExecutionContext.
 * Shape: { steps: { [nodeId]: { output, status, ... } }, variables: { ... } }
 */
function buildLookupRoot(context: ExecutionContext): Record<string, unknown> {
    return {
        steps: context.stepResults as unknown as Record<string, unknown>,
        variables: context.variables,
        env: context.envVars ?? {},
        panes: context.paneStates ?? {},
    };
}

/**
 * Interpolate template expressions in a string.
 * If the entire string is a single expression (e.g. "{{steps.x.output.data}}")
 * and the resolved value is not a string, returns the raw value (preserves objects/numbers).
 * Logs a warning to context.logs when a template path cannot be resolved.
 */
function interpolateString(template: string, context: ExecutionContext): unknown {
    const root = buildLookupRoot(context);

    // Fast path: entire string is a single expression → preserve raw type
    const singleMatch = SINGLE_EXPRESSION_PATTERN.exec(template);
    if (singleMatch) {
        const resolved = resolvePath(root, singleMatch[1]);
        if (resolved !== undefined) return resolved;
        context.logs.push(`Warning: unresolved template "{{${singleMatch[1]}}}"`);
        return template;
    }

    // General case: replace all expressions within the string
    return template.replace(INTERPOLATION_PATTERN, (_match, path: string) => {
        const resolved = resolvePath(root, path);
        if (resolved === undefined) {
            context.logs.push(`Warning: unresolved template "{{${path}}}"`);
            return _match;
        }
        if (typeof resolved === 'string') return resolved;
        return JSON.stringify(resolved);
    });
}

/**
 * Recursively resolve template expressions within a value.
 * - Strings: interpolated via {{...}} syntax
 * - Arrays: each element resolved recursively
 * - Plain objects: each value resolved recursively
 * - Primitives (number, boolean, null): returned as-is
 */
export function resolveValue(value: unknown, context: ExecutionContext): unknown {
    if (typeof value === 'string') {
        return interpolateString(value, context);
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolveValue(item, context));
    }

    if (value !== null && typeof value === 'object') {
        const resolved: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            resolved[key] = resolveValue(val, context);
        }
        return resolved;
    }

    return value;
}
