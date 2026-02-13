import { useState, useEffect, useRef } from 'react'
import { ContextMenuProvider } from '../components'
import { Pane } from '../layout/Pane'
import { useLayoutStore } from '../layout/store'
import type { PaneConfig } from '../panes/types'

/**
 * Minimal app shell for pop-out windows.
 * Renders a single pane, receives state updates from the main window via IPC.
 */
export function PopoutApp() {
    const params = new URLSearchParams(window.location.search)
    const paneId = params.get('popout') || ''
    const [title, setTitle] = useState(paneId)
    const syncFromMainRef = useRef(false)
    const hasInitialSyncRef = useRef(false)
    const paneConfig = useLayoutStore((s) => (paneId ? s.panes[paneId] : undefined))

    useEffect(() => {
        if (!paneId || !window.platform?.popout) return

        // Popout window renders only this pane (without auto-creating empty pane config).
        useLayoutStore.setState({ layout: paneId })

        // Listen for state updates from main window
        const cleanup = window.platform.popout.onStateUpdate((state: any) => {
            if (state.paneConfig) {
                const incoming = state.paneConfig as PaneConfig
                hasInitialSyncRef.current = true
                syncFromMainRef.current = true
                useLayoutStore.setState((prev) => ({
                    layout: paneId,
                    panes: { ...prev.panes, [paneId]: incoming },
                }))
                setTimeout(() => {
                    syncFromMainRef.current = false
                }, 0)
            }
            if (state.title) {
                setTitle(state.title)
                document.title = `Leion — ${state.title}`
            }
        })

        // Notify main window we're ready
        window.platform.popout.sendAction({ type: 'ready', paneId })

        return cleanup
    }, [paneId])

    // Relay local pane edits back to main renderer.
    useEffect(() => {
        if (!paneId || !paneConfig || !window.platform?.popout) return
        if (!hasInitialSyncRef.current) return
        if (syncFromMainRef.current) return
        window.platform.popout.sendAction({
            type: 'pane:update',
            paneId,
            paneConfig,
        })
    }, [paneId, paneConfig])

    if (!paneId) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-muted-foreground">
                <p>No pane specified</p>
            </div>
        )
    }

    return (
        <ContextMenuProvider>
            <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
                {/* Minimal titlebar */}
                <div className="h-8 bg-card border-b border-border/40 flex items-center px-3 select-none app-drag-region">
                    <span className="text-xs font-medium text-muted-foreground">{title}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <Pane id={paneId} />
                </div>
            </div>
        </ContextMenuProvider>
    )
}
