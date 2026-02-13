import { create } from 'zustand'

export type ShortcutAction =
    | 'newPane'
    | 'closePane'
    | 'newTerminal'
    | 'newBrowser'
    | 'newNotes'
    | 'focusPane1'
    | 'focusPane2'
    | 'focusPane3'
    | 'focusPane4'
    | 'focusPane5'
    | 'nextPane'
    | 'prevPane'
    | 'toggleSidebar'
    | 'saveLayout'
    | 'commandPalette'

export interface ShortcutBinding {
    key: string // e.g., "ctrl+t", "ctrl+shift+t"
    action: ShortcutAction
    description: string
}

export interface ShortcutsState {
    bindings: ShortcutBinding[]
    activePane: string | null
    setActivePane: (id: string | null) => void
    updateBinding: (action: ShortcutAction, newKey: string) => void
    resetToDefaults: () => void
    saveShortcuts: () => Promise<void>
    loadShortcuts: () => Promise<void>
}

const DEFAULT_BINDINGS: ShortcutBinding[] = [
    { key: 'ctrl+t', action: 'newPane', description: 'New pane' },
    { key: 'ctrl+w', action: 'closePane', description: 'Close active pane' },
    { key: 'ctrl+shift+t', action: 'newTerminal', description: 'New terminal' },
    { key: 'ctrl+shift+b', action: 'newBrowser', description: 'New browser' },
    { key: 'ctrl+shift+n', action: 'newNotes', description: 'New notes' },
    { key: 'ctrl+1', action: 'focusPane1', description: 'Focus pane 1' },
    { key: 'ctrl+2', action: 'focusPane2', description: 'Focus pane 2' },
    { key: 'ctrl+3', action: 'focusPane3', description: 'Focus pane 3' },
    { key: 'ctrl+4', action: 'focusPane4', description: 'Focus pane 4' },
    { key: 'ctrl+5', action: 'focusPane5', description: 'Focus pane 5' },
    { key: 'ctrl+tab', action: 'nextPane', description: 'Next pane' },
    { key: 'ctrl+shift+tab', action: 'prevPane', description: 'Previous pane' },
    { key: 'ctrl+b', action: 'toggleSidebar', description: 'Toggle sidebar' },
    { key: 'ctrl+s', action: 'saveLayout', description: 'Save layout' },
    { key: 'ctrl+k', action: 'commandPalette', description: 'Command palette' },
]

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
    bindings: DEFAULT_BINDINGS,
    activePane: null,

    setActivePane: (id) => set({ activePane: id }),

    updateBinding: (action, newKey) => {
        const { bindings } = get()
        set({
            bindings: bindings.map((b) =>
                b.action === action ? { ...b, key: newKey } : b
            ),
        })
    },

    resetToDefaults: () => set({ bindings: DEFAULT_BINDINGS }),

    saveShortcuts: async () => {
        const { bindings } = get()
        if (window.platform?.storage) {
            await window.platform.storage.save('shortcuts', JSON.stringify(bindings))
        }
    },

    loadShortcuts: async () => {
        if (window.platform?.storage) {
            const saved = await window.platform.storage.load('shortcuts')
            if (saved) {
                try {
                    const bindings = JSON.parse(saved)
                    set({ bindings })
                } catch (e) {
                    console.warn('Failed to parse saved shortcuts', e)
                }
            }
        }
    },
}))

// Parse key string to match event
function parseKeyCombo(keyString: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
    const parts = keyString.toLowerCase().split('+')
    return {
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        key: parts.filter((p) => !['ctrl', 'shift', 'alt'].includes(p))[0] || '',
    }
}

function matchesEvent(binding: ShortcutBinding, event: KeyboardEvent): boolean {
    const combo = parseKeyCombo(binding.key)
    const eventKey = event.key.toLowerCase()

    // Handle special keys
    const keyMatch =
        eventKey === combo.key ||
        (combo.key === 'tab' && eventKey === 'tab') ||
        (/^\d$/.test(combo.key) && eventKey === combo.key)

    return (
        keyMatch &&
        event.ctrlKey === combo.ctrl &&
        event.shiftKey === combo.shift &&
        event.altKey === combo.alt
    )
}

export function useShortcuts(handlers: Partial<Record<ShortcutAction, () => void>>) {
    const bindings = useShortcutsStore((state) => state.bindings)

    const handleKeyDown = (event: KeyboardEvent) => {
        // Skip if typing in input/textarea
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return
        }

        for (const binding of bindings) {
            if (matchesEvent(binding, event)) {
                const handler = handlers[binding.action]
                if (handler) {
                    event.preventDefault()
                    handler()
                    return
                }
            }
        }
    }

    return { handleKeyDown }
}
