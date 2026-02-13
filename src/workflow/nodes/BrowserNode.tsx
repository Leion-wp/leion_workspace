import type { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function BrowserNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const urlPreview = data.browserUrl
        ? (data.browserUrl.length > 30 ? data.browserUrl.slice(0, 30) + '\u2026' : data.browserUrl)
        : null;

    return (
        <BaseNode
            {...props}
            icon={<Globe size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-2">
                {urlPreview ? (
                    <div className="text-xs font-mono text-muted-foreground truncate p-2 bg-muted/30 rounded border border-border/30" title={data.browserUrl}>
                        {urlPreview}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No URL configured</div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
