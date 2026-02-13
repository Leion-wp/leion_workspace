// Singleton service — manages editor pane state independently of React lifecycle.
// EditorPane registers its read/write callbacks here on mount.
// Workflow EditorNodes call read/write directly, regardless of which space is active.

interface EditorState {
    filePath: string | null
    content: string
}

type WriteSubscriber = (content: string) => void
type CommandSubscriber = (cmd: EditorCommand) => void

export interface EditorCommand {
    type: 'open-file' | 'save' | 'goto-line' | 'search-replace' | 'get-selection'
    filePath?: string
    line?: number
    searchPattern?: string
    replacement?: string
    useRegex?: boolean
}

class EditorCommandService {
    private states = new Map<string, EditorState>()
    private subscribers = new Map<string, WriteSubscriber>()
    private commandSubscribers = new Map<string, CommandSubscriber>()

    /** Called by EditorPane on mount to seed initial state. Does not overwrite if already stored. */
    registerPane(paneId: string, initial: EditorState): void {
        if (!this.states.has(paneId)) {
            this.states.set(paneId, initial)
        }
    }

    /** Called by EditorPane when content or file changes. */
    updateState(paneId: string, partial: Partial<EditorState>): void {
        const current = this.states.get(paneId) ?? { filePath: null, content: '' }
        this.states.set(paneId, { ...current, ...partial })
    }

    /** Called by EditorPane to receive live write commands (when pane is visible). */
    subscribeWrites(paneId: string, cb: WriteSubscriber): void {
        this.subscribers.set(paneId, cb)
    }

    unsubscribeWrites(paneId: string): void {
        this.subscribers.delete(paneId)
    }

    /** Called by EditorPane to receive editor commands (goto-line, save, open-file, etc.) */
    subscribeCommands(paneId: string, cb: CommandSubscriber): void {
        this.commandSubscribers.set(paneId, cb)
    }

    unsubscribeCommands(paneId: string): void {
        this.commandSubscribers.delete(paneId)
    }

    /** Send a command to the editor pane (no-op if pane is not mounted). */
    sendCommand(paneId: string, cmd: EditorCommand): void {
        this.commandSubscribers.get(paneId)?.(cmd)
    }

    isRegistered(paneId: string): boolean {
        return this.states.has(paneId)
    }

    /** Read current content + file path of the editor. Works even if space is not active. */
    read(paneId: string): EditorState {
        if (!this.states.has(paneId)) {
            throw new Error(
                `Editor pane "${paneId}" has no state. ` +
                `Open the target space and editor pane at least once before running.`
            )
        }
        return { ...this.states.get(paneId)! }
    }

    /** Write content to the editor. Updates state, notifies pane if open, writes to disk if file is set. */
    write(paneId: string, content: string): void {
        if (!this.states.has(paneId)) {
            throw new Error(
                `Editor pane "${paneId}" has no state. ` +
                `Open the target space and editor pane at least once before running.`
            )
        }
        const current = this.states.get(paneId)!
        this.states.set(paneId, { ...current, content })

        // Notify pane if currently mounted
        this.subscribers.get(paneId)?.(content)

        // Persist to disk
        if (current.filePath && window.platform?.fs) {
            window.platform.fs.writeFile(current.filePath, content)
                .catch((err: unknown) => console.warn('EditorCommandService: disk write failed', err))
        }
    }

    /** Append text to current content. */
    append(paneId: string, text: string): void {
        const state = this.read(paneId)
        this.write(paneId, state.content + text)
    }

    /** Open a file: reads from disk and updates state + notifies mounted pane. */
    async openFile(paneId: string, filePath: string): Promise<string> {
        if (!window.platform?.fs) {
            throw new Error(`Editor pane "${paneId}": platform FS not available for open-file`)
        }
        const content = await window.platform.fs.readFile(filePath)
        const current = this.states.get(paneId) ?? { filePath: null, content: '' }
        this.states.set(paneId, { ...current, filePath, content })
        this.subscribers.get(paneId)?.(content)
        this.commandSubscribers.get(paneId)?.({ type: 'open-file', filePath })
        return content
    }

    /** Save the current content to disk (using the current filePath). */
    async save(paneId: string): Promise<void> {
        const state = this.read(paneId)
        if (!state.filePath) {
            throw new Error(`Editor pane "${paneId}": no file path set, cannot save`)
        }
        if (!window.platform?.fs) {
            throw new Error(`Editor pane "${paneId}": platform FS not available for save`)
        }
        await window.platform.fs.writeFile(state.filePath, state.content)
        this.commandSubscribers.get(paneId)?.({ type: 'save' })
    }

    /** Perform search-replace on current content. Returns updated content. */
    searchReplace(paneId: string, searchPattern: string, replacement: string, useRegex = false): string {
        const state = this.read(paneId)
        let newContent: string
        if (useRegex) {
            const regex = new RegExp(searchPattern, 'g')
            newContent = state.content.replace(regex, replacement)
        } else {
            newContent = state.content.split(searchPattern).join(replacement)
        }
        this.write(paneId, newContent)
        this.commandSubscribers.get(paneId)?.({ type: 'search-replace', searchPattern, replacement, useRegex })
        return newContent
    }
}

export const editorCommandService = new EditorCommandService()
