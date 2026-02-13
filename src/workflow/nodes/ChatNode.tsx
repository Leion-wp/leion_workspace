import { type NodeProps } from 'reactflow';
import { MessageSquare, Bot } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function ChatNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
    const provider = data.chatProvider ?? 'Claude';
    const prompt = data.chatPrompt;

    return (
        <BaseNode
            id={id}
            data={data}
            selected={selected}
            icon={<MessageSquare size={16} />}
            className="w-72"
            headerAction={
                <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1 border border-primary/20">
                    <Bot size={10} />
                    {provider}
                </div>
            }
        >
            <div className="flex flex-col gap-2">
                {prompt ? (
                    <div className="bg-muted/40 rounded-md p-2 border border-border/50 text-[10px] text-muted-foreground line-clamp-3">
                        {prompt}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No prompt set</div>
                )}
                <OutputBadge nodeId={id} />
            </div>
        </BaseNode>
    );
}
