import type { MosaicNode } from 'react-mosaic-component'
import type { PaneType } from '../panes/types'

export interface PresetPaneSnapshot {
    type: PaneType
    title?: string
    data?: Record<string, unknown>
}

export interface LayoutPreset {
    id: string
    name: string
    description: string
    icon: string
    category: 'Built-in' | 'Custom'
    paneTypes: Record<string, PaneType>
    paneSnapshots?: Record<string, PresetPaneSnapshot>
    layout: MosaicNode<string>
}

export const BUILT_IN_PRESETS: LayoutPreset[] = [
    {
        id: 'debug',
        name: 'Debug',
        description: 'Editor + Terminal + Browser',
        icon: '🐛',
        category: 'Built-in',
        paneTypes: { a: 'editor', b: 'terminal', c: 'browser' },
        paneSnapshots: {
            a: { type: 'editor', title: 'Workspace Editor', data: { editorShowSidebar: true } },
            b: { type: 'terminal', title: 'Runtime Terminal' },
            c: {
                type: 'browser',
                title: 'Preview Browser',
                data: {
                    tabs: [{ id: 'tab-preview', url: 'http://localhost:5173', title: 'Preview', favicon: '', isLoading: false, isSecure: false }],
                    activeTabId: 'tab-preview',
                    bookmarks: [],
                },
            },
        },
        layout: {
            direction: 'row',
            first: 'a',
            second: { direction: 'column', first: 'b', second: 'c', splitPercentage: 50 },
            splitPercentage: 60,
        },
    },
    {
        id: 'devops',
        name: 'DevOps',
        description: 'Terminal + Terminal + Editor + Database',
        icon: '🚀',
        category: 'Built-in',
        paneTypes: { a: 'terminal', b: 'terminal', c: 'editor', d: 'database' },
        paneSnapshots: {
            a: { type: 'terminal', title: 'Ops Terminal' },
            b: { type: 'terminal', title: 'Logs Terminal' },
            c: { type: 'editor', title: 'Infra Editor', data: { editorShowSidebar: true } },
            d: { type: 'database', title: 'Database Inspector' },
        },
        layout: {
            direction: 'row',
            first: { direction: 'column', first: 'a', second: 'b', splitPercentage: 50 },
            second: { direction: 'column', first: 'c', second: 'd', splitPercentage: 60 },
            splitPercentage: 40,
        },
    },
    {
        id: 'writing',
        name: 'Writing',
        description: 'Notes + Editor + Browser',
        icon: '✍️',
        category: 'Built-in',
        paneTypes: { a: 'notes', b: 'editor', c: 'browser' },
        paneSnapshots: {
            a: { type: 'notes', title: 'Draft Notes' },
            b: { type: 'editor', title: 'Manuscript', data: { editorShowSidebar: false } },
            c: {
                type: 'browser',
                title: 'Reference Browser',
                data: {
                    tabs: [{ id: 'tab-reference', url: 'https://www.google.com', title: 'Reference', favicon: '', isLoading: false, isSecure: true }],
                    activeTabId: 'tab-reference',
                    bookmarks: [],
                },
            },
        },
        layout: {
            direction: 'row',
            first: 'a',
            second: { direction: 'column', first: 'b', second: 'c', splitPercentage: 60 },
            splitPercentage: 35,
        },
    },
    {
        id: 'ai-pair',
        name: 'AI Pair Programming',
        description: 'Editor + Terminal + AI Chat',
        icon: '🤖',
        category: 'Built-in',
        paneTypes: { a: 'editor', b: 'terminal', c: 'chat' },
        paneSnapshots: {
            a: { type: 'editor', title: 'Implementation', data: { editorShowSidebar: true } },
            b: { type: 'terminal', title: 'Dev Terminal' },
            c: { type: 'chat', title: 'AI Pair', data: { provider: 'chatgpt' } },
        },
        layout: {
            direction: 'row',
            first: { direction: 'column', first: 'a', second: 'b', splitPercentage: 65 },
            second: 'c',
            splitPercentage: 60,
        },
    },
    {
        id: 'research',
        name: 'Research',
        description: 'Browser + Notes + AI Chat',
        icon: '🔬',
        category: 'Built-in',
        paneTypes: { a: 'browser', b: 'notes', c: 'chat' },
        paneSnapshots: {
            a: {
                type: 'browser',
                title: 'Research Browser',
                data: {
                    tabs: [{ id: 'tab-research', url: 'https://www.google.com', title: 'Research', favicon: '', isLoading: false, isSecure: true }],
                    activeTabId: 'tab-research',
                    bookmarks: [],
                },
            },
            b: { type: 'notes', title: 'Research Notes' },
            c: { type: 'chat', title: 'Synthesis', data: { provider: 'chatgpt' } },
        },
        layout: {
            direction: 'row',
            first: 'a',
            second: { direction: 'column', first: 'b', second: 'c', splitPercentage: 50 },
            splitPercentage: 50,
        },
    },
]
