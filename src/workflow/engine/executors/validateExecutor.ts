import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Validate node (SHAPE — pure, no I/O).
 * Validates a value against a JSON schema using simple manual validation
 * (no external dependencies like ajv).
 *
 * Output: { valid: boolean, errors: string[] }
 */
export async function executeValidateNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const rawInput = node.data.validateInput ?? '';
    const rawSchema = node.data.validateSchema ?? '{}';

    const resolvedInput = resolveValue(rawInput, context);
    const resolvedSchema = String(resolveValue(rawSchema, context));

    context.logs.push(`Validate: checking input against schema`);

    // Parse the input value
    let inputValue: unknown;
    if (typeof resolvedInput === 'string') {
        try {
            inputValue = JSON.parse(resolvedInput);
        } catch {
            inputValue = resolvedInput;
        }
    } else {
        inputValue = resolvedInput;
    }

    // Parse the schema
    let schema: Record<string, unknown>;
    try {
        schema = JSON.parse(resolvedSchema) as Record<string, unknown>;
    } catch {
        return { valid: false, errors: ['Invalid JSON schema: failed to parse'] };
    }

    const errors = validateAgainstSchema(inputValue, schema, '');

    return { valid: errors.length === 0, errors };
}

/**
 * Simple JSON schema validator.
 * Supports: type, required, properties, items, enum, minimum, maximum,
 * minLength, maxLength, pattern.
 */
function validateAgainstSchema(
    value: unknown,
    schema: Record<string, unknown>,
    path: string,
): string[] {
    const errors: string[] = [];
    const prefix = path || 'root';

    // Type check
    if (schema.type) {
        const expectedType = schema.type as string;
        const actualType = getJsonType(value);

        if (expectedType === 'integer') {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                errors.push(`${prefix}: expected integer, got ${actualType}`);
                return errors;
            }
        } else if (actualType !== expectedType) {
            errors.push(`${prefix}: expected ${expectedType}, got ${actualType}`);
            return errors;
        }
    }

    // Enum check
    if (Array.isArray(schema.enum)) {
        const enumValues = schema.enum as unknown[];
        if (!enumValues.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
            errors.push(`${prefix}: value not in enum [${enumValues.map((e) => JSON.stringify(e)).join(', ')}]`);
        }
    }

    // String constraints
    if (typeof value === 'string') {
        if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
            errors.push(`${prefix}: string length ${value.length} < minLength ${schema.minLength}`);
        }
        if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
            errors.push(`${prefix}: string length ${value.length} > maxLength ${schema.maxLength}`);
        }
        if (typeof schema.pattern === 'string') {
            try {
                const regex = new RegExp(schema.pattern);
                if (!regex.test(value)) {
                    errors.push(`${prefix}: string does not match pattern "${schema.pattern}"`);
                }
            } catch {
                errors.push(`${prefix}: invalid regex pattern "${schema.pattern}"`);
            }
        }
    }

    // Number constraints
    if (typeof value === 'number') {
        if (typeof schema.minimum === 'number' && value < schema.minimum) {
            errors.push(`${prefix}: value ${value} < minimum ${schema.minimum}`);
        }
        if (typeof schema.maximum === 'number' && value > schema.maximum) {
            errors.push(`${prefix}: value ${value} > maximum ${schema.maximum}`);
        }
    }

    // Object: required + properties
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;

        if (Array.isArray(schema.required)) {
            for (const key of schema.required as string[]) {
                if (!(key in obj)) {
                    errors.push(`${prefix}: missing required property "${key}"`);
                }
            }
        }

        if (schema.properties && typeof schema.properties === 'object') {
            const props = schema.properties as Record<string, Record<string, unknown>>;
            for (const [key, propSchema] of Object.entries(props)) {
                if (key in obj) {
                    errors.push(
                        ...validateAgainstSchema(obj[key], propSchema, `${prefix}.${key}`),
                    );
                }
            }
        }
    }

    // Array: items
    if (Array.isArray(value) && schema.items && typeof schema.items === 'object') {
        const itemSchema = schema.items as Record<string, unknown>;
        for (let i = 0; i < value.length; i++) {
            errors.push(
                ...validateAgainstSchema(value[i], itemSchema, `${prefix}[${i}]`),
            );
        }

        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            errors.push(`${prefix}: array length ${value.length} < minItems ${schema.minItems}`);
        }
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
            errors.push(`${prefix}: array length ${value.length} > maxItems ${schema.maxItems}`);
        }
    }

    return errors;
}

function getJsonType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value; // 'string' | 'number' | 'boolean' | 'object' | 'undefined'
}
