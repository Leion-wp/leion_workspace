import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Diff node (SHAPE — pure, no I/O).
 * Compares two values and reports differences.
 * Modes: text, json, lines.
 *
 * Output: { equal: boolean, differences: string[], inputA: unknown, inputB: unknown }
 */
export async function executeDiffNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const mode = node.data.diffMode ?? 'text';
    const rawA = node.data.diffInputA ?? '';
    const rawB = node.data.diffInputB ?? '';

    const inputA = resolveValue(rawA, context);
    const inputB = resolveValue(rawB, context);

    context.logs.push(`Diff: mode="${mode}"`);

    switch (mode) {
        case 'text': {
            const strA = String(inputA);
            const strB = String(inputB);
            const equal = strA === strB;
            const differences: string[] = [];

            if (!equal) {
                // Find first differing position for context
                let firstDiff = 0;
                while (firstDiff < strA.length && firstDiff < strB.length && strA[firstDiff] === strB[firstDiff]) {
                    firstDiff++;
                }

                differences.push(`First difference at character ${firstDiff}`);
                differences.push(`  A[${firstDiff}..]: "${strA.slice(firstDiff, firstDiff + 40)}${strA.length > firstDiff + 40 ? '...' : ''}"`);
                differences.push(`  B[${firstDiff}..]: "${strB.slice(firstDiff, firstDiff + 40)}${strB.length > firstDiff + 40 ? '...' : ''}"`);

                if (strA.length !== strB.length) {
                    differences.push(`Length: A=${strA.length}, B=${strB.length}`);
                }
            }

            return { equal, differences, inputA: strA, inputB: strB };
        }

        case 'json': {
            let objA: unknown;
            let objB: unknown;

            try {
                objA = typeof inputA === 'string' ? JSON.parse(inputA) : inputA;
            } catch {
                throw new Error(`Diff node "${node.id}": inputA is not valid JSON`);
            }

            try {
                objB = typeof inputB === 'string' ? JSON.parse(inputB) : inputB;
            } catch {
                throw new Error(`Diff node "${node.id}": inputB is not valid JSON`);
            }

            const differences = deepCompare(objA, objB, '');
            const equal = differences.length === 0;

            return { equal, differences, inputA: objA, inputB: objB };
        }

        case 'lines': {
            const linesA = String(inputA).split('\n');
            const linesB = String(inputB).split('\n');
            const differences: string[] = [];

            const maxLen = Math.max(linesA.length, linesB.length);
            for (let i = 0; i < maxLen; i++) {
                const lineA = i < linesA.length ? linesA[i] : undefined;
                const lineB = i < linesB.length ? linesB[i] : undefined;

                if (lineA === undefined) {
                    differences.push(`Line ${i + 1}: added "${lineB}"`);
                } else if (lineB === undefined) {
                    differences.push(`Line ${i + 1}: removed "${lineA}"`);
                } else if (lineA !== lineB) {
                    differences.push(`Line ${i + 1}: changed "${lineA}" -> "${lineB}"`);
                }
            }

            const equal = differences.length === 0;
            return { equal, differences, inputA: linesA, inputB: linesB };
        }

        default:
            throw new Error(`Diff node "${node.id}": unknown mode "${mode}"`);
    }
}

/**
 * Deep structural comparison of two values.
 * Returns an array of human-readable difference descriptions.
 */
function deepCompare(a: unknown, b: unknown, path: string): string[] {
    const prefix = path || '$';

    if (a === b) return [];

    if (a === null || b === null || typeof a !== typeof b) {
        return [`${prefix}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`];
    }

    if (typeof a !== 'object') {
        return [`${prefix}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`];
    }

    const differences: string[] = [];

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            differences.push(`${prefix}: array length ${a.length} !== ${b.length}`);
        }
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i++) {
            if (i >= a.length) {
                differences.push(`${prefix}[${i}]: missing in A, present in B`);
            } else if (i >= b.length) {
                differences.push(`${prefix}[${i}]: present in A, missing in B`);
            } else {
                differences.push(...deepCompare(a[i], b[i], `${prefix}[${i}]`));
            }
        }
        return differences;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
        return [`${prefix}: type mismatch (array vs object)`];
    }

    // Both are objects
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
        const keyPath = `${prefix}.${key}`;
        if (!(key in objA)) {
            differences.push(`${keyPath}: missing in A, present in B`);
        } else if (!(key in objB)) {
            differences.push(`${keyPath}: present in A, missing in B`);
        } else {
            differences.push(...deepCompare(objA[key], objB[key], keyPath));
        }
    }

    return differences;
}
