import type { MosaicNode } from 'react-mosaic-component'
import { useShortcutsStore } from '../hooks/useShortcuts'
import { useFusionStore } from '../panes/fusionStore'
import { usePaneStateStore } from '../panes/paneStateStore'
import { useBroadcastStore } from './broadcastStore'
import { getAllPaneIds, useLayoutStore, type PaneId } from './store'

function removeFromLayout(node: MosaicNode<PaneId> | null, idToRemove: PaneId): MosaicNode<PaneId> | null {
    if (!node) return null
    if (typeof node === 'string') return node === idToRemove ? null : node

    const first = removeFromLayout(node.first, idToRemove)
    const second = removeFromLayout(node.second, idToRemove)

    if (!first) return second
    if (!second) return first
    return { ...node, first, second }
}

function replaceNodeId(
    node: MosaicNode<PaneId> | null,
    idToReplace: PaneId,
    replacement: PaneId
): MosaicNode<PaneId> | null {
    if (!node) return null
    if (typeof node === 'string') return node === idToReplace ? replacement : node
    return {
        ...node,
        first: replaceNodeId(node.first, idToReplace, replacement)!,
        second: replaceNodeId(node.second, idToReplace, replacement)!,
    }
}

function getLivePaneIds(layout: MosaicNode<PaneId> | null, tabGroups: ReturnType<typeof useLayoutStore.getState>['tabGroups']): PaneId[] {
    return getAllPaneIds(layout).flatMap((paneId) => tabGroups[paneId]?.paneIds ?? [paneId])
}

function normalizePaneId(
    paneId: string | null | undefined,
    tabGroups: ReturnType<typeof useLayoutStore.getState>['tabGroups']
): PaneId | null {
    if (!paneId) return null
    if (tabGroups[paneId]) return tabGroups[paneId].activeId
    return paneId
}

export function resolvePaneToClose(preferredPaneId?: string | null): PaneId | null {
    const { layout, tabGroups } = useLayoutStore.getState()
    if (!layout) return null

    const livePaneIds = getLivePaneIds(layout, tabGroups)
    if (livePaneIds.length <= 1) return null

    const normalizedPreferred = normalizePaneId(preferredPaneId, tabGroups)
    if (normalizedPreferred && livePaneIds.includes(normalizedPreferred)) {
        return normalizedPreferred
    }

    const activePaneId = normalizePaneId(useShortcutsStore.getState().activePane, tabGroups)
    if (activePaneId && livePaneIds.includes(activePaneId)) {
        return activePaneId
    }

    return livePaneIds[livePaneIds.length - 1] ?? null
}

export function closePaneWithCleanup(paneId: PaneId): boolean {
    const { layout, tabGroups, setLayout } = useLayoutStore.getState()
    if (!layout) return false

    const paneToClose = normalizePaneId(paneId, tabGroups)
    if (!paneToClose) return false

    const livePaneIds = getLivePaneIds(layout, tabGroups)
    if (livePaneIds.length <= 1) return false

    const parentGroup = Object.values(tabGroups).find((group) => group.paneIds.includes(paneToClose))
    if (parentGroup) {
        const remaining = parentGroup.paneIds.filter((id) => id !== paneToClose)

        if (remaining.length === 0) {
            setLayout(removeFromLayout(layout, parentGroup.id))
            useLayoutStore.setState((state) => {
                const nextGroups = { ...state.tabGroups }
                delete nextGroups[parentGroup.id]
                return { tabGroups: nextGroups }
            })
        } else if (remaining.length === 1) {
            setLayout(replaceNodeId(layout, parentGroup.id, remaining[0]))
            useLayoutStore.setState((state) => {
                const nextGroups = { ...state.tabGroups }
                delete nextGroups[parentGroup.id]
                return { tabGroups: nextGroups }
            })
        } else {
            useLayoutStore.setState((state) => ({
                tabGroups: {
                    ...state.tabGroups,
                    [parentGroup.id]: {
                        ...parentGroup,
                        paneIds: remaining,
                        activeId: parentGroup.activeId === paneToClose ? remaining[0] : parentGroup.activeId,
                    },
                },
            }))
        }
    } else {
        setLayout(removeFromLayout(layout, paneToClose))
    }

    useFusionStore.getState().unlinkPane(paneToClose)
    useBroadcastStore.getState().removePane(paneToClose)
    usePaneStateStore.getState().removePaneState(paneToClose)

    const activePane = useShortcutsStore.getState().activePane
    if (activePane === paneToClose) {
        const nextState = useLayoutStore.getState()
        const nextLivePaneIds = getLivePaneIds(nextState.layout, nextState.tabGroups)
        useShortcutsStore.getState().setActivePane(nextLivePaneIds[0] ?? null)
    }

    return true
}
