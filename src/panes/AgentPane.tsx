import { useEffect, useRef } from 'react'
import { AgentLayout } from './agent/AgentLayout'
import { useAgentStore } from '@/store/agentStore'
import { usePaneStateStore } from './paneStateStore'

export interface AgentPaneProps {
    id: string
    data?: Record<string, unknown>
    onUpdate?: (data: Record<string, unknown>) => void
}

export function AgentPane({ id, data, onUpdate }: AgentPaneProps) {
    const {
        activeThreadId,
        mode,
        threads,
        projects,
        settings,
        globalEnv,
        isThinking,
        switchThread,
        hydrateThreads
    } = useAgentStore()

    // Initial Hydration from saved layout data (if any)
    const initialHydrationDone = useRef(false)
    useEffect(() => {
        if (!initialHydrationDone.current) {
            if (data) {
                hydrateThreads(
                    Array.isArray(data.threads) ? data.threads as any[] : [],
                    Array.isArray(data.projects) ? data.projects as any[] : [],
                    typeof data.settings === 'object' ? data.settings as any : undefined,
                    typeof data.globalEnv === 'object' ? data.globalEnv as any : undefined
                )
            }

            if (data?.activeThreadId && typeof data.activeThreadId === 'string') {
                switchThread(data.activeThreadId)
            }
            initialHydrationDone.current = true
        }
    }, [data, switchThread, hydrateThreads])

    // Sync state for layout persistence
    useEffect(() => {
        if (onUpdate) {
            const timeout = setTimeout(() => {
                onUpdate({
                    activeThreadId,
                    mode,
                    threads,
                    projects,
                    settings,
                    globalEnv
                })
            }, 1000) // Debounce
            return () => clearTimeout(timeout)
        }
    }, [activeThreadId, mode, threads, projects, settings, globalEnv, onUpdate])

    // Publish ambient state to workspace (for status bar etc)
    useEffect(() => {
        usePaneStateStore.getState().setPaneState(id, {
            type: 'agent',
            brain: 'codex', // Fixed to Codex/Agent unified for now
            lastResponse: threads.find(t => t.id === activeThreadId)?.messages.slice(-1)[0]?.content || '',
            isThinking,
            messageCount: threads.find(t => t.id === activeThreadId)?.messages.length || 0,
        })
        return () => usePaneStateStore.getState().removePaneState(id)
    }, [id, activeThreadId, threads, isThinking])

    return (
        <AgentLayout />
    )
}
