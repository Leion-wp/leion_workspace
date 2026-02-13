import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Parse node (SHAPE — pure, no I/O).
 * Parses structured text into JavaScript values.
 * Formats: json, csv, lines, key-value.
 *
 * Output: { parsed: unknown, format: string }
 */
export async function executeParseNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const format = node.data.parseFormat ?? 'json';
    const rawInput = node.data.parseInput ?? '';
    const input = String(resolveValue(rawInput, context));

    context.logs.push(`Parse: format="${format}"`);

    switch (format) {
        case 'json': {
            try {
                const parsed = JSON.parse(input);
                return { parsed, format };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                throw new Error(`Parse node "${node.id}": invalid JSON — ${message}`);
            }
        }

        case 'csv': {
            const lines = input.split('\n').filter((line) => line.trim().length > 0);
            if (lines.length === 0) {
                return { parsed: [], format };
            }

            const headers = parseCsvLine(lines[0]);
            const rows = lines.slice(1).map((line) => {
                const values = parseCsvLine(line);
                const row: Record<string, string> = {};
                headers.forEach((header, i) => {
                    row[header.trim()] = (values[i] ?? '').trim();
                });
                return row;
            });

            return { parsed: rows, format, headers };
        }

        case 'lines': {
            const parsed = input.split('\n');
            return { parsed, format };
        }

        case 'key-value': {
            const parsed: Record<string, string> = {};
            const lines = input.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex === -1) continue;
                const key = trimmed.slice(0, eqIndex).trim();
                const value = trimmed.slice(eqIndex + 1).trim();
                parsed[key] = value;
            }
            return { parsed, format };
        }

        default:
            throw new Error(`Parse node "${node.id}": unknown format "${format}"`);
    }
}

/**
 * Simple CSV line parser that handles quoted fields with commas inside.
 */
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                // Check for escaped quote ""
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                fields.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }

    fields.push(current);
    return fields;
}
