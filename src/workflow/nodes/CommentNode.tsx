import type { NodeProps } from 'reactflow';
import { StickyNote } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';

export default function CommentNode(props: NodeProps<WorkflowNodeData>) {
    const { data } = props;

    return (
        <BaseNode
            {...props}
            icon={<StickyNote size={16} />}
            className="w-56 bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
            showSourceHandle={false}
            showTargetHandle={false}
        >
            <div className="p-4 pt-0 text-sm text-foreground/80 whitespace-pre-wrap">
                {data.description || 'Add a note...'}
            </div>
        </BaseNode>
    );
}
