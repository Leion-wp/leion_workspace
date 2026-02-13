import { useCallback } from 'react'
import { Mosaic, MosaicWindow, type MosaicBranch, type MosaicNode } from 'react-mosaic-component'
import { useLayoutStore, PaneId, type Space } from './store'
import type { PaneConfig } from '../panes/types'
import { Pane, getPaneTitle } from './Pane'
import { PANE_TYPES } from '../panes'
import { CustomToolbar } from './CustomToolbar'
import { SmartClipboard } from './SmartClipboard'

interface SpaceMosaicProps {
    space: Space
    isActive: boolean
    activeLayout: MosaicNode<PaneId> | null
    activePanes: Record<PaneId, PaneConfig>
}

function SpaceMosaic({ space, isActive, activeLayout, activePanes }: SpaceMosaicProps) {
    const setLayout = useLayoutStore((s) => s.setLayout)
    const togglePaneCollapse = useLayoutStore((s) => s.togglePaneCollapse)

    const layout = isActive ? activeLayout : space.layout
    const panes = isActive ? activePanes : space.panes

    const renderTile = useCallback((id: PaneId, path: MosaicBranch[]) => {
        const pane = panes[id]
        const type = pane?.type || 'empty'
        const icon = PANE_TYPES[type]?.icon || '📦'
        const title = `${icon} ${getPaneTitle(id, type)} `

        return (
            <MosaicWindow<PaneId>
                path={path}
                title={title}
                createNode={() => `pane - ${Date.now()} `}
                renderToolbar={(props) => {
                    // Find the pane ID at this path to get its state
                    const paneId = getLeafNode(layout, props.path)
                    const currentPaneConfig = typeof paneId === 'string' ? panes[paneId] : null

                    return (
                        <div
                            style={{ width: '100%', height: '100%' }}
                            draggable={props.draggable}
                            onDragStart={props.onDragStart}
                            onDragEnd={() => props.onDragEnd?.('reset')}
                        >
                            <CustomToolbar
                                title={props.title}
                                path={props.path}
                                paneId={typeof paneId === 'string' ? paneId : undefined}
                                collapsed={currentPaneConfig?.collapsed}
                                onToggleCollapse={() => paneId && typeof paneId === 'string' && togglePaneCollapse(paneId)}
                            />
                        </div>
                    )
                }}
            >
                <Pane id={id} paneConfig={isActive ? undefined : pane} />
            </MosaicWindow>
        )
    }, [panes, isActive, layout, togglePaneCollapse])

    return (
        <div style={{ position: 'absolute', inset: 0, display: isActive ? 'block' : 'none' }}>
            <Mosaic<PaneId>
                renderTile={renderTile}
                value={layout}
                onChange={isActive ? setLayout : () => { }}
                className="mosaic-blueprint-theme"
            />
        </div>
    )
}

// Helper to find node at path
function getLeafNode(root: MosaicNode<PaneId> | null | undefined, path: MosaicBranch[]): MosaicNode<PaneId> | null {
    if (!root) return null
    let current = root
    for (const direction of path) {
        if (typeof current !== 'object') return null
        current = direction === 'first' ? current.first : current.second
    }
    return current
}

export function LayoutManager() {
    const spaces = useLayoutStore((state) => state.spaces)
    const activeSpaceId = useLayoutStore((state) => state.activeSpaceId)
    const layout = useLayoutStore((state) => state.layout)
    const panes = useLayoutStore((state) => state.panes)

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {spaces.map((space) => (
                <SpaceMosaic
                    key={space.id}
                    space={space}
                    isActive={space.id === activeSpaceId}
                    activeLayout={layout}
                    activePanes={panes}
                />
            ))}
            <SmartClipboard />
        </div>
    )
}
