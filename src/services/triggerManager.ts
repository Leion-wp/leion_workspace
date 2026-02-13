import type { WorkflowTrigger } from '../workflow/types';

type TriggerCallback = (triggerId: string, event: string, data?: unknown) => void;

class TriggerManager {
    private callbacks = new Map<string, TriggerCallback>();
    private timerHandles = new Map<string, ReturnType<typeof setInterval>>();
    private fileWatcherUnsubscribe: (() => void) | null = null;
    private activeWatchers = new Set<string>();

    init() {
        // Subscribe to file watcher events from main process
        if (window.platform?.fileWatcher) {
            this.fileWatcherUnsubscribe = window.platform.fileWatcher.onEvent(
                (watcherId: string, event: string, filePath: string) => {
                    const cb = this.callbacks.get(watcherId);
                    if (cb) cb(watcherId, event, filePath);
                }
            );
        }
    }

    destroy() {
        this.fileWatcherUnsubscribe?.();
        this.timerHandles.forEach((handle) => clearInterval(handle));
        this.timerHandles.clear();
        this.activeWatchers.forEach((id) => window.platform?.fileWatcher?.stop(id));
        this.activeWatchers.clear();
        this.callbacks.clear();
    }

    async activateTrigger(trigger: WorkflowTrigger, onFire: () => void) {
        if (!trigger.enabled) return;

        if (trigger.type === 'filewatch') {
            const watcherId = trigger.id;
            this.callbacks.set(watcherId, (_, event) => {
                if (trigger.events.includes(event as 'change' | 'add' | 'unlink')) {
                    onFire();
                }
            });
            await window.platform?.fileWatcher?.start(watcherId, trigger.glob, trigger.cwd);
            this.activeWatchers.add(watcherId);
        } else if (trigger.type === 'timer') {
            const handle = setInterval(() => onFire(), trigger.intervalMs);
            this.timerHandles.set(trigger.id, handle);
        }
        // terminal triggers are handled by terminalCommandService via subscribeOutput
    }

    async deactivateTrigger(triggerId: string) {
        this.callbacks.delete(triggerId);
        if (this.activeWatchers.has(triggerId)) {
            await window.platform?.fileWatcher?.stop(triggerId);
            this.activeWatchers.delete(triggerId);
        }
        if (this.timerHandles.has(triggerId)) {
            clearInterval(this.timerHandles.get(triggerId)!);
            this.timerHandles.delete(triggerId);
        }
    }

    subscribeTerminalOutput(paneId: string, pattern: string, onFire: () => void): () => void {
        const regex = new RegExp(pattern);
        // Hook into terminal data events
        const terminalId = `terminal-${paneId}`;
        const channel = `terminal:data:${terminalId}`;
        const listener = (_: unknown, data: string) => {
            if (regex.test(data)) onFire();
        };
        // Use IPC renderer directly
        const ipcRenderer = (window as unknown as { _ipcRenderer?: { on: (ch: string, fn: unknown) => void; removeListener: (ch: string, fn: unknown) => void } })._ipcRenderer;
        if (ipcRenderer) {
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        }
        return () => {};
    }
}

export const triggerManager = new TriggerManager();
