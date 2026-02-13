import { describe, it, expect } from 'vitest';
import { resolveValue, resolvePath } from '../DataMapper';
import type { ExecutionContext } from '../../types';

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
    return {
        workflowId: 'wf-test',
        executionId: 'exec-test',
        status: 'running',
        stepResults: {},
        variables: {},
        logs: [],
        ...overrides,
    };
}

describe('resolvePath', () => {
    it('resolves a deeply nested path', () => {
        const root = { a: { b: { c: { d: 42 } } } };
        expect(resolvePath(root, 'a.b.c.d')).toBe(42);
    });

    it('returns undefined for missing intermediate key', () => {
        const root = { a: { b: 1 } };
        expect(resolvePath(root, 'a.x.y')).toBeUndefined();
    });

    it('resolves array indices', () => {
        const root = { items: ['zero', 'one', 'two'] };
        expect(resolvePath(root, 'items.1')).toBe('one');
    });

    it('returns undefined for null root', () => {
        expect(resolvePath(null as unknown as Record<string, unknown>, 'a.b')).toBeUndefined();
    });
});

describe('resolveValue', () => {
    it('returns a plain string unchanged', () => {
        const ctx = makeContext();
        expect(resolveValue('hello world', ctx)).toBe('hello world');
    });

    it('resolves a simple step output reference', () => {
        const ctx = makeContext({
            stepResults: {
                node1: {
                    nodeId: 'node1',
                    status: 'success',
                    output: { name: 'hello' },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        expect(resolveValue('{{steps.node1.output.name}}', ctx)).toBe('hello');
    });

    it('interpolates mixed text and templates', () => {
        const ctx = makeContext({
            variables: { user: 'Alice' },
        });
        expect(resolveValue('Hello {{variables.user}}!', ctx)).toBe('Hello Alice!');
    });

    it('returns raw object when entire string is a single expression resolving to non-string', () => {
        const data = { key: 'value', nested: [1, 2, 3] };
        const ctx = makeContext({
            stepResults: {
                node1: {
                    nodeId: 'node1',
                    status: 'success',
                    output: { data },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        const result = resolveValue('{{steps.node1.output.data}}', ctx);
        expect(result).toEqual(data);
        expect(typeof result).toBe('object');
    });

    it('resolves nested objects recursively', () => {
        const ctx = makeContext({
            variables: { host: 'localhost', port: 8080 },
        });
        const input = {
            url: 'http://{{variables.host}}',
            config: {
                port: '{{variables.port}}',
            },
        };
        const result = resolveValue(input, ctx) as Record<string, unknown>;
        expect(result.url).toBe('http://localhost');
        expect((result.config as Record<string, unknown>).port).toBe(8080);
    });

    it('resolves arrays element by element', () => {
        const ctx = makeContext({
            variables: { a: 'X', b: 'Y' },
        });
        const result = resolveValue(['{{variables.a}}', '{{variables.b}}', 'static'], ctx);
        expect(result).toEqual(['X', 'Y', 'static']);
    });

    it('returns the raw template and logs a warning when the path is missing (single expression)', () => {
        const ctx = makeContext();
        expect(resolveValue('{{steps.missing.output.field}}', ctx)).toBe('{{steps.missing.output.field}}');
        expect(ctx.logs).toContain('Warning: unresolved template "{{steps.missing.output.field}}"');
    });

    it('logs a warning for each unresolved template in a mixed string', () => {
        const ctx = makeContext({ variables: { found: 'yes' } });
        const result = resolveValue('{{variables.found}} and {{variables.notfound}}', ctx);
        expect(result).toBe('yes and {{variables.notfound}}');
        expect(ctx.logs).toContain('Warning: unresolved template "{{variables.notfound}}"');
    });

    it('passes through non-string primitives unchanged', () => {
        const ctx = makeContext();
        expect(resolveValue(42, ctx)).toBe(42);
        expect(resolveValue(true, ctx)).toBe(true);
        expect(resolveValue(null, ctx)).toBeNull();
    });

    it('resolves array index in step output path', () => {
        const ctx = makeContext({
            stepResults: {
                tool1: {
                    nodeId: 'tool1',
                    status: 'success',
                    output: { content: [{ text: 'first' }, { text: 'second' }] },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        expect(resolveValue('{{steps.tool1.output.content.0.text}}', ctx)).toBe('first');
    });
});
