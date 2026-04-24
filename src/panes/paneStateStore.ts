import { create } from 'zustand';

// Per-pane ambient state shapes
export interface TerminalPaneState {
    type: 'terminal';
    lastOutput: string;
    cwd: string;
    isRunning: boolean;
    exitCode?: number;
}

export interface BrowserPaneState {
    type: 'browser';
    url: string;
    title: string;
    selectedText: string;
    isLoading: boolean;
}

export interface EditorPaneState {
    type: 'editor';
    filePath: string;
    language: string;
    selection: string;
    isDirty: boolean;
    content?: string; // last known content (if read)
}

export interface ChatPaneState {
    type: 'chat';
    lastResponse: string;
    isThinking: boolean;
    conversationId?: string;
}

export interface AgentPaneState {
    type: 'agent';
    brain: string;
    lastResponse: string;
    isThinking: boolean;
    messageCount: number;
}

export type PaneAmbientState = TerminalPaneState | BrowserPaneState | EditorPaneState | ChatPaneState | AgentPaneState;

interface PaneStateStoreState {
    paneStates: Record<string, PaneAmbientState>;
    isHydrated: boolean;
    setPaneState: (paneId: string, state: PaneAmbientState) => void;
    updatePaneState: (paneId: string, partial: Partial<PaneAmbientState>) => void;
    removePaneState: (paneId: string) => void;
    getAllPaneStates: () => Record<string, PaneAmbientState>;
    hydratePaneStates: (paneStates: Record<string, PaneAmbientState>) => void;
    loadPaneStates: () => Promise<void>;
    savePaneStates: () => Promise<void>;
}

const STORAGE_KEY = 'pane-ambient-state';

function sanitizePaneState(state: PaneAmbientState): PaneAmbientState {
    switch (state.type) {
        case 'terminal':
            return { ...state, isRunning: false };
        case 'browser':
            return { ...state, isLoading: false };
        case 'chat':
            return { ...state, isThinking: false };
        case 'agent':
            return { ...state, isThinking: false };
        default:
            return state;
    }
}

export const usePaneStateStore = create<PaneStateStoreState>((set, get) => ({
    paneStates: {},
    isHydrated: false,
    setPaneState: (paneId, state) =>
        set((prev) => ({ paneStates: { ...prev.paneStates, [paneId]: state } })),
    updatePaneState: (paneId, partial) =>
        set((prev) => {
            const existing = prev.paneStates[paneId];
            if (!existing) return prev;
            return { paneStates: { ...prev.paneStates, [paneId]: { ...existing, ...partial } as PaneAmbientState } };
        }),
    removePaneState: (paneId) =>
        set((prev) => {
            const next = { ...prev.paneStates };
            delete next[paneId];
            return { paneStates: next };
        }),
    getAllPaneStates: () => get().paneStates,
    hydratePaneStates: (paneStates) =>
        set({
            paneStates: Object.fromEntries(
                Object.entries(paneStates).map(([paneId, state]) => [paneId, sanitizePaneState(state)])
            ),
            isHydrated: true,
        }),
    loadPaneStates: async () => {
        if (!window.platform?.storage) {
            set({ isHydrated: true });
            return;
        }

        const saved = await window.platform.storage.load(STORAGE_KEY);
        if (!saved) {
            set({ isHydrated: true });
            return;
        }

        try {
            const parsed = JSON.parse(saved) as Record<string, PaneAmbientState>;
            get().hydratePaneStates(parsed);
        } catch (error) {
            console.warn('Failed to parse saved pane states', error);
            set({ isHydrated: true });
        }
    },
    savePaneStates: async () => {
        if (!window.platform?.storage) return;

        const paneStates = Object.fromEntries(
            Object.entries(get().paneStates).map(([paneId, state]) => [paneId, sanitizePaneState(state)])
        );
        await window.platform.storage.save(STORAGE_KEY, JSON.stringify(paneStates));
    },
}));
