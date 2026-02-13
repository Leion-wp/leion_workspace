import type { WorkflowTemplate } from './types';

export const webResearchTemplate: WorkflowTemplate = {
    id: 'web-research',
    name: 'Web Research & Summary',
    description: 'Navigate to a URL, extract all text, summarize with Claude, and save to a markdown file.',
    category: 'research',
    tags: ['browser', 'extract', 'ai', 'summary', 'markdown'],
    definition: {
        name: 'Web Research & Summary',
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
                    label: 'Navigate',
                    browserPaneId: '',
                    browserUrl: '{{variables.url}}',
                },
            },
            {
                id: 'extract-1',
                type: 'extract',
                position: { x: 580, y: 150 },
                data: {
                    label: 'Extract Text',
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
                    label: 'Summarize',
                    chatPaneId: '',
                    chatPrompt: 'Summarize the following web page content into a concise markdown document with key points, main topics, and important details:\n\n{{steps["extract-1"].output.text}}',
                },
            },
            {
                id: 'write-file-1',
                type: 'write-file',
                position: { x: 1080, y: 150 },
                data: {
                    label: 'Save Summary',
                    filePath: 'summary.md',
                    fileContent: '{{steps["ask-claude-1"].output.response}}',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1330, y: 150 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'navigate-1' },
            { id: 'e2', source: 'navigate-1', target: 'extract-1' },
            { id: 'e3', source: 'extract-1', target: 'ask-claude-1' },
            { id: 'e4', source: 'ask-claude-1', target: 'write-file-1' },
            { id: 'e5', source: 'write-file-1', target: 'end-1' },
        ],
        variables: {
            url: 'https://example.com',
        },
    },
};
