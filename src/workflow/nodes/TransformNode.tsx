import type { NodeProps } from 'reactflow';
import { Code } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function TransformNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;

    return (
        <BaseNode
            {...props}
            icon={<Code size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-2">
                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-words max-h-24 overflow-hidden text-ellipsis">
                    {data.transformCode || '// No code set'}
                </div>
            </div>

            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
