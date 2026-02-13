import type { WorkflowTemplate } from './types';

export const researchAndStoreTemplate: WorkflowTemplate = {
    id: 'research-and-store',
    name: 'Research & Store Results',
    description: 'Navigate to a URL, extract content, analyze with Claude, store findings in memory, and notify.',
    category: 'research',
    tags: ['browser', 'extract', 'ai', 'memory', 'research'],
    definition: {
        name: 'Research & Store Results',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 150 },
                data: { label: 'Start' },
            },
            {
                id: 'navigate-1',
                type: 'navigate',
                position: { x: 330, y: 150 },
                data: {
                    label: 'Navigate to URL',
                    browserPaneId: '',
                    browserUrl: '{{variables.url}}',
                },
            },
            {
                id: 'extract-1',
                type: 'extract',
                position: { x: 580, y: 150 },
                data: {
                    label: 'Extract Content',
                    browserPaneId: '',
                    browserExtractMode: 'text',
                    browserExtractSelector: 'body',
                },
            },
            {
                id: 'ask-claude-1',
                type: 'ask',
                position: { x: 830, y: 150 },
                data: {
                    label: 'Analyze Content',
                    chatPaneId: '',
                    chatPrompt: `Analyze the following content from {{variables.url}} about the topic "{{variables.topic}}".

Content:
{{steps["extract-1"].output.text}}

Provide:
1. Key findings relevant to "{{variables.topic}}"
2. Important facts and data points
3. Summary and conclusions
4. Notable quotes or sources`,
                },
            },
            {
                id: 'remember-1',
                type: 'remember',
                position: { x: 1080, y: 150 },
                data: {
                    label: 'Store Research',
                    memoryKey: 'research_{{variables.topic}}',
                    memoryValue: '{{steps["ask-claude-1"].output.response}}',
                    memoryScope: 'global',
                },
            },
            {
                id: 'notify-1',
                type: 'notify',
                position: { x: 1330, y: 150 },
                data: {
                    label: 'Notify Saved',
                    notifyTitle: 'Research Saved',
                    notifyBody: 'Research on "{{variables.topic}}" has been analyzed and stored in memory.',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1580, y: 150 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'navigate-1' },
            { id: 'e2', source: 'navigate-1', target: 'extract-1' },
            { id: 'e3', source: 'extract-1', target: 'ask-claude-1' },
            { id: 'e4', source: 'ask-claude-1', target: 'remember-1' },
            { id: 'e5', source: 'remember-1', target: 'notify-1' },
            { id: 'e6', source: 'notify-1', target: 'end-1' },
        ],
        variables: {
            url: 'https://example.com',
            topic: 'quantum',
        },
    },
};
