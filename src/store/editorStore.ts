import { create } from 'zustand';

interface EditorFile {
    path: string;
    content: string;
    isDirty: boolean;
    language: string;
}

interface EditorState {
    openFiles: EditorFile[];
    activeFilePath: string | null;
    addFile: (file: EditorFile) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
    setFileDirty: (path: string, isDirty: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    openFiles: [],
    activeFilePath: null,
    addFile: (file) => set((state) => {
        if (state.openFiles.some(f => f.path === file.path)) {
            return { activeFilePath: file.path };
        }
        return {
            openFiles: [...state.openFiles, file],
            activeFilePath: file.path
        };
    }),
    closeFile: (path) => set((state) => {
        const newFiles = state.openFiles.filter(f => f.path !== path);
        let newActive = state.activeFilePath;
        if (state.activeFilePath === path) {
            newActive = newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null;
        }
        return {
            openFiles: newFiles,
            activeFilePath: newActive
        };
    }),
    setActiveFile: (path) => set({ activeFilePath: path }),
    updateFileContent: (path, content) => set((state) => ({
        openFiles: state.openFiles.map(f =>
            f.path === path ? { ...f, content } : f
        )
    })),
    setFileDirty: (path, isDirty) => set((state) => ({
        openFiles: state.openFiles.map(f =>
            f.path === path ? { ...f, isDirty } : f
        )
    })),
}));
