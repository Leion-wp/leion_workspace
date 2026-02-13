import type { WorkflowDefinition } from '../types';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'development' | 'research' | 'automation' | 'ai' | 'files';
    tags: string[];
    definition: Omit<WorkflowDefinition, 'id'>;
}
