import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Format node (SHAPE — pure, no I/O).
 * Performs string formatting operations: template interpolation, join, split,
 * uppercase, lowercase, and trim.
 *
 * Output: { result: string | string[], operation: string }
 */
export async function executeFormatNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const operation = node.data.formatOperation ?? 'template';
    const rawInput = node.data.formatInput ?? '';
    const input = resolveValue(rawInput, context);
    const separator = node.data.formatSeparator ?? ',';

    context.logs.push(`Format: operation="${operation}"`);

    switch (operation) {
        case 'template': {
            const template = node.data.formatTemplate ?? '';
            const result = String(resolveValue(template, context));
            return { result, operation };
        }

        case 'join': {
            // Input should resolve to an array; if string, try JSON.parse
            let items: unknown[];
            if (Array.isArray(input)) {
                items = input;
            } else {
                const inputStr = String(input);
                try {
                    const parsed = JSON.parse(inputStr);
                    items = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    // Treat as single-element array
                    items = [inputStr];
                }
            }
            const result = items.map(String).join(separator);
            return { result, operation };
        }

        case 'split': {
            const inputStr = String(input);
            const result = inputStr.split(separator);
            return { result, operation };
        }

        case 'uppercase': {
            const result = String(input).toUpperCase();
            return { result, operation };
        }

        case 'lowercase': {
            const result = String(input).toLowerCase();
            return { result, operation };
        }

        case 'trim': {
            const result = String(input).trim();
            return { result, operation };
        }

        default:
            throw new Error(`Format node "${node.id}": unknown operation "${operation}"`);
    }
}
