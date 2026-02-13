import { create } from 'zustand'
import { usePaneControlBus } from '../panes/paneControlBus'

interface BroadcastGroup {
    id: string
    paneIds: Set<string>
}

interface BroadcastState {
    groups: Record<string, BroadcastGroup>
    paneGroupMap: Record<string, string> // paneId -> groupId

    toggleBroadcast: (paneId: string, paneType: 'chat' | 'terminal') => void
    broadcast: (fromPaneId: string, content: string) => void
    isBroadcasting: (paneId: string) => boolean
    removePane: (paneId: string) => void
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
    groups: {},
    paneGroupMap: {},

    toggleBroadcast: (paneId, paneType) => {
        const { groups, paneGroupMap } = get()

        // If already in a group, remove
        if (paneGroupMap[paneId]) {
            const groupId = paneGroupMap[paneId]
            const group = groups[groupId]
            if (group) {
                const newPaneIds = new Set(group.paneIds)
                newPaneIds.delete(paneId)

                const newPaneGroupMap = { ...paneGroupMap }
                delete newPaneGroupMap[paneId]

                if (newPaneIds.size === 0) {
                    const newGroups = { ...groups }
                    delete newGroups[groupId]
                    set({ groups: newGroups, paneGroupMap: newPaneGroupMap })
                } else {
                    set({
                        groups: { ...groups, [groupId]: { ...group, paneIds: newPaneIds } },
                        paneGroupMap: newPaneGroupMap,
                    })
                }
            }
            return
        }

        // Find an existing group for this pane type, or create one
        const channelId = `broadcast-${paneType}`
        const existing = groups[channelId]

        if (existing) {
            const newPaneIds = new Set(existing.paneIds)
            newPaneIds.add(paneId)
            set({
                groups: { ...groups, [channelId]: { ...existing, paneIds: newPaneIds } },
                paneGroupMap: { ...paneGroupMap, [paneId]: channelId },
            })
        } else {
            const newGroup: BroadcastGroup = {
                id: channelId,
                paneIds: new Set([paneId]),
            }
            set({
                groups: { ...groups, [channelId]: newGroup },
                paneGroupMap: { ...paneGroupMap, [paneId]: channelId },
            })
        }
    },

    broadcast: (fromPaneId, content) => {
        const { groups, paneGroupMap } = get()
        const groupId = paneGroupMap[fromPaneId]
        if (!groupId) return

        const group = groups[groupId]
        if (!group) return

        const bus = usePaneControlBus.getState()
        for (const paneId of group.paneIds) {
            if (paneId === fromPaneId) continue

            // Determine command type based on channel
            if (groupId.includes('terminal')) {
                bus.dispatch(paneId, { type: 'terminal:input', payload: { data: content, __broadcast: true } })
            } else if (groupId.includes('chat')) {
                bus.dispatch(paneId, { type: 'chat:inject', payload: { text: content, __broadcast: true } })
            }
        }
    },

    isBroadcasting: (paneId) => {
        return !!get().paneGroupMap[paneId]
    },

    removePane: (paneId) => {
        const { groups, paneGroupMap } = get()
        const groupId = paneGroupMap[paneId]
        if (!groupId) return

        const group = groups[groupId]
        if (!group) return

        const newPaneIds = new Set(group.paneIds)
        newPaneIds.delete(paneId)

        const newPaneGroupMap = { ...paneGroupMap }
        delete newPaneGroupMap[paneId]

        if (newPaneIds.size === 0) {
            const newGroups = { ...groups }
            delete newGroups[groupId]
            set({ groups: newGroups, paneGroupMap: newPaneGroupMap })
        } else {
            set({
                groups: { ...groups, [groupId]: { ...group, paneIds: newPaneIds } },
                paneGroupMap: newPaneGroupMap,
            })
        }
    },
}))
