import type { MosaicNode } from 'react-mosaic-component'
import type { PaneType } from '../panes/types'

export interface LayoutPreset {
    id: string
    name: string
    description: string
    icon: string
    category: 'Built-in' | 'Custom'
    paneTypes: Record<string, PaneType>
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
        layout: {
            direction: 'row',
            first: 'a',
            second: { direction: 'column', first: 'b', second: 'c', splitPercentage: 50 },
            splitPercentage: 50,
        },
    },
]
