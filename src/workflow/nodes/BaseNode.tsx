import { ReactNode, useState } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Loader, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkflowNodeData, WorkflowNodeType } from '../types';

interface BaseNodeProps extends NodeProps<WorkflowNodeData> {
    icon?: ReactNode;
    children?: ReactNode;
    headerAction?: ReactNode;
    className?: string;
    showTargetHandle?: boolean;
    showSourceHandle?: boolean;
    targetHandleId?: string;
    sourceHandleId?: string;
}

const getNodeCategoryColor = (type?: string) => {
    const t = type as WorkflowNodeType || '';

    // CONTROL FLOW (Pink/Rose)
    if (['start', 'end', 'condition', 'merge', 'loop', 'if', 'switch', 'race', 'repeat', 'pause', 'delay'].includes(t)) {
        return {
            border: 'border-pink-500/50',
            header: 'bg-pink-500/10 border-pink-500/20',
            icon: 'text-pink-500 bg-pink-500/20',
            glow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]'
        };
    }
    // DATA / IO / MEMORY (Blue)
    if (['database', 'file', 'read-file', 'write-file', 'memory-read', 'memory-write', 'variable', 'recall', 'remember', 'list-files'].includes(t)) {
        return {
            border: 'border-blue-500/50',
            header: 'bg-blue-500/10 border-blue-500/20',
            icon: 'text-blue-500 bg-blue-500/20',
            glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
        };
    }
    // EXTERNAL / NETWORK / BROWSER (Green/Emerald)
    if (['http', 'browser', 'fetch', 'navigate', 'click', 'fill', 'execute-js', 'screenshot'].includes(t)) {
        return {
            border: 'border-emerald-500/50',
            header: 'bg-emerald-500/10 border-emerald-500/20',
            icon: 'text-emerald-500 bg-emerald-500/20',
            glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
        };
    }
    // COMPUTE / TRANSFORM (Purple/Violet)
    if (['transform', 'format', 'validate', 'parse', 'diff'].includes(t)) {
        return {
            border: 'border-violet-500/50',
            header: 'bg-violet-500/10 border-violet-500/20',
            icon: 'text-violet-500 bg-violet-500/20',
            glow: 'shadow-[0_0_15px_rgba(139,92,246,0.15)]'
        };
    }
    // INTEGRATIONS (Orange/Amber)
    if (['terminal', 'editor', 'chat', 'git', 'notify', 'run', 'write-editor'].includes(t)) {
        return {
            border: 'border-orange-500/50',
            header: 'bg-orange-500/10 border-orange-500/20',
            icon: 'text-orange-500 bg-orange-500/20',
            glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]'
        };
    }
    // SUBWORKFLOW / SPECIAL (Teal/Cyan)
    if (['subworkflow', 'space'].includes(t)) {
        return {
            border: 'border-cyan-500/50',
            header: 'bg-cyan-500/10 border-cyan-500/20',
            icon: 'text-cyan-500 bg-cyan-500/20',
            glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]'
        };
    }

    // DEFAULT (Slate)
    return {
        border: 'border-border',
        header: 'bg-secondary/30 border-border/50',
        icon: 'text-muted-foreground bg-secondary',
        glow: ''
    };
};

export function BaseNode({
    type,
    data,
    selected,
    icon,
    children,
    headerAction,
    className,
    showTargetHandle = true,
    showSourceHandle = true,
    targetHandleId,
    sourceHandleId,
}: BaseNodeProps) {
    const status = data.executionStatus;
    const [collapsed, setCollapsed] = useState(false);

    const colors = getNodeCategoryColor(type);

    return (
        <>
            <NodeResizer
                isVisible={selected && !collapsed}
                minWidth={200}
                minHeight={80}
                lineClassName="border-primary opacity-50"
                handleClassName="h-3 w-3 bg-primary border-2 border-background rounded"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                    "relative min-w-[200px] rounded-xl border-2 bg-card/98 shadow-sm transition-all duration-200 group",
                    // Selection overrides default border
                    selected ? "border-primary ring-2 ring-primary/20" : colors.border,
                    // Status overrides everything
                    status === 'running' && "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]",
                    status === 'success' && "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]",
                    status === 'error' && "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]",
                    // Category glow if selected or hovered
                    (selected || !status) && colors.glow,
                    className
                )}
            >
                {/* Luminous Dot for Status */}
                {status && (
                    <div className={cn(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background z-20 shadow-sm",
                        status === 'running' && "bg-amber-400 animate-pulse box-shadow-[0_0_8px_rgba(251,191,36,0.8)]",
                        status === 'success' && "bg-green-500 box-shadow-[0_0_8px_rgba(34,197,94,0.8)]",
                        status === 'error' && "bg-red-500 box-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                    )} />
                )}

                {/* Header */}
                <div
                    className={cn(
                        "flex items-center gap-3 px-4 py-2 border-b transition-colors rounded-t-[10px]",
                        colors.header,
                        status === 'running' && "bg-amber-400/10 border-amber-400/20",
                        status === 'success' && "bg-green-500/10 border-green-400/20",
                        status === 'error' && "bg-red-500/10 border-red-400/20",
                        collapsed && "border-b-0 rounded-b-[10px]"
                    )}
                    onDoubleClick={() => setCollapsed(!collapsed)}
                >
                    {/* Collapser */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
                        className="text-muted-foreground hover:text-foreground transition-colors -ml-1"
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className={cn(
                        "flex items-center justify-center p-1.5 rounded-lg transition-colors",
                        colors.icon,
                        status === 'running' && "bg-amber-400/20 text-amber-500",
                        status === 'success' && "bg-green-500/20 text-green-500",
                        status === 'error' && "bg-red-500/20 text-red-500",
                    )}>
                        {status === 'running' ? <Loader className="w-4 h-4 animate-spin" /> :
                            status === 'success' ? <CheckCircle className="w-4 h-4" /> :
                                status === 'error' ? <XCircle className="w-4 h-4" /> :
                                    icon}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate leading-tight select-none">
                            {data.label}
                        </h3>
                        {!collapsed && (
                            <p className="text-[10px] text-muted-foreground truncate select-none">
                                {data.description || type}
                            </p>
                        )}
                    </div>

                    {headerAction}
                </div>

                {/* Content */}
                <AnimatePresence>
                    {!collapsed && children && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 text-xs space-y-2">
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Handles */}
                {showTargetHandle && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        id={targetHandleId}
                        className={cn(
                            "!w-3 !h-3 !border-2 !border-background transition-all -ml-[7px] z-10",
                            "!bg-muted-foreground/50 hover:!bg-primary hover:scale-125"
                        )}
                    />
                )}
                {showSourceHandle && (
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={sourceHandleId}
                        className={cn(
                            "!w-3 !h-3 !border-2 !border-background transition-all -mr-[7px] z-10",
                            "!bg-muted-foreground/50 hover:!bg-primary hover:scale-125"
                        )}
                    />
                )}
            </motion.div>
        </>
    );
}
