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
    setPaneState: (paneId: string, state: PaneAmbientState) => void;
    updatePaneState: (paneId: string, partial: Partial<PaneAmbientState>) => void;
    removePaneState: (paneId: string) => void;
    getAllPaneStates: () => Record<string, PaneAmbientState>;
}

export const usePaneStateStore = create<PaneStateStoreState>((set, get) => ({
    paneStates: {},
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
}));
