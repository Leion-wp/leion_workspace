import type { NodeProps } from 'reactflow';
import { GitFork } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function SubworkflowNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;

    return (
        <BaseNode
            {...props}
            icon={<GitFork size={16} />}
            className="w-64 border-l-4 border-l-indigo-500"
        >
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Subworkflow</span>
                    <Badge variant="outline" className="text-[10px] h-5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">SUB</Badge>
                </div>
                {data.subworkflowId ? (
                    <div className="text-xs font-mono text-muted-foreground p-2 bg-muted/30 rounded border border-border/30 truncate" title={data.subworkflowId}>
                        {data.subworkflowId}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No workflow selected</div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
