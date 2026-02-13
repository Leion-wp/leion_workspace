import { useState, useEffect } from 'react'
import { ContextMenuProvider } from '../components'
import { Pane } from '../layout/Pane'
import type { PaneConfig } from '../panes/types'

/**
 * Minimal app shell for pop-out windows.
 * Renders a single pane, receives state updates from the main window via IPC.
 */
export function PopoutApp() {
    const params = new URLSearchParams(window.location.search)
    const paneId = params.get('popout') || ''
    const [paneConfig, setPaneConfig] = useState<PaneConfig | null>(null)
    const [title, setTitle] = useState(paneId)

    useEffect(() => {
        if (!paneId || !window.platform?.popout) return

        // Listen for state updates from main window
        const cleanup = window.platform.popout.onStateUpdate((state: any) => {
            if (state.paneConfig) {
                setPaneConfig(state.paneConfig)
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
                    <Pane id={paneId} paneConfig={paneConfig ?? undefined} />
                </div>
            </div>
        </ContextMenuProvider>
    )
}
