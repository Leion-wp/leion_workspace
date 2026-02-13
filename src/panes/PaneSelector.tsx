import { PANE_TYPES, type PaneType } from './types'
import { cn } from '../lib/utils'

interface PaneSelectorProps {
    currentType: PaneType
    onSelect: (type: PaneType) => void
}

export function PaneSelector({ currentType, onSelect }: PaneSelectorProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-5 bg-background text-foreground">
            <div className="text-muted-foreground text-sm mb-2">
                Select pane type:
            </div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
                {Object.entries(PANE_TYPES).map(([type, { label, icon }]) => (
                    <button
                        key={type}
                        onClick={() => onSelect(type as PaneType)}
                        className={cn(
                            "flex flex-col items-center gap-2 p-6 rounded-xl border transition-all duration-200 cursor-pointer",
                            currentType === type
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20 hover:shadow-sm"
                        )}
                    >
                        <span className="text-3xl mb-1">{icon}</span>
                        <span className="text-sm font-medium">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

