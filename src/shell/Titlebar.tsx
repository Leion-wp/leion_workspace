import { Minus, Square, X } from 'lucide-react'

export function Titlebar() {
    const handleMinimize = () => window.platform?.window.minimize()
    const handleMaximize = () => window.platform?.window.maximize()
    const handleClose = () => window.platform?.window.close()

    return (
        <header className="h-8 bg-background/80 backdrop-blur-md border-b border-border/40 flex items-center justify-between select-none draggable">
            <div className="px-4 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/20" />
                Leion Workspace
            </div>
            <div className="flex h-full no-drag">
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
                    aria-label="Maximize"
                >
                    <Square size={12} strokeWidth={1.5} />
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
