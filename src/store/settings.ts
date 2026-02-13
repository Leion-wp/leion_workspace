import { create } from 'zustand'

export type Theme = 'dark' | 'light'

export interface SettingsState {
    theme: Theme
    sidebarWidth: number
    showTabBar: boolean
    showBookmarksBar: boolean
    defaultSearchEngine: string

    // Actions
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    setSidebarWidth: (width: number) => void
    setShowTabBar: (show: boolean) => void
    setShowBookmarksBar: (show: boolean) => void
    setDefaultSearchEngine: (engine: string) => void
    loadSettings: () => void
    saveSettings: () => void
}

const STORAGE_KEY = 'leion-settings'

export const useSettingsStore = create<SettingsState>((set, get) => ({
    theme: 'dark',
    sidebarWidth: 220,
    showTabBar: true,
    showBookmarksBar: true,
    defaultSearchEngine: 'google',

    setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(theme)
        document.documentElement.setAttribute('data-theme', theme)
        get().saveSettings()
    },

    toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark'
        get().setTheme(newTheme)
    },

    setSidebarWidth: (sidebarWidth) => {
        set({ sidebarWidth })
        get().saveSettings()
    },

    setShowTabBar: (showTabBar) => {
        set({ showTabBar })
        get().saveSettings()
    },

    setShowBookmarksBar: (showBookmarksBar) => {
        set({ showBookmarksBar })
        get().saveSettings()
    },

    setDefaultSearchEngine: (defaultSearchEngine) => {
        set({ defaultSearchEngine })
        get().saveSettings()
    },

    loadSettings: () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const settings = JSON.parse(saved)
                set({
                    theme: settings.theme || 'dark',
                    sidebarWidth: settings.sidebarWidth || 220,
                    showTabBar: settings.showTabBar ?? true,
                    showBookmarksBar: settings.showBookmarksBar ?? true,
                    defaultSearchEngine: settings.defaultSearchEngine || 'google',
                })
                const theme = settings.theme || 'dark'
                document.documentElement.classList.remove('light', 'dark')
                document.documentElement.classList.add(theme)
                document.documentElement.setAttribute('data-theme', theme)
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    },

    saveSettings: () => {
        try {
            const { theme, sidebarWidth, showTabBar, showBookmarksBar, defaultSearchEngine } = get()
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                theme,
                sidebarWidth,
                showTabBar,
                showBookmarksBar,
                defaultSearchEngine,
            }))
        } catch (e) {
            console.error('Failed to save settings:', e)
        }
    },
}))
