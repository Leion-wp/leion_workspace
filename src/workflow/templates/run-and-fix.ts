import type { WorkflowTemplate } from './types';

export const runAndFixTemplate: WorkflowTemplate = {
    id: 'run-and-fix',
    name: 'Run Tests & Auto-fix',
    description: 'Run npm test, detect errors with AI, apply a fix, and re-run until passing.',
    category: 'development',
    tags: ['testing', 'ai', 'auto-fix', 'npm'],
    definition: {
        name: 'Run Tests & Auto-fix',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 200 },
                data: { label: 'Start' },
            },
            {
                id: 'run-test-1',
                type: 'run',
                position: { x: 330, y: 200 },
                data: {
                    label: 'Run Tests',
                    terminalPaneId: '',
                    terminalCommand: 'npm test',
                    continueOnError: true,
                },
            },
            {
                id: 'if-error-1',
                type: 'if',
                position: { x: 580, y: 200 },
                data: {
                    label: 'Has Errors?',
                    conditionExpression: 'steps["run-test-1"].output.exitCode !== 0',
                },
            },
            {
                id: 'ask-fix-1',
                type: 'ask',
                position: { x: 830, y: 100 },
                data: {
                    label: 'Ask Claude to Fix',
                    chatPaneId: '',
                    chatPrompt: 'The following test run failed. Please provide a fix:\n\n{{steps["run-test-1"].output.stdout}}\n\nStderr:\n{{steps["run-test-1"].output.stderr}}\n\nExplain the fix and provide corrected code.',
                },
            },
            {
                id: 'write-fix-1',
                type: 'write-editor',
                position: { x: 1080, y: 100 },
                data: {
                    label: 'Apply Fix',
                    editorPaneId: '',
                    editorContent: '{{steps["ask-fix-1"].output.response}}',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 830, y: 300 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'run-test-1' },
            { id: 'e2', source: 'run-test-1', target: 'if-error-1' },
            { id: 'e3', source: 'if-error-1', target: 'ask-fix-1', sourceHandle: 'true', label: 'Has errors' },
            { id: 'e4', source: 'if-error-1', target: 'end-1', sourceHandle: 'false', label: 'Passed' },
            { id: 'e5', source: 'ask-fix-1', target: 'write-fix-1' },
            { id: 'e6', source: 'write-fix-1', target: 'end-1' },
        ],
        variables: {},
    },
};
