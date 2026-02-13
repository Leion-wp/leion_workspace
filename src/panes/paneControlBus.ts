/**
 * PaneControlBus — bidirectional command bus between WorkflowEngine and panes.
 *
 * Panes register handlers on mount. Workflow executors dispatch commands
 * and await the result as a Promise.
 */
import { create } from 'zustand';

export interface PaneCommand {
    type: string;
    payload: Record<string, unknown>;
}

interface PaneControlBusState {
    /** Registered handlers keyed by paneId */
    handlers: Record<string, (cmd: PaneCommand) => Promise<unknown>>;

    /**
     * Register a command handler for a pane.
     * Returns an unregister cleanup function.
     */
    register: (paneId: string, handler: (cmd: PaneCommand) => Promise<unknown>) => () => void;

    /**
     * Dispatch a command to a specific pane.
     * Rejects if no handler is registered for that pane.
     */
    dispatch: (paneId: string, cmd: PaneCommand) => Promise<unknown>;
}

export const usePaneControlBus = create<PaneControlBusState>((set, get) => ({
    handlers: {},

    register: (paneId, handler) => {
        set((state) => ({
            handlers: { ...state.handlers, [paneId]: handler },
        }));
        return () => {
            set((state) => {
                const next = { ...state.handlers };
                delete next[paneId];
                return { handlers: next };
            });
        };
    },

    dispatch: async (paneId, cmd) => {
        const handler = get().handlers[paneId];
        if (!handler) {
            throw new Error(
                `PaneControlBus: no handler registered for pane "${paneId}". ` +
                `Make sure the target terminal pane is open.`
            );
        }
        return handler(cmd);
    },
}));
