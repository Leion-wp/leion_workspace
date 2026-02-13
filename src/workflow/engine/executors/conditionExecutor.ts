import type { Node } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutorDependencies,
} from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Evaluate a condition node's expression and return { result: boolean }.
 *
 * The conditionExpression can use {{template}} syntax which gets resolved first.
 * After resolution, the expression is evaluated as a boolean:
 * - Strings: 'true', '1', non-empty → true; 'false', '0', empty → false
 * - Numbers: non-zero → true
 * - Objects/arrays: always true
 * - null/undefined: false
 *
 * When conditionMode === 'switch', evaluates each case expression and returns
 * { result: true/false, matchedCase: label, matchedIndex: number }.
 */
export async function executeConditionNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { conditionMode = 'binary', conditionCases } = node.data;

    if (conditionMode === 'switch') {
        if (!conditionCases || conditionCases.length === 0) {
            throw new Error(`Condition node "${node.id}" in switch mode has no cases configured`);
        }

        for (let i = 0; i < conditionCases.length; i++) {
            const { expression, label } = conditionCases[i];
            if (!expression?.trim()) continue;

            const resolved = resolveValue(expression, context);
            const matches = evaluateAsBoolean(resolved);

            context.logs.push(
                `Condition "${node.id}" switch case ${i} ("${label}"): ${JSON.stringify(resolved)} → ${matches}`
            );

            if (matches) {
                return { result: true, matchedCase: label, matchedIndex: i };
            }
        }

        context.logs.push(`Condition "${node.id}" switch: no case matched`);
        return { result: false, matchedCase: null, matchedIndex: -1 };
    }

    // Binary mode (default)
    const expression = node.data.conditionExpression ?? '';

    if (!expression.trim()) {
        throw new Error(`Condition node "${node.id}" has no expression`);
    }

    // Resolve templates in the expression
    const resolved = resolveValue(expression, context);

    // Evaluate the resolved value as a boolean
    const result = evaluateAsBoolean(resolved);

    context.logs.push(`Condition "${node.id}": expression resolved to ${JSON.stringify(resolved)} → ${result}`);

    return { result };
}

/**
 * Coerce a resolved value to a boolean.
 * - Strings "true"/"false"/"1"/"0" are parsed explicitly.
 * - Other strings: non-empty → true.
 * - Everything else: standard JS truthiness.
 */
function evaluateAsBoolean(value: unknown): boolean {
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === 'true' || trimmed === '1') return true;
        if (trimmed === 'false' || trimmed === '0' || trimmed === '') return false;
        // Non-empty string that isn't explicitly false
        return true;
    }
    return Boolean(value);
}
