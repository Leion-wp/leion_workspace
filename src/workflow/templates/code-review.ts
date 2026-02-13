import type { WorkflowTemplate } from './types';

export const codeReviewTemplate: WorkflowTemplate = {
    id: 'code-review',
    name: 'AI Code Review',
    description: 'Run git diff and ask Claude to review the changes with issues and suggestions.',
    category: 'development',
    tags: ['git', 'ai', 'review', 'claude'],
    definition: {
        name: 'AI Code Review',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 150 },
                data: { label: 'Start' },
            },
            {
                id: 'git-diff-1',
                type: 'git-diff',
                position: { x: 330, y: 150 },
                data: {
                    label: 'Get Diff',
                    gitOperation: 'diff',
                    gitStaged: false,
                },
            },
            {
                id: 'ask-claude-1',
                type: 'ask',
                position: { x: 580, y: 150 },
                data: {
                    label: 'Ask Claude',
                    chatPaneId: '',
                    chatPrompt: 'Review this code diff:\n\n{{steps.git-diff-1.output.diff}}\n\nProvide:\n1) Summary of changes\n2) Potential issues or bugs\n3) Suggestions for improvement',
                },
            },
            {
                id: 'write-editor-1',
                type: 'write-editor',
                position: { x: 830, y: 150 },
                data: {
                    label: 'Write Review',
                    editorPaneId: '',
                    editorContent: '{{steps.ask-claude-1.output.response}}',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1080, y: 150 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'git-diff-1' },
            { id: 'e2', source: 'git-diff-1', target: 'ask-claude-1' },
            { id: 'e3', source: 'ask-claude-1', target: 'write-editor-1' },
            { id: 'e4', source: 'write-editor-1', target: 'end-1' },
        ],
        variables: {},
    },
};
