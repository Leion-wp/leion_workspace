const { contextBridge, ipcRenderer } = require('electron');

// Platform bridge - abstraction for Tauri migration
contextBridge.exposeInMainWorld('platform', {
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        getState: () => ipcRenderer.invoke('window:getState'),
        onStateChange: (callback) => {
            const listener = (_, state) => callback(state);
            ipcRenderer.on('window:state-changed', listener);
            return () => ipcRenderer.removeListener('window:state-changed', listener);
        },
    },
    storage: {
        save: (key, data) => ipcRenderer.invoke('storage:save', key, data),
        load: (key) => ipcRenderer.invoke('storage:load', key),
    },
    terminal: {
        create: (id, options) => ipcRenderer.invoke('terminal:create', id, options),
        send: (id, data) => ipcRenderer.send('terminal:input', id, data),
        resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
        destroy: (id) => ipcRenderer.send('terminal:destroy', id),
        onData: (id, callback) => {
            const channel = `terminal:data:${id}`;
            const listener = (_, data) => callback(data);
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
        onExit: (id, callback) => {
            const channel = `terminal:exit:${id}`;
            const listener = (_, code) => callback(code);
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
    },
    codeServer: {
        start: (port, workspacePath) => ipcRenderer.invoke('codeserver:start', port, workspacePath),
        stop: () => ipcRenderer.invoke('codeserver:stop'),
    },
    mcp: {
        request: (serverUrl, method, params, headers) => ipcRenderer.invoke('mcp:request', serverUrl, method, params, headers),
    },
    fs: {
        readDir: (p) => ipcRenderer.invoke('fs:readDir', p),
        readFile: (p) => ipcRenderer.invoke('fs:readFile', p),
        writeFile: (p, c) => ipcRenderer.invoke('fs:writeFile', p, c),
        openFolderDialog: () => ipcRenderer.invoke('fs:openFolderDialog'),
        openFileDialog: () => ipcRenderer.invoke('fs:openFileDialog'),
    },
    fileWatcher: {
        start: (id, glob, cwd) => ipcRenderer.invoke('filewatcher:start', id, glob, cwd),
        stop: (id) => ipcRenderer.invoke('filewatcher:stop', id),
        onEvent: (callback) => {
            const listener = (_, watcherId, event, filePath) => callback(watcherId, event, filePath);
            ipcRenderer.on('filewatcher:event', listener);
            return () => ipcRenderer.removeListener('filewatcher:event', listener);
        },
    },
    browser: {
        executeInPane: (paneId, script) => ipcRenderer.invoke('browser:executeInPane', paneId, script),
    },
    env: {
        load: () => ipcRenderer.invoke('env:load'),
    },
    gemini: {
        chat: (options) => ipcRenderer.invoke('gemini:chat', options),
        stream: (options) => ipcRenderer.invoke('gemini:stream', options),
        listModels: () => ipcRenderer.invoke('gemini:listModels'),
        onChunk: (streamId, callback) => {
            const channel = `gemini:chunk:${streamId}`;
            const listener = (_, chunk) => callback(chunk);
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
    },
    codex: {
        initialize: (options) => ipcRenderer.invoke('codex:initialize', options),
        turn: (options) => ipcRenderer.invoke('codex:turn', options),
        approve: (sessionId, toolCallId, decision) => ipcRenderer.invoke('codex:approve', sessionId, toolCallId, decision),
        stop: () => ipcRenderer.invoke('codex:stop'),
        rpc: (method, params) => ipcRenderer.invoke('codex:rpc', { method, params }),
        onEvent: (callback) => {
            const listener = (_, event) => callback(event);
            ipcRenderer.on('codex:event', listener);
            return () => ipcRenderer.removeListener('codex:event', listener);
        },
        onExit: (callback) => {
            const listener = (_, code) => callback(code);
            ipcRenderer.on('codex:exit', listener);
            return () => ipcRenderer.removeListener('codex:exit', listener);
        },
    },
    popout: {
        open: (paneId, paneConfig) => ipcRenderer.invoke('popout:open', paneId, paneConfig),
        close: (paneId) => ipcRenderer.invoke('popout:close', paneId),
        stateRelay: (paneId, state) => ipcRenderer.send('popout:state-relay', paneId, state),
        sendAction: (action) => ipcRenderer.send('popout:action-relay', action),
        onStateUpdate: (callback) => {
            const listener = (_, state) => callback(state);
            ipcRenderer.on('popout:state-update', listener);
            return () => ipcRenderer.removeListener('popout:state-update', listener);
        },
        onAction: (callback) => {
            const listener = (_, action) => callback(action);
            ipcRenderer.on('popout:action', listener);
            return () => ipcRenderer.removeListener('popout:action', listener);
        },
        onClosed: (callback) => {
            const listener = (_, paneId) => callback(paneId);
            ipcRenderer.on('popout:closed', listener);
            return () => ipcRenderer.removeListener('popout:closed', listener);
        },
    },
    workflowTools: {
        // Dispatch a workflow tool call by IPC channel name
        call: (channel, args) => {
            const allowed = [
                'fs:read', 'fs:write', 'fs:append', 'fs:list', 'fs:move', 'fs:copy', 'fs:delete', 'fs:exists',
                'git:status', 'git:diff', 'git:add', 'git:commit', 'git:push', 'git:pull',
                'git:checkout', 'git:branch', 'git:log', 'git:stash',
                'notify',
                'db:connect', 'db:query', 'db:tables', 'db:schema', 'db:disconnect',
            ];
            if (!allowed.includes(channel)) {
                return Promise.reject(new Error(`workflowTools: unknown channel "${channel}"`));
            }
            return ipcRenderer.invoke(channel, args);
        },
    },
});

// Legacy electronAPI for backwards compatibility
contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    startCodeServer: (port, workspacePath) => ipcRenderer.invoke('codeserver:start', port, workspacePath),
    stopCodeServer: () => ipcRenderer.invoke('codeserver:stop'),
});
