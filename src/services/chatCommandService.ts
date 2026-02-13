type ChatExecutor = (script: string) => Promise<unknown>;

class ChatCommandService {
    private executors = new Map<string, ChatExecutor>();

    registerPane(paneId: string, executor: ChatExecutor) {
        this.executors.set(paneId, executor);
    }

    unregisterPane(paneId: string) {
        this.executors.delete(paneId);
    }

    isRegistered(paneId: string): boolean {
        return this.executors.has(paneId);
    }

    async execute(paneId: string, script: string): Promise<unknown> {
        const executor = this.executors.get(paneId);
        if (!executor) {
            throw new Error(`ChatCommandService: no chat pane registered for "${paneId}". Make sure the pane is open in the same space.`);
        }
        return executor(script);
    }
}

export const chatCommandService = new ChatCommandService();
