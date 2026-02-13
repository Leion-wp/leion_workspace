import { type NodeProps } from 'reactflow';
import { Flag } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';

export default function EndNode(props: NodeProps<WorkflowNodeData>) {

    return (
        <BaseNode
            {...props}
            icon={<Flag size={16} fill="currentColor" />}
            className="w-48 border-r-4 border-r-primary"
            showSourceHandle={false}
        >
            <div className="text-xs text-muted-foreground">
                Workflow Completed
            </div>
        </BaseNode>
    );
}
