import { useState } from 'react'
import { FileCode, Activity, PlaySquare, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentStore } from '@/store/agentStore'

interface AgentWorkspaceProps {
    className?: string
    isExpanded?: boolean
    onToggleExpand?: () => void
}

type Tab = 'logs' | 'diff' | 'preview'

export function AgentWorkspace({ className, isExpanded, onToggleExpand }: AgentWorkspaceProps) {
    const [activeTab, setActiveTab] = useState<Tab>('logs')
    const { activeThreadId, threads } = useAgentStore()

    // In a real implementation, we'd derive these from the thread state or a separate store
    // For now, we'll just show placeholders

    return (
        <div className={cn("flex flex-col h-full bg-card/20 border-l border-border/40", className)}>
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40 bg-card/40 shrink-0">
                <div className="flex bg-muted/20 p-0.5 rounded-lg overflow-hidden">
                    <TabButton
                        active={activeTab === 'logs'}
                        onClick={() => setActiveTab('logs')}
                        icon={<Activity size={13} />}
                        label="Logs"
                    />
                    <TabButton
                        active={activeTab === 'diff'}
                        onClick={() => setActiveTab('diff')}
                        icon={<FileCode size={13} />}
                        label="Changes"
                    />
                    <TabButton
                        active={activeTab === 'preview'}
                        onClick={() => setActiveTab('preview')}
                        icon={<PlaySquare size={13} />}
                        label="Preview"
                    />
                </div>

                {onToggleExpand && (
                    <button
                        onClick={onToggleExpand}
                        className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4">
                {activeTab === 'logs' && (
                    <div className="font-mono text-xs text-muted-foreground space-y-1">
                        <div className="text-green-500/80">[10:42:01] Agent initialized.</div>
                        <div className="text-blue-400/80">[10:42:02] Reading workspace configuration...</div>
                        <div className="opacity-50">[10:42:03] No anomalies detected.</div>
                        <div className="text-yellow-500/80">[10:42:05] Waiting for user input...</div>

                        {!activeThreadId && (
                            <div className="mt-8 text-center opacity-40 italic">
                                No active thread. Start a new chat to see logs.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'diff' && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2">
                        <FileCode size={32} strokeWidth={1} />
                        <p className="text-xs">No pending changes to review.</p>
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2">
                        <PlaySquare size={32} strokeWidth={1} />
                        <p className="text-xs">Preview not available.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all",
                active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
        >
            {icon}
            {label}
        </button>
    )
}
