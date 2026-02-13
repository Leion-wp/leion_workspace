import { useState, useRef, useEffect } from 'react';
import { useContextMenu, type MenuItem } from '../components';
import type { BrowserData, BrowserTab } from './types';
import { browserCommandService } from '../services/browserCommandService';
import { usePaneStateStore } from './paneStateStore';

import {
    X, Plus, ChevronLeft, ChevronRight, RotateCw, Globe,
    Lock, AlertTriangle, Star, History, Wrench
} from 'lucide-react';
import { cn } from '../lib/utils';

interface BrowserPaneProps {
    id?: string;
    data?: BrowserData;
    onUpdate?: (data: Partial<BrowserData>) => void;
}

const createTab = (url = 'https://www.google.com'): BrowserTab => ({
    id: `tab-${Date.now()}`,
    url,
    title: 'New Tab',
    favicon: '',
    isLoading: false,
    isSecure: url.startsWith('https'),
});

export function BrowserPane({ id, data, onUpdate }: BrowserPaneProps) {
    const initialTab = createTab(data?.tabs?.[0]?.url);
    const [tabs, setTabs] = useState<BrowserTab[]>(data?.tabs || [initialTab]);
    const [activeTabId, setActiveTabIdState] = useState(data?.activeTabId || initialTab.id);
    const [inputUrl, setInputUrl] = useState('');
    const [bookmarks, setBookmarks] = useState(data?.bookmarks || []);
    const [history, setHistory] = useState<{ url: string; title: string; timestamp: number }[]>([])
    const [showHistory, setShowHistory] = useState(false);
    const [devToolsOpen, setDevToolsOpen] = useState(false);
    const webviewRef = useRef<HTMLWebViewElement>(null);
    const contextMenu = useContextMenu();

    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

    // --- EFFECT: Register JS Execution ---
    useEffect(() => {
        if (!id) return;
        const webview = webviewRef.current as any;
        if (webview) {
            browserCommandService.registerPane(id, (script: string) => {
                return webview.executeJavaScript(script);
            });
        }
        return () => {
            if (id) browserCommandService.unregisterPane(id);
        };
    }, [id]);

    // --- EFFECT: Ambient State ---
    useEffect(() => {
        if (!id) return;
        const initialUrl = activeTab?.url ?? '';
        usePaneStateStore.getState().setPaneState(id, {
            type: 'browser',
            url: initialUrl,
            title: activeTab?.title ?? 'New Tab',
            selectedText: '',
            isLoading: activeTab?.isLoading ?? false,
        });
        return () => {
            if (id) usePaneStateStore.getState().removePaneState(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // --- EFFECT: Sync URL Input ---
    useEffect(() => {
        if (activeTab) {
            setInputUrl(activeTab.url);
        }
    }, [activeTabId, activeTab?.url]);

    // --- EFFECT: Webview Listeners ---
    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        const handleLoadStart = () => {
            updateTab(activeTabId, { isLoading: true });
            if (id) usePaneStateStore.getState().updatePaneState(id, { isLoading: true });
        };

        const handleLoadStop = () => {
            updateTab(activeTabId, { isLoading: false });
            if (id) usePaneStateStore.getState().updatePaneState(id, { isLoading: false });
        };

        const handlePageTitleUpdated = (e: any) => {
            updateTab(activeTabId, { title: e.title });
            if (id) usePaneStateStore.getState().updatePaneState(id, { title: e.title });
        };

        const handlePageFaviconUpdated = (e: any) => {
            if (e.favicons?.[0]) {
                updateTab(activeTabId, { favicon: e.favicons[0] });
            }
        };

        const handleDidNavigate = (e: any) => {
            updateTab(activeTabId, {
                url: e.url,
                isSecure: e.url.startsWith('https'),
            });
            setInputUrl(e.url);
            if (id) usePaneStateStore.getState().updatePaneState(id, { url: e.url });

            // History
            setHistory(prev => {
                if (prev[0]?.url === e.url) return prev;
                return [{ url: e.url, title: '', timestamp: Date.now() }, ...prev].slice(0, 50);
            });
        };

        const handleNewWindow = (e: any) => {
            e.preventDefault();
            if (e.url) {
                updateTab(activeTabId, { url: e.url, isSecure: e.url.startsWith('https') });
                setInputUrl(e.url);
            }
        };

        webview.addEventListener('did-start-loading', handleLoadStart);
        webview.addEventListener('did-stop-loading', handleLoadStop);
        webview.addEventListener('page-title-updated', handlePageTitleUpdated);
        webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated);
        webview.addEventListener('did-navigate', handleDidNavigate);
        webview.addEventListener('did-navigate-in-page', handleDidNavigate);
        webview.addEventListener('new-window', handleNewWindow);

        return () => {
            webview.removeEventListener('did-start-loading', handleLoadStart);
            webview.removeEventListener('did-stop-loading', handleLoadStop);
            webview.removeEventListener('page-title-updated', handlePageTitleUpdated);
            webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated);
            webview.removeEventListener('did-navigate', handleDidNavigate);
            webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
            webview.removeEventListener('new-window', handleNewWindow);
        };
    }, [activeTabId]);

    // --- ACTIONS ---

    // --- EFFECT: Sync to Parent ---
    useEffect(() => {
        onUpdate?.({ tabs, activeTabId, bookmarks });
    }, [tabs, activeTabId, bookmarks, onUpdate]);

    // --- ACTIONS ---

    const updateTab = (id: string, updates: Partial<BrowserTab>) => {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    };

    const addTab = (url = 'https://www.google.com') => {
        const newTab = createTab(url);
        setTabs(prev => [...prev, newTab]);
        setActiveTabIdState(newTab.id);
    };

    const closeTab = (id: string) => {
        if (tabs.length <= 1) return;
        setTabs(prev => {
            const newTabs = prev.filter((t) => t.id !== id);
            return newTabs;
        });
        if (activeTabId === id) {
            // We need to determine the new active ID based on the *new* tabs list
            // Since we're inside a setter, we can't easily see the new list to set activeTabIdState nicely without logic duplication or refs.
            // Simplified: direct update
            const remaining = tabs.filter(t => t.id !== id);
            if (remaining.length > 0) setActiveTabIdState(remaining[0].id);
        }
    };
    // Re-implement closeTab to be cleaner with dependencies


    const setActiveTabId = (id: string) => {
        setActiveTabIdState(id);
    };

    const navigate = (url: string) => {
        let finalUrl = url.trim();
        if (!finalUrl.includes('.') && !finalUrl.startsWith('http')) {
            finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
        } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        updateTab(activeTabId, { url: finalUrl, isSecure: finalUrl.startsWith('https') });
        setInputUrl(finalUrl);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(inputUrl);
    };

    const goBack = () => (webviewRef.current as any)?.goBack?.();
    const goForward = () => (webviewRef.current as any)?.goForward?.();
    const refresh = () => (webviewRef.current as any)?.reload?.();

    const toggleDevTools = () => {
        const webview = webviewRef.current as any;
        if (webview?.isDevToolsOpened?.()) {
            webview.closeDevTools();
            setDevToolsOpen(false);
        } else {
            webview?.openDevTools?.();
            setDevToolsOpen(true);
        }
    };

    const addBookmark = () => {
        if (!activeTab) return;
        const exists = bookmarks.some((b) => b.url === activeTab.url);
        if (!exists) {
            setBookmarks(prev => [...prev, {
                url: activeTab.url,
                title: activeTab.title,
                favicon: activeTab.favicon,
            }]);
        }
    };

    const handleTabContextMenu = (e: React.MouseEvent, tab: BrowserTab) => {
        e.preventDefault();
        const items: MenuItem[] = [
            { label: 'Duplicate Tab', icon: '📋', action: () => addTab(tab.url) },
            { label: 'Add Bookmark', icon: '🔖', action: addBookmark },
            { label: 'Copy URL', icon: '🔗', action: () => navigator.clipboard.writeText(tab.url) },
            { separator: true, label: '', action: () => { } },
            { label: 'Close Tab', icon: '✕', action: () => closeTab(tab.id), disabled: tabs.length <= 1 },
        ];
        contextMenu.show(e.clientX, e.clientY, items);
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            {/* --- Tabs --- */}
            <div className="flex items-center h-10 bg-muted/50 border-b border-border/50 px-2 gap-1 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={cn(
                            "group relative flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] h-8 rounded-md text-xs font-medium cursor-pointer transition-all border border-transparent",
                            tab.id === activeTabId
                                ? "bg-background shadow-sm border-border text-foreground"
                                : "bg-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTabId(tab.id)}
                        onContextMenu={(e) => handleTabContextMenu(e, tab)}
                    >
                        {tab.isLoading ? (
                            <RotateCw size={12} className="animate-spin text-primary" />
                        ) : tab.favicon ? (
                            <img src={tab.favicon} className="w-3 h-3 rounded-sm object-contain" alt="" />
                        ) : (
                            <Globe size={12} className="text-muted-foreground" />
                        )}

                        <span className="truncate flex-1">{tab.title}</span>

                        {tabs.length > 1 && (
                            <button
                                className={cn(
                                    "opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 p-0.5 rounded-sm transition-opacity",
                                    tab.id === activeTabId ? "opacity-100" : ""
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => addTab()}
                    className="p-1.5 hover:bg-muted-foreground/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="New Tab"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* --- Toolbar --- */}
            <div className="h-12 flex items-center gap-2 px-3 py-2 bg-card border-b border-border shadow-sm z-10">
                <div className="flex items-center gap-1">
                    <button onClick={goBack} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={goForward} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50">
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={refresh} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground">
                        <RotateCw size={14} className={cn(activeTab?.isLoading && "animate-spin")} />
                    </button>
                </div>

                <div className="flex-1 flex max-w-3xl mx-auto items-center relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {activeTab?.isSecure ? (
                            <Lock size={12} className="text-green-500/80" />
                        ) : activeTab?.url.startsWith('http:') ? (
                            <AlertTriangle size={12} className="text-amber-500/80" />
                        ) : (
                            <Globe size={12} />
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="w-full">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            className="w-full h-8 pl-8 pr-16 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-transparent focus:border-primary/50 rounded-full text-xs transition-all outline-none"
                            placeholder="Search Google or type a URL"
                        />
                    </form>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button onClick={addBookmark} className="p-1 hover:bg-muted-foreground/10 rounded-full text-muted-foreground hover:text-yellow-400 transition-colors">
                            <Star size={12} fill={bookmarks.some(b => b.url === activeTab?.url) ? "currentColor" : "none"} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={cn("p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground", showHistory && "bg-muted text-foreground")}
                        title="History"
                    >
                        <History size={16} />
                    </button>
                    <button
                        onClick={toggleDevTools}
                        className={cn("p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground", devToolsOpen && "bg-muted text-primary")}
                        title="Developer Tools"
                    >
                        <Wrench size={16} />
                    </button>
                </div>
            </div>

            {/* --- History Overlay --- */}
            {showHistory && (
                <div className="absolute right-2 top-24 w-80 max-h-[400px] bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-lg flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between p-3 border-b border-border/50">
                        <h3 className="font-medium text-sm">Recent History</h3>
                        <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-muted rounded-full">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 text-xs">
                        {history.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground italic">No history yet</div>
                        ) : (
                            history.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => { navigate(item.url); setShowHistory(false); }}
                                    className="w-full text-left p-2 hover:bg-accent/50 rounded-md truncate group max-w-full"
                                >
                                    <div className="font-medium truncate text-foreground group-hover:text-primary transition-colors">{item.title || item.url}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">{item.url}</div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* --- Bookmarks Overlay (optional, could be a bar) --- */}
            {bookmarks.length > 0 && inputUrl === '' && (
                <div className="absolute top-24 left-0 w-full p-8 flex justify-center z-0 pointer-events-none">
                    <div className="flex flex-wrap gap-4 max-w-4xl justify-center pointer-events-auto">
                        {bookmarks.map((b, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(b.url)}
                                className="flex flex-col items-center gap-2 w-24 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                            >
                                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform">
                                    {b.favicon ? <img src={b.favicon} className="w-6 h-6" /> : "🌐"}
                                </div>
                                <span className="text-xs text-center truncate w-full text-muted-foreground group-hover:text-foreground">{b.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Content --- */}
            <div className="flex-1 relative bg-white">
                {activeTab?.isLoading && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden z-20">
                        <div className="h-full bg-primary animate-progress-indeterminate" />
                    </div>
                )}
                {/* 
                  NOTE: 'webview' tag is Electron-specific. 
                  React TSX might complain about intrinsic elements.
                  Ideally add 'webview' to global.d.ts or suppress 
                */}
                {/* @ts-ignore */}
                <webview
                    ref={webviewRef}
                    src={activeTab?.url}
                    className="w-full h-full"
                    // @ts-ignore
                    allowpopups="true"
                />
            </div>
        </div>
    );
}
