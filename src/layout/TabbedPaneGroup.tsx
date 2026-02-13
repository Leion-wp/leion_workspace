import { X } from 'lucide-react'
import { useLayoutStore } from './store'
import { Pane } from './Pane'
import { PANE_TYPES } from '../panes'
import { useShortcutsStore } from '../hooks/useShortcuts'
import { cn } from '../lib/utils'

export interface TabGroup {
    id: string
    paneIds: string[]
    activeId: string
}

interface TabbedPaneGroupProps {
    group: TabGroup
}

export function TabbedPaneGroup({ group }: TabbedPaneGroupProps) {
    const panes = useLayoutStore(s => s.panes)
    const setActiveTab = useLayoutStore(s => s.setActiveTab)
    const removeFromTabGroup = useLayoutStore(s => s.removeFromTabGroup)
    const setActivePane = useShortcutsStore(s => s.setActivePane)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {/* Tab bar */}
            <div className="flex items-center h-7 bg-card/80 border-b border-border/40 overflow-x-auto shrink-0">
                {group.paneIds.map(paneId => {
                    const pane = panes[paneId]
                    const type = pane?.type || 'empty'
                    const typeInfo = PANE_TYPES[type]
                    const isActive = paneId === group.activeId

                    return (
                        <div
                            key={paneId}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer border-r border-border/30 transition-colors group/tab shrink-0',
                                isActive
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                            )}
                            onClick={() => {
                                setActiveTab(group.id, paneId)
                                setActivePane(paneId)
                            }}
                        >
                            <span className="text-[11px]">{typeInfo?.icon || '📦'}</span>
                            <span className="truncate max-w-24">{pane?.title || typeInfo?.label || paneId}</span>
                            {group.paneIds.length > 1 && (
                                <button
                                    className="opacity-0 group-hover/tab:opacity-100 transition-opacity ml-1 hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeFromTabGroup(group.id, paneId)
                                    }}
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Content — render all, show active (keeps webviews alive) */}
            <div style={{ flex: 1, position: 'relative' }}>
                {group.paneIds.map(paneId => (
                    <div
                        key={paneId}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: paneId === group.activeId ? 'block' : 'none',
                        }}
                    >
                        <Pane id={paneId} />
                    </div>
                ))}
            </div>
        </div>
    )
}
