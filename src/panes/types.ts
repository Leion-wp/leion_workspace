export type PaneType = 'empty' | 'notes' | 'gemini' | 'browser' | 'terminal' | 'chat' | 'codeserver' | 'workflow' | 'editor' | 'database' | 'agent'

export interface BrowserTab {
    id: string
    url: string
    title: string
    favicon: string
    isLoading: boolean
    isSecure: boolean
}

export interface BrowserData {
    tabs: BrowserTab[]
    activeTabId: string
    bookmarks: { url: string; title: string; favicon: string }[]
}

export interface PaneConfig {
    id: string
    type: PaneType
    title?: string
    data?: Record<string, unknown>
    collapsed?: boolean
    prevSplitPercentage?: number
}

export const PANE_TYPES: Record<PaneType, { label: string; icon: string }> = {
    empty: { label: 'Empty', icon: '📦' },
    notes: { label: 'Notes', icon: '📝' },
    gemini: { label: 'Gemini', icon: '✨' },
    browser: { label: 'Browser', icon: '🌐' },
    terminal: { label: 'Terminal', icon: '⬛' },
    chat: { label: 'AI Chat', icon: '💬' },
    codeserver: { label: 'VS Code', icon: '💻' },
    workflow: { label: 'Workflow', icon: '⚡' },
    editor: { label: 'Editor', icon: '📄' },
    database: { label: 'Database', icon: '🗄️' },
    agent: { label: 'Agent', icon: '🧠' },
}
