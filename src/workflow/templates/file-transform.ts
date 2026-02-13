import type { WorkflowTemplate } from './types';

export const fileTransformTemplate: WorkflowTemplate = {
    id: 'file-transform',
    name: 'Batch File Transform',
    description: 'Read a file, remove empty lines via transform, and write the cleaned result to an output path.',
    category: 'files',
    tags: ['file', 'transform', 'batch', 'text'],
    definition: {
        name: 'Batch File Transform',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 150 },
                data: { label: 'Start' },
            },
            {
                id: 'read-file-1',
                type: 'read-file',
                position: { x: 330, y: 150 },
                data: {
                    label: 'Read Input File',
                    filePath: '{{variables.input_path}}',
                },
            },
            {
                id: 'transform-1',
                type: 'transform',
                position: { x: 580, y: 150 },
                data: {
                    label: 'Remove Empty Lines',
                    transformCode: `const content = inputs.content ?? '';
const cleaned = content.split('\\n').filter(l => l.trim()).join('\\n');
return { content: cleaned, lineCount: cleaned.split('\\n').length };`,
                },
            },
            {
                id: 'write-file-1',
                type: 'write-file',
                position: { x: 830, y: 150 },
                data: {
                    label: 'Write Output File',
                    filePath: '{{variables.output_path}}',
                    fileContent: '{{steps["transform-1"].output.content}}',
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
            { id: 'e1', source: 'start-1', target: 'read-file-1' },
            { id: 'e2', source: 'read-file-1', target: 'transform-1' },
            { id: 'e3', source: 'transform-1', target: 'write-file-1' },
            { id: 'e4', source: 'write-file-1', target: 'end-1' },
        ],
        variables: {
            input_path: '/path/to/input.txt',
            output_path: '/path/to/output.txt',
        },
    },
};
