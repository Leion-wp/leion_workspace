import { Handle, Position, type NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';

export default function ConditionNode(props: NodeProps<WorkflowNodeData>) {
    const { data } = props;

    return (
        <BaseNode
            {...props}
            icon={<GitBranch size={16} />}
            className="w-64 border-l-4 border-l-amber-500"
            showSourceHandle={false} // We custom render source handles
        >
            <div className="p-4 space-y-2">
                <div className="text-sm text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-all">
                    {data.conditionExpression || 'No condition set'}
                </div>

                <div className="relative h-12 mt-2">
                    <div className="absolute right-[-34px] top-2 flex items-center">
                        <span className="text-xs font-semibold text-green-500 mr-2">True</span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="true"
                            className="!w-4 !h-4 !bg-green-500 !border-2 !border-background"
                        />
                    </div>

                    <div className="absolute right-[-34px] bottom-2 flex items-center">
                        <span className="text-xs font-semibold text-red-500 mr-2">False</span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="false"
                            className="!w-4 !h-4 !bg-red-500 !border-2 !border-background"
                        />
                    </div>
                </div>
            </div>
        </BaseNode>
    );
}
