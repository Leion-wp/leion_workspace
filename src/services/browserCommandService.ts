type BrowserCommandCallback = (script: string) => Promise<string>;

class BrowserCommandService {
    private executors = new Map<string, BrowserCommandCallback>();

    registerPane(paneId: string, executor: BrowserCommandCallback) {
        this.executors.set(paneId, executor);
    }

    unregisterPane(paneId: string) {
        this.executors.delete(paneId);
    }

    async executeInPane(paneId: string, script: string): Promise<string> {
        const executor = this.executors.get(paneId);
        if (!executor) throw new Error(`BrowserCommandService: no browser pane registered for "${paneId}"`);
        return executor(script);
    }

    isRegistered(paneId: string): boolean {
        return this.executors.has(paneId);
    }
}

export const browserCommandService = new BrowserCommandService();
