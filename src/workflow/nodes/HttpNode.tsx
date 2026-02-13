import type { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function HttpNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const method = data.httpMethod ?? 'GET';
    const url = data.httpUrl ?? '';
    const preview = url.length > 28 ? url.slice(0, 28) + '…' : url;

    return (
        <BaseNode
            {...props}
            icon={<Globe size={16} />}
            className="w-72"
        >
            <div className="p-4 space-y-2">
                {url ? (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Badge variant={method === 'GET' ? 'classic' : 'destructive'} className="text-[10px] px-1 py-0 h-5">
                                {method}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground truncate" title={url}>
                                {preview}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No URL configured</div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
