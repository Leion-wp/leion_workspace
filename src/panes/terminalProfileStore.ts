import { create } from 'zustand'

interface TerminalProfileState {
    isLoaded: boolean
    sharedCwd: string
    sharedEnv: Record<string, string>
    bootstrapCommands: string[]
    syncCwdAcrossTerminals: boolean
    lastCwdSourcePaneId: string | null

    setSharedCwd: (cwd: string, sourcePaneId?: string | null) => void
    setSharedEnv: (env: Record<string, string>) => void
    setBootstrapCommands: (commands: string[]) => void
    setSyncCwdAcrossTerminals: (enabled: boolean) => void

    envAsText: () => string
    applyEnvText: (text: string) => { ok: boolean; error?: string }
    bootstrapAsText: () => string
    applyBootstrapText: (text: string) => void

    loadProfile: () => Promise<void>
    saveProfile: () => Promise<void>
}

const STORAGE_KEY = 'terminal-profile'

function normalizeCwd(value: string): string {
    return String(value || '').trim()
}

function parseEnvLines(text: string): { ok: boolean; env: Record<string, string>; error?: string } {
    const env: Record<string, string> = {}
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim()
        if (!raw || raw.startsWith('#')) continue
        const eq = raw.indexOf('=')
        if (eq <= 0) {
            return { ok: false, env: {}, error: `Invalid env line ${i + 1}: "${raw}"` }
        }
        const key = raw.slice(0, eq).trim()
        let value = raw.slice(eq + 1).trim()
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            return { ok: false, env: {}, error: `Invalid env key "${key}" on line ${i + 1}` }
        }
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        env[key] = value
    }
    return { ok: true, env }
}

export const useTerminalProfileStore = create<TerminalProfileState>((set, get) => ({
    isLoaded: false,
    sharedCwd: '',
    sharedEnv: {},
    bootstrapCommands: [],
    syncCwdAcrossTerminals: true,
    lastCwdSourcePaneId: null,

    setSharedCwd: (cwd, sourcePaneId = null) => {
        const normalized = normalizeCwd(cwd)
        if (normalized === get().sharedCwd && sourcePaneId === get().lastCwdSourcePaneId) return
        set({ sharedCwd: normalized, lastCwdSourcePaneId: sourcePaneId })
        void get().saveProfile()
    },

    setSharedEnv: (env) => {
        set({ sharedEnv: { ...env } })
        void get().saveProfile()
    },

    setBootstrapCommands: (commands) => {
        const sanitized = commands.map(c => c.trim()).filter(Boolean)
        set({ bootstrapCommands: sanitized })
        void get().saveProfile()
    },

    setSyncCwdAcrossTerminals: (enabled) => {
        set({ syncCwdAcrossTerminals: enabled })
        void get().saveProfile()
    },

    envAsText: () => {
        return Object.entries(get().sharedEnv).map(([k, v]) => `${k}=${v}`).join('\n')
    },

    applyEnvText: (text) => {
        const parsed = parseEnvLines(text)
        if (!parsed.ok) {
            return { ok: false, error: parsed.error }
        }
        get().setSharedEnv(parsed.env)
        return { ok: true }
    },

    bootstrapAsText: () => get().bootstrapCommands.join('\n'),

    applyBootstrapText: (text) => {
        const commands = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
        get().setBootstrapCommands(commands)
    },

    loadProfile: async () => {
        try {
            const saved = await window.platform?.storage?.load(STORAGE_KEY)
            if (!saved) {
                set({ isLoaded: true })
                return
            }
            const parsed = JSON.parse(saved) as Partial<TerminalProfileState>
            set({
                isLoaded: true,
                sharedCwd: normalizeCwd(parsed.sharedCwd || ''),
                sharedEnv: parsed.sharedEnv && typeof parsed.sharedEnv === 'object' ? parsed.sharedEnv : {},
                bootstrapCommands: Array.isArray(parsed.bootstrapCommands) ? parsed.bootstrapCommands.filter(Boolean) : [],
                syncCwdAcrossTerminals: parsed.syncCwdAcrossTerminals ?? true,
                lastCwdSourcePaneId: null,
            })
        } catch (e) {
            console.warn('Failed to load terminal profile', e)
            set({ isLoaded: true })
        }
    },

    saveProfile: async () => {
        try {
            const { sharedCwd, sharedEnv, bootstrapCommands, syncCwdAcrossTerminals } = get()
            await window.platform?.storage?.save(STORAGE_KEY, JSON.stringify({
                sharedCwd,
                sharedEnv,
                bootstrapCommands,
                syncCwdAcrossTerminals,
            }))
        } catch (e) {
            console.warn('Failed to save terminal profile', e)
        }
    },
}))
