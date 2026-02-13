import { type NodeProps } from 'reactflow';
import { Terminal, Copy } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function TerminalNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
    const command = data.terminalCommand ?? '';

    return (
        <BaseNode
            id={id}
            data={data}
            selected={selected}
            icon={<Terminal size={16} />}
            className="w-72"
        >
            <div className="flex flex-col gap-2">
                {command ? (
                    <div className="relative group bg-stone-950 rounded-md p-2 border border-border/50 font-mono text-[10px] text-amber-500 overflow-hidden">
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy size={10} className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(command);
                            }} />
                        </div>
                        <div className="break-all line-clamp-3">
                            {command}
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No command set</div>
                )}

                <OutputBadge nodeId={id} />
            </div>
        </BaseNode>
    );
}
