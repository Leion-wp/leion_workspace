/// <reference types="vite/client" />

interface PlatformBridge {
    window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        getState: () => Promise<{ isMaximized: boolean }>;
        onStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
    };
    storage: {
        save: (key: string, data: string) => Promise<void>;
        load: (key: string) => Promise<string | null>;
    };
    terminal: {
        create: (id: string, options?: {
            type?: string;
            cwd?: string;
            env?: Record<string, string>;
            initCommands?: string[];
        }) => Promise<boolean>;
        onData: (id: string, callback: (data: string) => void) => () => void;
        onExit: (id: string, callback: (code: number) => void) => () => void;
        send: (id: string, data: string) => void;
        resize: (id: string, cols: number, rows: number) => void;
        destroy: (id: string) => void;
    };
    codeServer: {
        start: (port: number, workspacePath?: string) => Promise<{ success: boolean; port?: number; error?: string }>;
        stop: () => Promise<{ success: boolean }>;
    };
    mcp: {
        request: (
            serverUrl: string,
            bodyOrMethod: unknown,
            params?: Record<string, unknown>,
            headers?: Record<string, string>
        ) => Promise<any>;
    };
    fs: {
        readDir: (path: string) => Promise<FsEntry[]>;
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
        openFolderDialog: () => Promise<string | null>;
        openFileDialog: () => Promise<string | null>;
    };
    fileWatcher?: {
        start: (id: string, glob: string, cwd?: string) => Promise<boolean>;
        stop: (id: string) => Promise<boolean>;
        onEvent: (callback: (watcherId: string, event: string, filePath: string) => void) => () => void;
    };
    browser?: {
        executeInPane: (paneId: string, script: string) => Promise<unknown>;
    };
    gemini?: {
        chat: (options: { messages: Array<{ role: string; content: string }>; model?: string }) => Promise<{ text: string }>;
        stream: (options: { messages: Array<{ role: string; content: string }>; model?: string }) => Promise<{ streamId: string }>;
        listModels: () => Promise<Array<{ id: string; displayName: string; description?: string; name: string }>>;
        onChunk: (streamId: string, callback: (chunk: { text: string; done: boolean; error?: string }) => void) => () => void;
    };
    codex?: {
        initialize: (options: { clientInfo: { name: string; version: string } }) => Promise<{ sessionId: string | null;[key: string]: unknown }>;
        turn: (options: { sessionId?: string | null; message: string }) => Promise<{ ok: boolean; usedMethod?: string; sessionId?: string | null; result?: unknown }>;
        approve: (sessionId: string, toolCallId: string, decision: 'allow' | 'deny' | 'allow-always') => Promise<void>;
        stop: () => Promise<void>;
        rpc: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
        onEvent: (callback: (event: any) => void) => () => void;
        onExit: (callback: (code: number) => void) => () => void;
    };
    popout?: {
        open: (paneId: string, paneConfig?: any) => Promise<{ success: boolean; alreadyOpen?: boolean }>;
        close: (paneId: string) => Promise<{ success: boolean }>;
        stateRelay: (paneId: string, state: any) => void;
        sendAction: (action: any) => void;
        onStateUpdate: (callback: (state: any) => void) => () => void;
        onAction: (callback: (action: any) => void) => () => void;
        onClosed: (callback: (paneId: string) => void) => () => void;
    };
}

interface LegacyElectronAPI {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    startCodeServer: (port: number, workspacePath?: string) => Promise<{ success: boolean; error?: string }>;
    stopCodeServer: () => Promise<{ success: boolean }>;
}

declare global {
    interface FsEntry {
        name: string;
        isDirectory: boolean;
        path: string;
        extension: string;
    }

    interface HTMLWebViewElement extends HTMLElement {
        addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
        goBack?: () => void;
        goForward?: () => void;
        reload?: () => void;
        isDevToolsOpened?: () => boolean;
        openDevTools?: () => void;
        closeDevTools?: () => void;
    }

    interface Window {
        platform: PlatformBridge;
        electronAPI?: LegacyElectronAPI;
    }
}

export { }
