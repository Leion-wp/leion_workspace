import { create } from 'zustand'

export type AgentMode = 'agent' | 'ask'

export interface AgentMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
    isStreaming?: boolean
    mode?: AgentMode // Track which mode generated this

    // Codex specific
    toolApprovals?: ToolApproval[]

    // UI state
    isExpanded?: boolean
}

export interface ToolApproval {
    id: string
    tool: string
    input: unknown
    decision?: 'allow' | 'deny' | 'allow-always'
}

export interface Project {
    id: string
    name: string
    createdAt: number
    environment?: Record<string, string> // Project-level env
}

export interface AgentSettings {
    cwd: string
    permissions: {
        allowListCommands: string[]
        allowListDomains: string[]
    }
    features: {
        experimental: string[]
    }
    mcp: {
        servers: string[]
    }
    memories: Array<{
        id: string
        name: string
        content: string
    }>
}

export interface Thread {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: AgentMessage[]
    mode: AgentMode // Default mode for this thread
    environment?: Record<string, string> // Thread-level env
    projectId?: string // Optional grouping
    archived?: boolean
    isThinking: boolean
    model?: string
}

interface AgentState {
    threads: Thread[]
    projects: Project[]
    activeThreadId: string | null
    mode: AgentMode
    isThinking: boolean
    memoryEnabled: boolean
    input: string

    // Configuration & scope
    globalEnv: Record<string, string>
    settings: AgentSettings

    // Codex Specific
    codexSessionId: string | null

    // Actions
    setInput: (val: string) => void
    setMode: (mode: AgentMode) => void
    toggleMemory: () => void

    // Thread Mgmt
    createThread: (title?: string, projectId?: string) => Promise<string>
    switchThread: (threadId: string) => void
    archiveThread: (threadId: string) => void
    deleteThread: (threadId: string) => void
    renameThread: (threadId: string, newTitle: string) => void
    updateThreadModel: (threadId: string, model: string) => void

    // Project Mgmt
    createProject: (name: string) => void
    deleteProject: (projectId: string) => void

    // Env & Settings
    updateThreadEnvironment: (threadId: string, key: string, value: string) => void
    updateProjectEnvironment: (projectId: string, key: string, value: string) => void
    updateGlobalEnvironment: (key: string, value: string) => void
    updateSettings: (partial: Partial<AgentSettings>) => void

    getResolvedEnvironment: (threadId: string) => Record<string, string>

    sendMessage: () => Promise<void>
    clearChat: () => void
    stop: () => Promise<void>

    // Codex Integration
    initializeCodexListeners: () => () => void
    approveTool: (toolCallId: string, decision: 'allow' | 'deny' | 'allow-always') => Promise<void>
    hydrateThreads: (
        threads: Thread[],
        projects?: Project[],
        settings?: AgentSettings,
        globalEnv?: Record<string, string>
    ) => void

    pendingApprovals: ToolApproval[]

    // Dynamic Models
    availableModels: Array<{ id: string; displayName: string; name: string }>
    fetchModels: () => Promise<void>
}

const DEFAULT_THREAD_TITLE = 'New Chat'

// Helper to coerce diverse Codex event formats
function getCodexMethod(event: any): string {
    return String(event?.event || event?.method || '').toLowerCase()
}

function getToolApprovalFromEvent(event: any): ToolApproval | null {
    const toolCallId = event?.toolCallId || event?.tool_call_id || event?.params?.toolCallId || event?.params?.id
    if (!toolCallId || typeof toolCallId !== 'string') return null

    const toolName = event?.toolName || event?.tool_name || event?.params?.toolName || event?.params?.name || 'unknown'
    const input = event?.input ?? event?.params?.input ?? event?.params?.arguments ?? event?.params?.args

    return { id: toolCallId, tool: String(toolName), input }
}

const DEFAULT_SETTINGS: AgentSettings = {
    cwd: '',
    permissions: { allowListCommands: [], allowListDomains: [] },
    features: { experimental: [] },
    mcp: { servers: [] },
    memories: []
}

export const useAgentStore = create<AgentState>((set, get) => ({
    threads: [],
    projects: [],
    activeThreadId: null,
    mode: 'agent',
    isThinking: false,
    memoryEnabled: true,
    input: '',
    globalEnv: {},
    settings: DEFAULT_SETTINGS,
    codexSessionId: null,
    pendingApprovals: [],
    availableModels: [],

    setInput: (val) => set({ input: val }),
    setMode: (mode) => set({ mode }),
    toggleMemory: () => set(state => ({ memoryEnabled: !state.memoryEnabled })),

    // --- Thread Actions ---
    createThread: async (title = DEFAULT_THREAD_TITLE, projectId) => {
        const id = crypto.randomUUID()
        const newThread: Thread = {
            id,
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            mode: get().mode,
            environment: {},
            projectId,
            isThinking: false,
            model: 'gemini-2.0-flash'
        }

        set(state => ({
            threads: [newThread, ...state.threads],
            activeThreadId: id,
        }))
        return id
    },

    archiveThread: (threadId) => {
        set(state => ({
            threads: state.threads.map(t => t.id === threadId ? { ...t, archived: true } : t)
        }))
    },

    deleteThread: (threadId) => {
        set(state => ({
            threads: state.threads.filter(t => t.id !== threadId),
            activeThreadId: state.activeThreadId === threadId ? null : state.activeThreadId
        }))
    },

    renameThread: (threadId, newTitle) => {
        set(state => ({
            threads: state.threads.map(t => t.id === threadId ? { ...t, title: newTitle } : t)
        }))
    },

    updateThreadModel: (threadId, model) => {
        set(state => ({
            threads: state.threads.map(t => t.id === threadId ? { ...t, model } : t)
        }))
    },

    switchThread: (threadId) => {
        const thread = get().threads.find(t => t.id === threadId)
        if (thread) {
            set({ activeThreadId: threadId, mode: thread.mode })
        }
    },

    // --- Project Actions ---
    createProject: (name) => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            name,
            createdAt: Date.now(),
            environment: {}
        }
        set(state => ({ projects: [...state.projects, newProject] }))
    },

    deleteProject: (projectId) => {
        set(state => ({
            projects: state.projects.filter(p => p.id !== projectId),
            // Ungroup threads that were in this project
            threads: state.threads.map(t => t.projectId === projectId ? { ...t, projectId: undefined } : t)
        }))
    },

    // --- Environment & Settings ---
    updateThreadEnvironment: (threadId, key, value) => {
        set(state => ({
            threads: state.threads.map(t =>
                t.id === threadId
                    ? { ...t, environment: { ...t.environment, [key]: value } }
                    : t
            )
        }))
    },

    updateProjectEnvironment: (projectId, key, value) => {
        set(state => ({
            projects: state.projects.map(p =>
                p.id === projectId
                    ? { ...p, environment: { ...p.environment, [key]: value } }
                    : p
            )
        }))
    },

    updateGlobalEnvironment: (key, value) => {
        set(state => ({
            globalEnv: { ...state.globalEnv, [key]: value }
        }))
    },

    updateSettings: (partial) => {
        set(state => ({
            settings: { ...state.settings, ...partial }
        }))
    },

    getResolvedEnvironment: (threadId) => {
        const state = get()
        const thread = state.threads.find(t => t.id === threadId)
        if (!thread) return state.globalEnv || {}

        const project = thread.projectId ? state.projects.find(p => p.id === thread.projectId) : null

        // Merge: Global < Project < Thread
        return {
            ...(state.globalEnv || {}),
            ...(project?.environment || {}),
            ...(thread.environment || {})
        }
    },

    sendMessage: async () => {
        const { input, mode, activeThreadId, codexSessionId } = get()
        if (!input.trim() || !activeThreadId) return

        const currentThread = get().threads.find(t => t.id === activeThreadId)
        if (!currentThread || currentThread.isThinking) return

        const userMsg: AgentMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
            mode
        }

        set(state => ({
            threads: state.threads.map(t => t.id === activeThreadId ? {
                ...t,
                messages: [...t.messages, userMsg, {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now(),
                    isStreaming: true,
                    mode: mode === 'ask' ? 'ask' : 'agent'
                }],
                isThinking: true
            } : t),
            input: '',
        }))

        try {
            if (mode === 'ask') {
                if (!window.platform?.gemini) throw new Error("Gemini API missing")

                const history = (currentThread.messages || [])
                    .filter(m => m.role !== 'system')
                    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content || '' }))

                history.push({ role: 'user', content: input.trim() })

                const { streamId } = await window.platform.gemini.stream({
                    messages: history,
                    model: currentThread.model || 'gemini-2.0-flash'
                })

                const cleanup = window.platform.gemini.onChunk(streamId, (chunk) => {
                    set(state => {
                        const threads = [...state.threads]
                        const tIdx = threads.findIndex(t => t.id === activeThreadId)
                        if (tIdx === -1) return {}

                        const msgs = threads[tIdx].messages
                        const lastMsg = msgs[msgs.length - 1]

                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                            if (chunk.error) {
                                lastMsg.content += `\nError: ${chunk.error}`
                                lastMsg.isStreaming = false
                                threads[tIdx].isThinking = false
                                cleanup()
                            } else if (chunk.done) {
                                lastMsg.isStreaming = false
                                threads[tIdx].isThinking = false
                                cleanup()
                            } else {
                                lastMsg.content += chunk.text
                            }
                        }
                        return { threads }
                    })
                })
            } else {
                // CODEX INTEGRATION
                if (!window.platform?.codex) throw new Error("Codex API missing")
                let session = codexSessionId
                if (!session) {
                    const init = await window.platform.codex.initialize({ clientInfo: { name: 'Leion', version: '2.0' } })
                    session = init.sessionId || null
                    if (session) set({ codexSessionId: session })
                }
                const envConfig = get().getResolvedEnvironment(activeThreadId)
                if (envConfig && Object.keys(envConfig).length > 0) {
                    try {
                        await window.platform.codex.rpc('config/batchWrite', { values: envConfig })
                    } catch (e) {
                        console.warn("Failed to inject env vars", e)
                    }
                }
                await window.platform.codex.turn({ sessionId: session, message: userMsg.content })
            }
        } catch (err: any) {
            console.error("Agent Error:", err)
            set(state => {
                const threads = state.threads.map(t => {
                    if (t.id === activeThreadId) {
                        // Remove the last (empty streaming) assistant message if it exists
                        const messages = [...t.messages]
                        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].isStreaming) {
                            messages.pop()
                        }
                        return {
                            ...t,
                            isThinking: false,
                            messages: [...messages, {
                                id: crypto.randomUUID(),
                                role: 'system' as const,
                                content: `Error: ${err.message}`,
                                timestamp: Date.now()
                            }]
                        }
                    }
                    return t
                })
                return { threads }
            })
        }
    },

    clearChat: () => {
        const { activeThreadId } = get()
        if (!activeThreadId) return

        set(state => ({
            threads: state.threads.map(t =>
                t.id === activeThreadId
                    ? { ...t, messages: [] }
                    : t
            )
        }))
    },

    stop: async () => {
        const { activeThreadId } = get()
        if (!activeThreadId) return

        if (window.platform?.codex) {
            await window.platform.codex.stop()
        }

        set(state => ({
            threads: state.threads.map(t => t.id === activeThreadId ? { ...t, isThinking: false } : t)
        }))
    },

    initializeCodexListeners: () => {
        if (!window.platform?.codex) return () => { }

        return window.platform.codex.onEvent((rawEvent: any) => {
            const { activeThreadId } = get()
            if (!activeThreadId) return

            const event = rawEvent || {}
            const method = getCodexMethod(event)

            // 1. Tool Approval Request
            if (method.includes('tool') && (method.includes('call') || method.includes('request'))) {
                const approval = getToolApprovalFromEvent(event)
                if (approval) {
                    set(state => ({
                        pendingApprovals: [...state.pendingApprovals, approval]
                    }))
                }
            }

            // 2. Tool Result / Approved
            if (method.includes('tool') && (method.includes('result') || method.includes('approved'))) {
                const toolId = event.toolCallId || event.tool_call_id
                if (toolId) {
                    set(state => ({
                        pendingApprovals: state.pendingApprovals.filter(a => a.id !== toolId)
                    }))
                }
            }

            // 3. Text & Content
            const text = event?.params?.text || event?.text || event?.params?.delta || event?.params?.message?.text
            if (text && typeof text === 'string') {
                set(state => {
                    const threads = [...state.threads]
                    const idx = threads.findIndex(t => t.id === activeThreadId)
                    if (idx === -1) return {}

                    const msgs = threads[idx].messages
                    const lastMsg = msgs[msgs.length - 1]

                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                        lastMsg.content += text
                    }
                    return { threads }
                })
            }

            // 4. Turn Complete
            if (
                method.includes('turn.complete') ||
                method === 'turn-complete' ||
                method.includes('turn.done') ||
                method.includes('response.completed') ||
                method === 'stop'
            ) {
                set(state => {
                    const threads = [...state.threads]
                    const idx = threads.findIndex(t => t.id === activeThreadId)
                    if (idx === -1) return { isThinking: false }

                    const msgs = threads[idx].messages
                    if (msgs.length > 1) msgs[msgs.length - 1].isStreaming = false
                    return { threads, isThinking: false }
                })
            }
        })
    },

    hydrateThreads: (threads, projects = [], settings, globalEnv) => {
        set(state => ({
            threads,
            projects,
            settings: settings || state.settings,
            globalEnv: globalEnv || state.globalEnv
        }))
    },

    approveTool: async (toolCallId, decision) => {
        const { codexSessionId } = get()
        if (window.platform?.codex && codexSessionId) {
            await window.platform.codex.approve(codexSessionId, toolCallId, decision)
            set(state => ({
                pendingApprovals: state.pendingApprovals.filter(a => a.id !== toolCallId)
            }))
        }
    },

    fetchModels: async () => {
        if (!window.platform?.gemini?.listModels) {
            return
        }
        try {
            const models = await window.platform.gemini.listModels()

            if (Array.isArray(models) && models.length > 0) {
                set({ availableModels: models })
            } else {
                // No models received, or empty list
            }
        } catch (e) {
            console.error("[AgentStore] Failed to fetch models:", e)
        }
    }
}))
