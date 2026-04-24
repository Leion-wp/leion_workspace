import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { ThreadSidebar } from './ThreadSidebar'
import { ChatArea } from './ChatArea'
import { AgentWorkspace } from './AgentWorkspace'
import { AgentSettingsModal } from './AgentSettingsModal'
import { useAgentStore } from '@/store/agentStore'
import { cn } from '@/lib/utils'

export function AgentLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [workspaceOpen, setWorkspaceOpen] = useState(true)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const { initializeCodexListeners, createThread, threads } = useAgentStore()

    // Initialize Codex Listener on mount
    useEffect(() => {
        const cleanup = initializeCodexListeners()
        return cleanup
    }, [initializeCodexListeners])

    // Auto-create thread if none exists
    useEffect(() => {
        if (threads.length === 0) {
            createThread()
        }
    }, [threads.length, createThread])

    return (
        <div className="flex h-full w-full overflow-hidden bg-background relative">
            <AgentSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Sidebar */}
            <div
                className={cn(
                    "transition-all duration-300 ease-in-out border-r border-border/40 bg-card/10 shrink-0 relative",
                    sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 overflow-hidden"
                )}
            >
                <ThreadSidebar
                    className="h-full w-64"
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background relative transition-all duration-300">

                {/* Mobile/Toggle Header Overlay */}
                <div className="absolute top-2 left-2 z-20">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground transition-colors shadow-sm bg-background/50 backdrop-blur-sm border border-border/20"
                        title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                    >
                        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                    </button>
                </div>

                <div className="absolute top-2 right-2 z-20">
                    <button
                        onClick={() => setWorkspaceOpen(!workspaceOpen)}
                        className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground transition-colors shadow-sm bg-background/50 backdrop-blur-sm border border-border/20"
                        title={workspaceOpen ? "Close Workspace" : "Open Workspace"}
                    >
                        {workspaceOpen ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
                    </button>
                </div>

                {/* Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Chat Area */}
                    <div className={cn(
                        "flex-1 h-full transition-all duration-300 min-w-0",
                        workspaceOpen ? "basis-1/2" : "basis-full"
                    )}>
                        <ChatArea className="h-full" />
                    </div>

                    {/* Workspace Area */}
                    <div className={cn(
                        "transition-all duration-300 ease-in-out border-l border-border/40 shrink-0 bg-card/20",
                        workspaceOpen ? "basis-1/2 translate-x-0 opacity-100" : "w-0 translate-x-full opacity-0 overflow-hidden"
                    )}>
                        <AgentWorkspace className="h-full w-full" />
                    </div>
                </div>
            </div>
        </div>
    )
}
