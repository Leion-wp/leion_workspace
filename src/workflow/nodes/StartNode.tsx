import { type NodeProps } from 'reactflow';
import { Play } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';

export default function StartNode(props: NodeProps<WorkflowNodeData>) {

    return (
        <BaseNode
            {...props}
            icon={<Play size={16} fill="currentColor" />}
            className="w-48 border-l-4 border-l-primary"
            showTargetHandle={false}
        >
            <div className="text-xs text-muted-foreground">
                Workflow Entry Point
            </div>
        </BaseNode>
    );
}
