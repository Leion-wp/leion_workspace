const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const isDev = !app.isPackaged;
const userDataPath = app.getPath('userData');
const securityStrictMode = process.env.LEION_SECURITY_STRICT === '1';
const allowedPathRoots = new Set([
    path.resolve(process.cwd()),
    path.resolve(userDataPath),
]);

let mainWindow;
const terminals = new Map(); // Store terminal processes
const popoutWindows = new Map(); // paneId -> BrowserWindow

function addAllowedPathRoot(targetPath) {
    if (!targetPath) return;
    allowedPathRoots.add(path.resolve(targetPath));
}

function isWithinRoot(rootPath, targetPath) {
    const relative = path.relative(rootPath, targetPath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertPathAccess(targetPath, operation) {
    const resolved = path.resolve(String(targetPath));
    const allowed = [...allowedPathRoots].some((rootPath) => isWithinRoot(rootPath, resolved));
    if (!allowed) {
        const message = `[Security] ${operation} outside allowed roots: ${resolved}`;
        if (securityStrictMode) throw new Error(message);
        console.warn(message);
    }
    return resolved;
}

function isPrivateHost(hostname) {
    const host = String(hostname || '').toLowerCase().split('%')[0];
    if (!host) return true;
    if (host === 'localhost' || host.endsWith('.local')) return true;

    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
        const [a, b] = host.split('.').map((part) => Number(part));
        if (a === 10 || a === 127) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 169 && b === 254) return true;
        return false;
    }

    if (ipVersion === 6) {
        return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
    }

    return false;
}

function validateMcpUrl(serverUrl) {
    let parsed;
    try {
        parsed = new URL(serverUrl);
    } catch {
        throw new Error(`Invalid MCP URL: "${serverUrl}"`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported MCP protocol: ${parsed.protocol}`);
    }

    if (isPrivateHost(parsed.hostname)) {
        const message = `[Security] MCP target is private host "${parsed.hostname}"`;
        if (securityStrictMode) throw new Error(message);
        console.warn(message);
    }

    return parsed;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
        },
    });

    // Handle webview new-window requests - navigate in same webview instead of opening popup
    mainWindow.webContents.on('did-attach-webview', (event, webviewWebContents) => {
        webviewWebContents.setWindowOpenHandler(({ url }) => {
            // Navigate in the same webview instead of opening new window
            webviewWebContents.loadURL(url);
            return { action: 'deny' };
        });
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window:close', () => mainWindow?.close());

// Storage (layout persistence)
ipcMain.handle('storage:save', async (_, key, data) => {
    const filePath = path.join(userDataPath, `${key}.json`);
    fs.writeFileSync(filePath, data, 'utf-8');
});

ipcMain.handle('storage:load', async (_, key) => {
    const filePath = path.join(userDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
});

// Filesystem IPC
ipcMain.handle('fs:readDir', async (_, dirPath) => {
    try {
        const safeDirPath = assertPathAccess(dirPath, 'fs:readDir');
        const entries = fs.readdirSync(safeDirPath, { withFileTypes: true });
        return entries
            .filter((e) => !e.name.startsWith('.'))
            .sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                return a.name.localeCompare(b.name);
            })
            .map((e) => ({
                name: e.name,
                isDirectory: e.isDirectory(),
                path: path.join(safeDirPath, e.name).replace(/\\/g, '/'),
                extension: e.isDirectory() ? '' : path.extname(e.name).toLowerCase(),
            }));
    } catch (err) {
        return [];
    }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
    const safePath = assertPathAccess(filePath, 'fs:readFile');
    return fs.readFileSync(safePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
    const safePath = assertPathAccess(filePath, 'fs:writeFile');
    fs.writeFileSync(safePath, content, 'utf-8');
});

ipcMain.handle('fs:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = path.resolve(result.filePaths[0]);
    addAllowedPathRoot(selected);
    return selected.replace(/\\/g, '/');
});

// Terminal IPC with node-pty
const pty = require('node-pty');

ipcMain.handle('terminal:create', async (_, terminalId, options = {}) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    let env = { ...process.env };
    let initCommands = []; // Commands to run on startup

    // Gemini Terminal Integration
    if (options.type === 'gemini') {
        try {
            const tmpDir = require('os').tmpdir(); // Added 'os' import
            const ideDir = path.join(tmpDir, 'gemini', 'ide');

            console.log('[Gemini Terminal] Looking for config in:', ideDir);

            if (fs.existsSync(ideDir)) {
                // Find most recent gemini-ide-server-*.json
                const files = fs.readdirSync(ideDir)
                    .filter(f => f.startsWith('gemini-ide-server-') && f.endsWith('.json'))
                    .map(f => ({ name: f, time: fs.statSync(path.join(ideDir, f)).mtime.getTime() }))
                    .sort((a, b) => b.time - a.time);

                if (files.length > 0) {
                    // Manual injection disabled to favor CLI auto-discovery
                    const latestConfig = JSON.parse(fs.readFileSync(path.join(ideDir, files[0].name), 'utf-8'));
                    env['GEMINI_CLI_IDE_SERVER_PORT'] = String(latestConfig.port);
                    env['GEMINI_CLI_IDE_AUTH_TOKEN'] = latestConfig.authToken;
                    console.log(`[Gemini Terminal] Injected config from ${files[0].name}: Port ${latestConfig.port}`);

                    env['TERM_PROGRAM'] = 'vscode'; // Trick CLI into accepting connection

                    // Point alias to actual executable
                    // Check common install locations
                    const pathsToCheck = [
                        path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe'),
                        path.join(process.env.ProgramFiles, 'Antigravity', 'Antigravity.exe'),
                        path.join(process.env['ProgramFiles(x86)'], 'Antigravity', 'Antigravity.exe')
                    ];

                    let antigravityPath = path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe');
                    for (const p of pathsToCheck) {
                        if (fs.existsSync(p)) {
                            antigravityPath = p;
                            break;
                        }
                    }
                    env['ANTIGRAVITY_CLI_ALIAS'] = antigravityPath;
                    env['NO_PROXY'] = '*';

                    // Find config matching current workspace
                    let foundConfig = null;
                    const currentWorkspace = process.cwd().toLowerCase().replace(/\\/g, '/');

                    for (const file of files) {
                        try {
                            const configPath = path.join(ideDir, file.name);
                            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            const configWorkspace = (config.workspacePath || '').toLowerCase().replace(/\\/g, '/');

                            // Loose matching: check if config workspace contains current or vice versa to be safe, 
                            // or exact match. detected 'd:\intent_router' vs 'd:\leion_workspace'.
                            // Let's use exact match on normalized path.
                            if (configWorkspace && (configWorkspace === currentWorkspace || currentWorkspace.startsWith(configWorkspace))) {
                                foundConfig = { ...config, filename: file.name };
                                break;
                            }
                        } catch (e) {
                            console.warn('[Gemini Terminal] Failed to read config:', file.name, e);
                        }
                    }

                    if (foundConfig) {
                        env['GEMINI_CLI_IDE_SERVER_PORT'] = String(foundConfig.port);
                        env['GEMINI_CLI_IDE_AUTH_TOKEN'] = foundConfig.authToken;
                        console.log(`[Gemini Terminal] Injected config from ${foundConfig.filename}: Port ${foundConfig.port}`);

                        // Diagnostics
                        initCommands.push(`Write-Host "✅ Gemini Terminal: Connected to Antigravity (Port ${foundConfig.port})" -ForegroundColor Green`);

                    } else {
                        console.log('[Gemini Terminal] No config found for workspace:', currentWorkspace);
                        initCommands.push(`Write-Host "⚠️ Gemini Terminal: No active Antigravity config found for this workspace." -ForegroundColor Yellow`);
                        initCommands.push(`Write-Host "   looked in: ${ideDir}" -ForegroundColor Gray`);
                        initCommands.push(`Write-Host "   Workspace: ${currentWorkspace}" -ForegroundColor Gray`);
                        initCommands.push(`Write-Host "👉 Please restart Antigravity/Connect script to generate a new config." -ForegroundColor Cyan`);
                    }
                } else {
                    console.log('[Gemini Terminal] No config files found.');
                    initCommands.push(`Write-Host "⚠️ Gemini Terminal: No Antigravity config found in ${ideDir}" -ForegroundColor Yellow`);
                }
            } else {
                console.log('[Gemini Terminal] Config directory not found:', ideDir);
                initCommands.push(`Write-Host "⚠️ Gemini Terminal: Config directory not found (${ideDir})" -ForegroundColor Yellow`);
            }
        } catch (err) {
            console.error('[Gemini Terminal] Setup failed:', err);
            initCommands.push(`Write-Host "❌ Gemini Terminal: Setup failed - ${err.message}" -ForegroundColor Red`);
        }
    }

    // Determine CWD: prefer option -> then process.cwd() (app root) -> then home dir
    // For Gemini, defaulting to project root (process.cwd()) is usually what we want.
    const defaultCwd = process.cwd();
    const cwd = options.cwd || defaultCwd || process.env.USERPROFILE || process.env.HOME;

    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: env,
    });

    terminals.set(terminalId, ptyProcess);

    ptyProcess.onData((data) => {
        mainWindow?.webContents.send(`terminal:data:${terminalId}`, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send(`terminal:exit:${terminalId}`, exitCode);
        terminals.delete(terminalId);
    });

    // Execute initialization commands
    if (initCommands.length > 0) {
        setTimeout(() => {
            initCommands.forEach(cmd => ptyProcess.write(cmd + '\r'));
        }, 500);
    }

    // Auto-start gemini for this terminal type
    if (options.type === 'gemini') {
        setTimeout(() => {
            ptyProcess.write('gemini\r');
        }, 1000); // Wait for init commands
    }

    return true;
});

ipcMain.on('terminal:input', (_, terminalId, data) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

ipcMain.on('terminal:resize', (_, terminalId, cols, rows) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
        ptyProcess.resize(cols, rows);
    }
});

ipcMain.on('terminal:destroy', (_, terminalId) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
        ptyProcess.kill();
        terminals.delete(terminalId);
    }
});

// File Watcher IPC (chokidar)
const chokidar = require('chokidar');
const watchers = new Map(); // watcherId -> chokidar.FSWatcher

ipcMain.handle('filewatcher:start', async (_, watcherId, globPattern, cwd) => {
    if (watchers.has(watcherId)) {
        watchers.get(watcherId).close();
    }
    const watcher = chokidar.watch(globPattern, {
        cwd: cwd || process.cwd(),
        ignoreInitial: true,
        persistent: true,
    });
    watcher.on('change', (filePath) => {
        mainWindow?.webContents.send('filewatcher:event', watcherId, 'change', filePath);
    });
    watcher.on('add', (filePath) => {
        mainWindow?.webContents.send('filewatcher:event', watcherId, 'add', filePath);
    });
    watcher.on('unlink', (filePath) => {
        mainWindow?.webContents.send('filewatcher:event', watcherId, 'unlink', filePath);
    });
    watchers.set(watcherId, watcher);
    return true;
});

ipcMain.handle('filewatcher:stop', async (_, watcherId) => {
    const watcher = watchers.get(watcherId);
    if (watcher) {
        await watcher.close();
        watchers.delete(watcherId);
    }
    return true;
});

// Browser webview JS execution
ipcMain.handle('browser:executeInPane', async (event, paneId, script) => {
    // Send to renderer to execute in the right webview
    mainWindow?.webContents.send('browser:executeInPane:request', paneId, script);
    // Response will come via browser:executeInPane:response channel
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Browser execute timeout')), 15000);
        ipcMain.once(`browser:executeInPane:response:${paneId}`, (_, result, error) => {
            clearTimeout(timeout);
            if (error) reject(new Error(error));
            else resolve(result);
        });
    });
});

// Code-server process management
let codeServerProcess = null;

ipcMain.handle('codeserver:start', async (_, port = 8080, workspacePath = '') => {
    try {
        // Check if already running
        if (codeServerProcess) {
            return { success: true, port };
        }

        // Find code-server executable
        const isWin = process.platform === 'win32';
        const codeServerCmd = isWin ? 'code-server.cmd' : 'code-server';

        // Spawn code-server
        const args = [
            '--port', String(port),
            '--auth', 'none',
            '--disable-telemetry',
        ];

        if (workspacePath) {
            args.push(workspacePath);
        }

        codeServerProcess = spawn(codeServerCmd, args, {
            shell: true,
            env: { ...process.env },
        });

        codeServerProcess.on('error', (err) => {
            console.error('code-server error:', err);
            codeServerProcess = null;
        });

        codeServerProcess.on('exit', (code) => {
            console.log('code-server exited with code:', code);
            codeServerProcess = null;
        });

        // Give it a moment to start
        return { success: true, port };
    } catch (err) {
        console.error('Failed to start code-server:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('codeserver:stop', async () => {
    if (codeServerProcess) {
        codeServerProcess.kill();
        codeServerProcess = null;
    }
    return { success: true };
});

// MCP Proxy - bypass CORS by making requests from main process
ipcMain.handle('mcp:request', async (_, serverUrl, bodyOrMethod, params, headers = {}) => {
    try {
        const http = require('http');
        const https = require('https');
        const parsedUrl = validateMcpUrl(serverUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        let body;
        // Check if we received a full body object (for notifications support) or legacy arguments
        if (typeof bodyOrMethod === 'object') {
            body = JSON.stringify(bodyOrMethod);
            // Headers arg is shifted
            if (params && typeof params === 'object') {
                headers = params;
            }
        } else {
            // Legacy mode: method, params
            body = JSON.stringify({
                jsonrpc: '2.0',
                method: bodyOrMethod,
                params,
                id: Date.now(),
            });
        }

        // Default headers
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(body),
            ...headers // Merge custom headers (like session ID)
        };

        return new Promise((resolve) => {
            const req = client.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: `${parsedUrl.pathname}${parsedUrl.search}`,
                method: 'POST',
                headers: requestHeaders,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    // console.log('[MCP] Response status:', res.statusCode);
                    // console.log('[MCP] Response headers:', JSON.stringify(res.headers, null, 2));
                    // console.log('[MCP] Raw response:', data.substring(0, 500));

                    try {
                        // Check for session ID in query params (if redirect) or headers
                        // Return headers to renderer so it can extract session info

                        // Handle empty response (e.g. 202 Accepted for notifications)
                        if (!data || data.trim().length === 0) {
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve({ success: true, result: null, headers: res.headers });
                                return;
                            }
                        }

                        // Try plain JSON first
                        const json = JSON.parse(data);
                        if (json.error) {
                            resolve({ success: false, error: json.error.message, headers: res.headers });
                        } else {
                            resolve({ success: true, result: json.result, headers: res.headers });
                        }
                    } catch (e) {
                        // Try SSE format: look for "data: {...}" lines
                        const sseMatch = data.match(/data:\s*(\{.*\})/);
                        if (sseMatch) {
                            try {
                                const json = JSON.parse(sseMatch[1]);
                                if (json.error) {
                                    resolve({ success: false, error: json.error.message, headers: res.headers });
                                } else {
                                    resolve({ success: true, result: json.result, headers: res.headers });
                                }
                            } catch (e2) {
                                console.log('[MCP] SSE parse error:', e2.message);
                                resolve({ success: false, error: 'Failed to parse SSE response', headers: res.headers });
                            }
                        } else {
                            console.log('[MCP] Parse error:', e.message);
                            resolve({ success: false, error: 'Invalid response format: ' + data.substring(0, 100), headers: res.headers });
                        }
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            req.write(body);
            req.end();
        });
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// ─── Environment Variables ───────────────────────────────────────────────────

ipcMain.handle('env:load', async () => {
    const envPath = path.join(process.cwd(), '.env');
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        const vars = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            vars[key] = value;
        }
        return vars;
    } catch {
        return {};
    }
});

// ─── Filesystem Tool IPC ──────────────────────────────────────────────────────

ipcMain.handle('fs:read', async (_, { path: filePath, encoding = 'utf8' }) => {
    try {
        const safePath = assertPathAccess(filePath, 'fs:read');
        return fs.readFileSync(safePath, encoding);
    } catch (err) {
        throw new Error(`fs:read failed for "${filePath}": ${err.message}`);
    }
});

ipcMain.handle('fs:write', async (_, { path: filePath, content, encoding = 'utf8' }) => {
    try {
        const safePath = assertPathAccess(filePath, 'fs:write');
        const dir = path.dirname(safePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(safePath, content, encoding);
        return { success: true };
    } catch (err) {
        throw new Error(`fs:write failed for "${filePath}": ${err.message}`);
    }
});

ipcMain.handle('fs:append', async (_, { path: filePath, content, encoding = 'utf8' }) => {
    try {
        const safePath = assertPathAccess(filePath, 'fs:append');
        const dir = path.dirname(safePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(safePath, content, encoding);
        return { success: true };
    } catch (err) {
        throw new Error(`fs:append failed for "${filePath}": ${err.message}`);
    }
});

ipcMain.handle('fs:list', async (_, { dir: dirPath, glob: globPattern = '**/*' }) => {
    try {
        const safeDirPath = assertPathAccess(dirPath, 'fs:list');
        // Simple recursive listing with basic glob support (prefix match on extension)
        const results = [];
        const walk = (currentDir, baseDir) => {
            let entries;
            try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); }
            catch { return; }
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                if (entry.isDirectory()) {
                    walk(fullPath, baseDir);
                } else {
                    // Simple glob: match by extension or wildcard
                    const ext = path.extname(entry.name);
                    const globExt = globPattern.includes('.') ? globPattern.slice(globPattern.lastIndexOf('.')) : '';
                    if (globPattern === '**/*' || globPattern === '*' || (globExt && ext === globExt)) {
                        results.push({ path: fullPath.replace(/\\/g, '/'), name: entry.name, relPath });
                    }
                }
            }
        };
        walk(safeDirPath, safeDirPath);
        return results;
    } catch (err) {
        throw new Error(`fs:list failed for "${dirPath}": ${err.message}`);
    }
});

ipcMain.handle('fs:move', async (_, { src, dest }) => {
    try {
        const safeSrc = assertPathAccess(src, 'fs:move(src)');
        const safeDest = assertPathAccess(dest, 'fs:move(dest)');
        const dir = path.dirname(safeDest);
        fs.mkdirSync(dir, { recursive: true });
        fs.renameSync(safeSrc, safeDest);
        return { success: true };
    } catch (err) {
        throw new Error(`fs:move failed "${src}" -> "${dest}": ${err.message}`);
    }
});

ipcMain.handle('fs:copy', async (_, { src, dest }) => {
    try {
        const safeSrc = assertPathAccess(src, 'fs:copy(src)');
        const safeDest = assertPathAccess(dest, 'fs:copy(dest)');
        const dir = path.dirname(safeDest);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(safeSrc, safeDest);
        return { success: true };
    } catch (err) {
        throw new Error(`fs:copy failed "${src}" -> "${dest}": ${err.message}`);
    }
});

ipcMain.handle('fs:delete', async (_, { path: filePath }) => {
    try {
        const safePath = assertPathAccess(filePath, 'fs:delete');
        const stat = fs.statSync(safePath);
        if (stat.isDirectory()) {
            fs.rmSync(safePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(safePath);
        }
        return { success: true };
    } catch (err) {
        throw new Error(`fs:delete failed for "${filePath}": ${err.message}`);
    }
});

ipcMain.handle('fs:exists', async (_, { path: filePath }) => {
    const safePath = assertPathAccess(filePath, 'fs:exists');
    return { exists: fs.existsSync(safePath), path: safePath };
});

// ─── Desktop Notifications ────────────────────────────────────────────────────

ipcMain.handle('notify', async (_, { title, body, icon }) => {
    try {
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
            const n = new Notification({ title, body, icon: icon || undefined });
            n.show();
            return { success: true };
        }
        return { success: false, reason: 'Notifications not supported' };
    } catch (err) {
        return { success: false, reason: err.message };
    }
});

// ─── Git Operations ───────────────────────────────────────────────────────────

function assertSafeGitValue(value, label) {
    const token = String(value ?? '').trim();
    if (!token) return '';
    if (token.includes('\0') || token.includes('\n') || token.includes('\r')) {
        throw new Error(`Invalid git ${label}: contains control characters`);
    }
    if (token.startsWith('-')) {
        throw new Error(`Invalid git ${label}: cannot start with "-"`);
    }
    return token;
}

function normalizeGitFiles(files) {
    if (Array.isArray(files)) {
        const cleaned = files
            .map((f) => String(f).trim())
            .filter(Boolean)
            .map((f) => assertSafeGitValue(f, 'files'));
        return cleaned.length > 0 ? cleaned : ['.'];
    }

    const single = String(files ?? '.').trim();
    return [assertSafeGitValue(single || '.', 'files')];
}

async function runGit(args, cwd) {
    const resolvedCwd = cwd && cwd !== '.' ? cwd : process.cwd();
    try {
        const { stdout, stderr } = await execFileAsync('git', args, {
            cwd: resolvedCwd,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
        });
        return { success: true, output: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
        throw new Error(`git ${args[0]} failed: ${err.message}`);
    }
}

ipcMain.handle('git:status', async (_, { cwd }) => runGit(['status', '--short'], cwd));
ipcMain.handle('git:diff', async (_, { cwd, staged }) => runGit(staged ? ['diff', '--cached'] : ['diff'], cwd));
ipcMain.handle('git:add', async (_, { cwd, files }) => runGit(['add', ...normalizeGitFiles(files)], cwd));
ipcMain.handle('git:commit', async (_, { cwd, message }) => {
    const safeMessage = String(message ?? '');
    return runGit(['commit', '-m', safeMessage], cwd);
});
ipcMain.handle('git:push', async (_, { cwd, remote, branch }) => {
    const safeRemote = assertSafeGitValue(remote || 'origin', 'remote');
    const safeBranch = assertSafeGitValue(branch || '', 'branch');
    return runGit(safeBranch ? ['push', safeRemote, safeBranch] : ['push', safeRemote], cwd);
});
ipcMain.handle('git:pull', async (_, { cwd, remote, branch }) => {
    const safeRemote = assertSafeGitValue(remote || 'origin', 'remote');
    const safeBranch = assertSafeGitValue(branch || '', 'branch');
    return runGit(safeBranch ? ['pull', safeRemote, safeBranch] : ['pull', safeRemote], cwd);
});
ipcMain.handle('git:checkout', async (_, { cwd, branch }) => runGit(['checkout', assertSafeGitValue(branch, 'branch')], cwd));
ipcMain.handle('git:branch', async (_, { cwd, name }) => {
    if (name) return runGit(['branch', assertSafeGitValue(name, 'branch')], cwd);
    return runGit(['branch', '--list'], cwd);
});
ipcMain.handle('git:log', async (_, { cwd }) => runGit(['log', '--oneline', '-20'], cwd));
ipcMain.handle('git:stash', async (_, { cwd, message }) => {
    if (message) {
        return runGit(['stash', 'push', '-m', String(message)], cwd);
    }
    return runGit(['stash'], cwd);
});

// ─── Database Operations (SQLite via better-sqlite3) ──────────────────────────

let BetterSqlite3 = null;
try {
    BetterSqlite3 = require('better-sqlite3');
} catch (e) {
    console.warn('better-sqlite3 not available, DB operations will be mocked. Run: npm install better-sqlite3');
}

const openDatabases = new Map(); // dbPath -> db instance

ipcMain.handle('db:connect', async (_, { path: dbPath }) => {
    if (!BetterSqlite3) {
        return { success: false, error: 'better-sqlite3 not installed. Run: npm install better-sqlite3' };
    }
    try {
        if (openDatabases.has(dbPath)) {
            return { success: true, path: dbPath };
        }
        const db = new BetterSqlite3(dbPath);
        openDatabases.set(dbPath, db);
        return { success: true, path: dbPath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:query', async (_, { path: dbPath, sql, params = [] }) => {
    const db = openDatabases.get(dbPath);
    if (!db) return { success: false, error: 'Not connected. Call db:connect first.' };
    try {
        const start = Date.now();
        const stmt = db.prepare(sql);
        const upperSql = sql.trim().toUpperCase();
        const isSelect = upperSql.startsWith('SELECT') ||
            upperSql.startsWith('WITH') ||
            upperSql.startsWith('PRAGMA');
        let result;
        if (isSelect) {
            const rows = stmt.all(...params);
            const columns = stmt.columns ? stmt.columns().map((c) => c.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
            result = { rows, columns };
        } else {
            const info = stmt.run(...params);
            result = { affected: info.changes, lastInsertRowid: info.lastInsertRowid };
        }
        return { success: true, ...result, executionTime: Date.now() - start };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:tables', async (_, { path: dbPath }) => {
    const db = openDatabases.get(dbPath);
    if (!db) return { success: false, error: 'Not connected.' };
    try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        return { success: true, tables: tables.map((t) => t.name) };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:schema', async (_, { path: dbPath, table }) => {
    const db = openDatabases.get(dbPath);
    if (!db) return { success: false, error: 'Not connected.' };
    try {
        const info = db.prepare(`PRAGMA table_info("${table}")`).all();
        return { success: true, columns: info };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:disconnect', async (_, { path: dbPath }) => {
    const db = openDatabases.get(dbPath);
    if (db) {
        db.close();
        openDatabases.delete(dbPath);
    }
    return { success: true };
});

// ─── Gemini SDK Integration ───────────────────────────────────────────────────

let GoogleGenAI = null;
let geminiClient = null;
let geminiStreamCounter = 0;

function loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    const vars = {};
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            vars[key] = value;
        }
    } catch { }
    return vars;
}

async function getGeminiClient() {
    if (geminiClient) return geminiClient;

    // Dynamic ESM import for @google/genai (CJS main process)
    if (!GoogleGenAI) {
        const mod = await import('@google/genai');
        GoogleGenAI = mod.GoogleGenAI;
    }

    const env = loadEnvFile();
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not found in .env or environment');

    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
}

ipcMain.handle('gemini:chat', async (_, { messages, model = 'gemini-2.0-flash' }) => {
    try {
        const ai = await getGeminiClient();
        // Build contents for single-turn or multi-turn
        const contents = messages.map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const response = await ai.models.generateContent({
            model,
            contents,
        });
        return { text: response.text || '' };
    } catch (err) {
        throw new Error(`Gemini chat error: ${err.message}`);
    }
});

ipcMain.handle('gemini:stream', async (_, { messages, model = 'gemini-2.0-flash' }) => {
    try {
        const ai = await getGeminiClient();
        const streamId = `gemini-stream-${++geminiStreamCounter}`;
        const contents = messages.map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        // Launch streaming in background
        (async () => {
            try {
                const response = await ai.models.generateContentStream({
                    model,
                    contents,
                });
                for await (const chunk of response) {
                    const text = chunk.text || '';
                    if (text) {
                        mainWindow?.webContents.send(`gemini:chunk:${streamId}`, { text, done: false });
                    }
                }
                mainWindow?.webContents.send(`gemini:chunk:${streamId}`, { text: '', done: true });
            } catch (err) {
                mainWindow?.webContents.send(`gemini:chunk:${streamId}`, { text: '', done: true, error: err.message });
            }
        })();

        return { streamId };
    } catch (err) {
        throw new Error(`Gemini stream error: ${err.message}`);
    }
});

// ─── Codex App-Server Integration ─────────────────────────────────────────────

let codexProcess = null;
let codexRequestId = 0;
const codexPendingRequests = new Map(); // id -> { resolve, reject }
let codexBuffer = '';

function startCodexProcess() {
    if (codexProcess) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'codex' : 'codex';
        codexProcess = spawn(cmd, ['app-server'], {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        codexProcess.stdout.on('data', (data) => {
            codexBuffer += data.toString();
            // Parse JSONL lines
            let newlineIdx;
            while ((newlineIdx = codexBuffer.indexOf('\n')) !== -1) {
                const line = codexBuffer.slice(0, newlineIdx).trim();
                codexBuffer = codexBuffer.slice(newlineIdx + 1);
                if (!line) continue;
                try {
                    const msg = JSON.parse(line);
                    // JSON-RPC response (has id)
                    if (msg.id !== undefined && codexPendingRequests.has(msg.id)) {
                        const { resolve: res, reject: rej } = codexPendingRequests.get(msg.id);
                        codexPendingRequests.delete(msg.id);
                        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
                        else res(msg.result);
                    }
                    // Notification (no id) — forward to renderer
                    if (msg.id === undefined || msg.method) {
                        mainWindow?.webContents.send('codex:event', msg);
                    }
                } catch (e) {
                    // Not valid JSON, ignore
                }
            }
        });

        codexProcess.stderr.on('data', (data) => {
            console.error('[Codex stderr]', data.toString());
        });

        codexProcess.on('error', (err) => {
            console.error('[Codex] Process error:', err.message);
            mainWindow?.webContents.send('codex:exit', -1);
            codexProcess = null;
            reject(err);
        });

        codexProcess.on('exit', (code) => {
            console.log('[Codex] Process exited with code:', code);
            mainWindow?.webContents.send('codex:exit', code || 0);
            codexProcess = null;
            // Reject all pending requests
            for (const [, { reject: rej }] of codexPendingRequests) {
                rej(new Error('Codex process exited'));
            }
            codexPendingRequests.clear();
        });

        // Give it a moment to start
        setTimeout(resolve, 500);
    });
}

function sendCodexRPC(method, params) {
    if (!codexProcess) return Promise.reject(new Error('Codex process not running'));
    const id = ++codexRequestId;
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n';
    return new Promise((resolve, reject) => {
        codexPendingRequests.set(id, { resolve, reject });
        codexProcess.stdin.write(msg);
    });
}

ipcMain.handle('codex:initialize', async (_, options) => {
    try {
        await startCodexProcess();
        const result = await sendCodexRPC('initialize', {
            clientInfo: options.clientInfo || { name: 'Leion', version: '1.0' },
        });
        return result || { sessionId: `codex-${Date.now()}` };
    } catch (err) {
        throw new Error(`Codex init error: ${err.message}`);
    }
});

ipcMain.handle('codex:turn', async (_, options) => {
    try {
        await sendCodexRPC('turn.create', {
            sessionId: options.sessionId,
            message: options.message,
        });
    } catch (err) {
        throw new Error(`Codex turn error: ${err.message}`);
    }
});

ipcMain.handle('codex:approve', async (_, sessionId, toolCallId, decision) => {
    try {
        await sendCodexRPC('tool.approve', { sessionId, toolCallId, decision });
    } catch (err) {
        throw new Error(`Codex approve error: ${err.message}`);
    }
});

ipcMain.handle('codex:stop', async () => {
    if (codexProcess) {
        codexProcess.kill();
        codexProcess = null;
    }
    return { success: true };
});

// ─── Popout Window Management ─────────────────────────────────────────────────

ipcMain.handle('popout:open', async (_, paneId, paneConfig) => {
    if (popoutWindows.has(paneId)) {
        // Focus existing popout
        const existing = popoutWindows.get(paneId);
        if (!existing.isDestroyed()) {
            existing.focus();
            return { success: true, alreadyOpen: true };
        }
        popoutWindows.delete(paneId);
    }

    const popoutWin = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
        },
    });

    const url = isDev
        ? `http://localhost:5173?popout=${encodeURIComponent(paneId)}`
        : `file://${path.join(__dirname, '../dist/index.html')}?popout=${encodeURIComponent(paneId)}`;

    popoutWin.loadURL(url);

    // Handle webview popup requests in popout window
    popoutWin.webContents.on('did-attach-webview', (event, webviewWebContents) => {
        webviewWebContents.setWindowOpenHandler(({ url: targetUrl }) => {
            webviewWebContents.loadURL(targetUrl);
            return { action: 'deny' };
        });
    });

    popoutWindows.set(paneId, popoutWin);

    // Send initial pane state once loaded
    popoutWin.webContents.once('did-finish-load', () => {
        popoutWin.webContents.send('popout:state-update', { paneConfig, title: paneId });
    });

    popoutWin.on('closed', () => {
        popoutWindows.delete(paneId);
        // Notify main window that popout was closed
        mainWindow?.webContents.send('popout:closed', paneId);
    });

    return { success: true };
});

ipcMain.on('popout:state-relay', (_, paneId, state) => {
    const popoutWin = popoutWindows.get(paneId);
    if (popoutWin && !popoutWin.isDestroyed()) {
        popoutWin.webContents.send('popout:state-update', state);
    }
});

ipcMain.on('popout:action-relay', (_, action) => {
    // Forward actions from popout windows to main window
    mainWindow?.webContents.send('popout:action', action);
});

ipcMain.handle('popout:close', async (_, paneId) => {
    const popoutWin = popoutWindows.get(paneId);
    if (popoutWin && !popoutWin.isDestroyed()) {
        popoutWin.close();
    }
    popoutWindows.delete(paneId);
    return { success: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    // Kill all terminals
    terminals.forEach((proc) => proc.kill());
    terminals.clear();

    // Close all popout windows
    popoutWindows.forEach((win) => { if (!win.isDestroyed()) win.close(); });
    popoutWindows.clear();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
