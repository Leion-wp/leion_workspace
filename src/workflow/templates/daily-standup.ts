import type { WorkflowTemplate } from './types';

export const dailyStandupTemplate: WorkflowTemplate = {
    id: 'daily-standup',
    name: 'Daily Standup Report',
    description: 'Gather git status, diff, and yesterday\'s tasks, generate a standup report with Claude, save it, and store for tomorrow.',
    category: 'automation',
    tags: ['git', 'standup', 'report', 'ai', 'memory'],
    definition: {
        name: 'Daily Standup Report',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 200 },
                data: { label: 'Start' },
            },
            {
                id: 'git-status-1',
                type: 'git-status',
                position: { x: 330, y: 200 },
                data: {
                    label: 'Git Status',
                    gitOperation: 'status',
                },
            },
            {
                id: 'git-diff-1',
                type: 'git-diff',
                position: { x: 580, y: 200 },
                data: {
                    label: 'Git Diff',
                    gitOperation: 'diff',
                    gitStaged: false,
                },
            },
            {
                id: 'recall-1',
                type: 'recall',
                position: { x: 830, y: 200 },
                data: {
                    label: 'Recall Yesterday',
                    memoryKey: 'yesterday_tasks',
                    memoryScope: 'global',
                },
            },
            {
                id: 'ask-claude-1',
                type: 'ask',
                position: { x: 1080, y: 200 },
                data: {
                    label: 'Generate Standup',
                    chatPaneId: '',
                    chatPrompt: `Create a concise daily standup report in markdown format.

Git Status:
{{steps["git-status-1"].output.status}}

Recent Changes (diff summary):
{{steps["git-diff-1"].output.diff}}

Yesterday's tasks (from memory):
{{steps["recall-1"].output.value}}

Format:
## Daily Standup - {{date}}

### Yesterday
- [what was done]

### Today
- [planned work based on context]

### Blockers
- [any issues visible in the diff/status]`,
                },
            },
            {
                id: 'write-file-1',
                type: 'write-file',
                position: { x: 1330, y: 200 },
                data: {
                    label: 'Save Standup',
                    filePath: 'standup.md',
                    fileContent: '{{steps["ask-claude-1"].output.response}}',
                },
            },
            {
                id: 'remember-1',
                type: 'remember',
                position: { x: 1580, y: 200 },
                data: {
                    label: 'Store for Tomorrow',
                    memoryKey: 'yesterday_tasks',
                    memoryValue: '{{steps["ask-claude-1"].output.response}}',
                    memoryScope: 'global',
                },
            },
            {
                id: 'notify-1',
                type: 'notify',
                position: { x: 1830, y: 200 },
                data: {
                    label: 'Notify',
                    notifyTitle: 'Standup Ready',
                    notifyBody: 'Your daily standup report has been generated and saved to standup.md',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 2080, y: 200 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'git-status-1' },
            { id: 'e2', source: 'git-status-1', target: 'git-diff-1' },
            { id: 'e3', source: 'git-diff-1', target: 'recall-1' },
            { id: 'e4', source: 'recall-1', target: 'ask-claude-1' },
            { id: 'e5', source: 'ask-claude-1', target: 'write-file-1' },
            { id: 'e6', source: 'write-file-1', target: 'remember-1' },
            { id: 'e7', source: 'remember-1', target: 'notify-1' },
            { id: 'e8', source: 'notify-1', target: 'end-1' },
        ],
        variables: {},
    },
};
