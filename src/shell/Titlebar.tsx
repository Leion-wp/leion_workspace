import { Minus, Moon, Square, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings'

export function Titlebar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const theme = useSettingsStore((state) => state.theme)
    const toggleTheme = useSettingsStore((state) => state.toggleTheme)
    const handleMinimize = () => window.platform?.window.minimize()
    const handleMaximize = () => window.platform?.window.maximize()
    const handleClose = () => window.platform?.window.close()

    useEffect(() => {
        let mounted = true
        window.platform?.window.getState?.().then((state) => {
            if (mounted) setIsMaximized(Boolean(state?.isMaximized))
        }).catch(() => {})

        const unsubscribe = window.platform?.window.onStateChange?.((state) => {
            setIsMaximized(Boolean(state?.isMaximized))
        })

        return () => {
            mounted = false
            unsubscribe?.()
        }
    }, [])

    return (
        <header
            className="h-8 bg-background/80 backdrop-blur-md border-b border-border/40 flex items-center justify-between select-none draggable"
            onDoubleClick={handleMaximize}
        >
            <div className="px-4 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/20" />
                Leion Workspace
            </div>
            <div className="flex h-full no-drag">
                <button
                    onClick={toggleTheme}
                    className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="Toggle theme"
                    title="Toggle theme (Ctrl+Shift+D)"
                >
                    {theme === 'dark' ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
                </button>
                <button
                    onClick={handleMinimize}
                    className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="Minimize"
                >
                    <Minus size={14} strokeWidth={1.5} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                    title={isMaximized ? "Restore window" : "Maximize window"}
                >
                    {isMaximized ? <Square size={10} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
                </button>
                <button
                    onClick={handleClose}
                    className="h-full w-12 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    aria-label="Close"
                >
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
        </header>
    )
}
