import type { WorkflowTemplate } from './types';

export const errorDebugTemplate: WorkflowTemplate = {
    id: 'error-debug',
    name: 'Error Debug Loop',
    description: 'Run a command, detect errors, ask Claude for a fix, apply to editor, and notify when resolved.',
    category: 'development',
    tags: ['debug', 'ai', 'error', 'loop', 'fix'],
    definition: {
        name: 'Error Debug Loop',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 200 },
                data: { label: 'Start' },
            },
            {
                id: 'run-1',
                type: 'run',
                position: { x: 330, y: 200 },
                data: {
                    label: 'Run Command',
                    terminalPaneId: '',
                    terminalCommand: '{{variables.command}}',
                    continueOnError: true,
                },
            },
            {
                id: 'if-error-1',
                type: 'if',
                position: { x: 580, y: 200 },
                data: {
                    label: 'Has Error?',
                    conditionExpression: 'steps["run-1"].output.exitCode !== 0',
                },
            },
            {
                id: 'ask-debug-1',
                type: 'ask',
                position: { x: 830, y: 100 },
                data: {
                    label: 'Debug with Claude',
                    chatPaneId: '',
                    chatPrompt: `Analyze this build/run error and provide a specific fix:

Command: {{variables.command}}

Output:
{{steps["run-1"].output.stdout}}

Error:
{{steps["run-1"].output.stderr}}

Provide:
1. Root cause explanation
2. Exact fix with code changes
3. Steps to verify the fix`,
                },
            },
            {
                id: 'write-fix-1',
                type: 'write-editor',
                position: { x: 1080, y: 100 },
                data: {
                    label: 'Write Fix',
                    editorPaneId: '',
                    editorContent: '{{steps["ask-debug-1"].output.response}}',
                },
            },
            {
                id: 'notify-success-1',
                type: 'notify',
                position: { x: 830, y: 300 },
                data: {
                    label: 'Success',
                    notifyTitle: 'Build Succeeded',
                    notifyBody: 'Command completed without errors.',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1330, y: 200 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'run-1' },
            { id: 'e2', source: 'run-1', target: 'if-error-1' },
            { id: 'e3', source: 'if-error-1', target: 'ask-debug-1', sourceHandle: 'true', label: 'Error' },
            { id: 'e4', source: 'if-error-1', target: 'notify-success-1', sourceHandle: 'false', label: 'Success' },
            { id: 'e5', source: 'ask-debug-1', target: 'write-fix-1' },
            { id: 'e6', source: 'write-fix-1', target: 'end-1' },
            { id: 'e7', source: 'notify-success-1', target: 'end-1' },
        ],
        variables: {
            command: 'npm run build',
        },
    },
};
