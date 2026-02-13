import type { NodeProps } from 'reactflow';
import { Merge } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';

export default function MergeNode(props: NodeProps<WorkflowNodeData>) {
    return (
        <BaseNode
            {...props}
            icon={<Merge size={16} />}
            className="w-48 border-l-4 border-l-purple-500"
        >
            <div className="p-4 text-sm text-muted-foreground">
                Wait for all inputs
            </div>
        </BaseNode>
    );
}
