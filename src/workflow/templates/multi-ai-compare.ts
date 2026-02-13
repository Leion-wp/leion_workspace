import type { WorkflowTemplate } from './types';

export const multiAiCompareTemplate: WorkflowTemplate = {
    id: 'multi-ai-compare',
    name: 'Compare Multiple AIs',
    description: 'Send the same prompt to two AI chat panes in parallel, merge the results, and combine into a comparison.',
    category: 'ai',
    tags: ['parallel', 'compare', 'ai', 'merge'],
    definition: {
        name: 'Compare Multiple AIs',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 200 },
                data: { label: 'Start' },
            },
            {
                id: 'ask-ai-1',
                type: 'ask',
                position: { x: 330, y: 100 },
                data: {
                    label: 'Ask AI #1',
                    chatPaneId: '',
                    chatPrompt: '{{variables.prompt}}',
                },
            },
            {
                id: 'ask-ai-2',
                type: 'ask',
                position: { x: 330, y: 300 },
                data: {
                    label: 'Ask AI #2',
                    chatPaneId: '',
                    chatPrompt: '{{variables.prompt}}',
                },
            },
            {
                id: 'merge-1',
                type: 'merge',
                position: { x: 580, y: 200 },
                data: {
                    label: 'Merge Responses',
                    mergeStrategy: 'all',
                },
            },
            {
                id: 'transform-1',
                type: 'transform',
                position: { x: 830, y: 200 },
                data: {
                    label: 'Format Comparison',
                    transformCode: `const r1 = inputs["ask-ai-1"]?.response ?? '';
const r2 = inputs["ask-ai-2"]?.response ?? '';
return {
  result: \`# AI Comparison\\n\\n## AI #1\\n\\n\${r1}\\n\\n## AI #2\\n\\n\${r2}\\n\\n## Prompt\\n\\n\${inputs.prompt ?? ''}\`
};`,
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1080, y: 200 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'ask-ai-1' },
            { id: 'e2', source: 'start-1', target: 'ask-ai-2' },
            { id: 'e3', source: 'ask-ai-1', target: 'merge-1' },
            { id: 'e4', source: 'ask-ai-2', target: 'merge-1' },
            { id: 'e5', source: 'merge-1', target: 'transform-1' },
            { id: 'e6', source: 'transform-1', target: 'end-1' },
        ],
        variables: {
            prompt: 'Explain quantum computing in 2 sentences',
        },
    },
};
