import { create } from 'zustand';

const STORAGE_KEY = 'leion-fs-root';

interface FsStore {
    rootPath: string;
    expanded: Set<string>;
    cache: Record<string, FsEntry[]>;
    loading: Set<string>;

    setRootPath: (path: string) => void;
    toggleExpand: (path: string) => void;
    loadDir: (path: string) => Promise<void>;
    refresh: (path: string) => Promise<void>;
    isExpanded: (path: string) => boolean;
    isLoading: (path: string) => boolean;
}

const savedRoot = typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) ?? 'd:/leion_workspace')
    : 'd:/leion_workspace';

export const useFsStore = create<FsStore>((set, get) => ({
    rootPath: savedRoot,
    expanded: new Set<string>(),
    cache: {},
    loading: new Set<string>(),

    setRootPath: (path) => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, path);
        }
        set({ rootPath: path, expanded: new Set(), cache: {} });
        get().loadDir(path);
    },

    toggleExpand: (path) => {
        const { expanded } = get();
        const next = new Set(expanded);
        if (next.has(path)) {
            next.delete(path);
            set({ expanded: next });
        } else {
            next.add(path);
            set({ expanded: next });
            get().loadDir(path);
        }
    },

    loadDir: async (path) => {
        const { cache, loading } = get();
        if (cache[path]) return; // already cached
        if (loading.has(path)) return;

        const nextLoading = new Set(get().loading);
        nextLoading.add(path);
        set({ loading: nextLoading });

        try {
            const entries = await window.platform.fs.readDir(path);
            const nextCache = { ...get().cache, [path]: entries };
            const doneLoading = new Set(get().loading);
            doneLoading.delete(path);
            set({ cache: nextCache, loading: doneLoading });
        } catch {
            const doneLoading = new Set(get().loading);
            doneLoading.delete(path);
            set({ loading: doneLoading });
        }
    },

    refresh: async (path) => {
        const nextCache = { ...get().cache };
        delete nextCache[path];
        set({ cache: nextCache });
        await get().loadDir(path);
    },

    isExpanded: (path) => get().expanded.has(path),
    isLoading: (path) => get().loading.has(path),
}));
