import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings'
import { useLayoutStore } from '../layout/store'
import { useTerminalProfileStore } from '../panes/terminalProfileStore'
import './SettingsModal.css'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'terminal' | 'data'>('general')
    const [envText, setEnvText] = useState('')
    const [commandsText, setCommandsText] = useState('')
    const [terminalError, setTerminalError] = useState('')

    const theme = useSettingsStore(s => s.theme)
    const setTheme = useSettingsStore(s => s.setTheme)
    const showTabBar = useSettingsStore(s => s.showTabBar)
    const setShowTabBar = useSettingsStore(s => s.setShowTabBar)
    const showBookmarksBar = useSettingsStore(s => s.showBookmarksBar)
    const setShowBookmarksBar = useSettingsStore(s => s.setShowBookmarksBar)
    const defaultSearchEngine = useSettingsStore(s => s.defaultSearchEngine)
    const setDefaultSearchEngine = useSettingsStore(s => s.setDefaultSearchEngine)
    const terminalSharedCwd = useTerminalProfileStore(s => s.sharedCwd)
    const terminalSharedEnv = useTerminalProfileStore(s => s.sharedEnv)
    const bootstrapCommands = useTerminalProfileStore(s => s.bootstrapCommands)
    const syncCwdAcrossTerminals = useTerminalProfileStore(s => s.syncCwdAcrossTerminals)
    const setSharedCwd = useTerminalProfileStore(s => s.setSharedCwd)
    const setSyncCwdAcrossTerminals = useTerminalProfileStore(s => s.setSyncCwdAcrossTerminals)
    const envAsText = useTerminalProfileStore(s => s.envAsText)
    const applyEnvText = useTerminalProfileStore(s => s.applyEnvText)
    const applyBootstrapText = useTerminalProfileStore(s => s.applyBootstrapText)

    const spaces = useLayoutStore(s => s.spaces)
    const layout = useLayoutStore(s => s.layout)
    const panes = useLayoutStore(s => s.panes)

    useEffect(() => {
        if (!isOpen) return
        setEnvText(envAsText())
        setCommandsText(bootstrapCommands.join('\n'))
        setTerminalError('')
    }, [isOpen, terminalSharedEnv, bootstrapCommands, envAsText])

    if (!isOpen) return null

    const handleExport = () => {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            spaces,
            layout,
            panes,
            settings: {
                theme,
                showTabBar,
                showBookmarksBar,
                defaultSearchEngine,
            }
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leion-workspace-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleImport = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            try {
                const text = await file.text()
                const data = JSON.parse(text)

                // Apply settings
                if (data.settings) {
                    if (data.settings.theme) setTheme(data.settings.theme)
                    if (data.settings.showTabBar !== undefined) setShowTabBar(data.settings.showTabBar)
                    if (data.settings.showBookmarksBar !== undefined) setShowBookmarksBar(data.settings.showBookmarksBar)
                    if (data.settings.defaultSearchEngine) setDefaultSearchEngine(data.settings.defaultSearchEngine)
                }

                // Apply layout - save to localStorage
                if (data.spaces && data.layout && data.panes) {
                    localStorage.setItem('leion-layout', JSON.stringify({
                        spaces: data.spaces,
                        activeSpaceId: data.spaces[0]?.id || 'default',
                    }))
                    alert('Layout imported! Please refresh to apply changes.')
                }
            } catch (err) {
                alert('Failed to import: Invalid file format')
                console.error('Import error:', err)
            }
        }
        input.click()
    }

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    <div className="settings-sidebar">
                        <button
                            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            ⚙️ General
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            🎨 Appearance
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'terminal' ? 'active' : ''}`}
                            onClick={() => setActiveTab('terminal')}
                        >
                            ⬛ Terminal
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'data' ? 'active' : ''}`}
                            onClick={() => setActiveTab('data')}
                        >
                            💾 Data
                        </button>
                    </div>

                    <div className="settings-panel">
                        {activeTab === 'general' && (
                            <div className="settings-section">
                                <h3>Browser</h3>

                                <label className="settings-toggle">
                                    <span>Show Tab Bar</span>
                                    <input
                                        type="checkbox"
                                        checked={showTabBar}
                                        onChange={e => setShowTabBar(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>

                                <label className="settings-toggle">
                                    <span>Show Bookmarks Bar</span>
                                    <input
                                        type="checkbox"
                                        checked={showBookmarksBar}
                                        onChange={e => setShowBookmarksBar(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>

                                <div className="settings-field">
                                    <label>Default Search Engine</label>
                                    <select
                                        value={defaultSearchEngine}
                                        onChange={e => setDefaultSearchEngine(e.target.value)}
                                    >
                                        <option value="google">Google</option>
                                        <option value="duckduckgo">DuckDuckGo</option>
                                        <option value="bing">Bing</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="settings-section">
                                <h3>Theme</h3>

                                <div className="theme-picker">
                                    <button
                                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                        onClick={() => setTheme('dark')}
                                    >
                                        <span className="theme-preview dark" />
                                        <span>Dark</span>
                                    </button>
                                    <button
                                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                        onClick={() => setTheme('light')}
                                    >
                                        <span className="theme-preview light" />
                                        <span>Light</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'terminal' && (
                            <div className="settings-section">
                                <h3>Shared Terminal Profile</h3>

                                <label className="settings-toggle">
                                    <span>Sync CWD Across All Terminals</span>
                                    <input
                                        type="checkbox"
                                        checked={syncCwdAcrossTerminals}
                                        onChange={e => setSyncCwdAcrossTerminals(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>

                                <div className="settings-field">
                                    <label>Shared CWD</label>
                                    <div className="settings-row">
                                        <input
                                            type="text"
                                            value={terminalSharedCwd}
                                            onChange={e => setSharedCwd(e.target.value)}
                                            placeholder="D:\\project"
                                        />
                                        <button
                                            className="settings-btn"
                                            onClick={async () => {
                                                const selected = await window.platform?.fs?.openFolderDialog?.()
                                                if (selected) setSharedCwd(selected)
                                            }}
                                        >
                                            Browse
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-field">
                                    <label>Shared ENV (KEY=VALUE, one per line)</label>
                                    <textarea
                                        className="settings-textarea"
                                        value={envText}
                                        onChange={e => setEnvText(e.target.value)}
                                        onBlur={() => {
                                            const result = applyEnvText(envText)
                                            setTerminalError(result.ok ? '' : (result.error || 'Invalid ENV format'))
                                        }}
                                        placeholder={'NODE_ENV=development\nAPI_BASE_URL=http://localhost:3000'}
                                    />
                                </div>

                                <div className="settings-field">
                                    <label>Startup Commands (one per line)</label>
                                    <textarea
                                        className="settings-textarea"
                                        value={commandsText}
                                        onChange={e => setCommandsText(e.target.value)}
                                        onBlur={() => applyBootstrapText(commandsText)}
                                        placeholder={'chcp 65001\nnpm run dev'}
                                    />
                                </div>

                                {terminalError && (
                                    <div className="settings-error">{terminalError}</div>
                                )}
                            </div>
                        )}

                        {activeTab === 'data' && (
                            <div className="settings-section">
                                <h3>Workspace Data</h3>

                                <p className="settings-description">
                                    Export your entire workspace configuration including layouts, spaces, and settings.
                                </p>

                                <div className="settings-actions">
                                    <button className="settings-btn primary" onClick={handleExport}>
                                        📤 Export Workspace
                                    </button>
                                    <button className="settings-btn" onClick={handleImport}>
                                        📥 Import Workspace
                                    </button>
                                </div>

                                <h3>Statistics</h3>
                                <div className="settings-stats">
                                    <div className="stat">
                                        <span className="stat-value">{spaces.length}</span>
                                        <span className="stat-label">Spaces</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-value">{Object.keys(panes).length}</span>
                                        <span className="stat-label">Panes</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
