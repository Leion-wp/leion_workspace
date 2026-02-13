import { useCallback, useRef, useState } from 'react';
import { Play, Square, AlertTriangle, Download, Upload, Terminal, Undo2, Redo2, LayoutDashboard, Maximize, FlaskConical, TestTube2, LayoutTemplate, History, Sun, Moon, Zap, Cable, Save } from 'lucide-react';
import { useWorkflowStore } from '../store';
import { useSettingsStore } from '../../store/settings';
import { serializeToSaveData } from '../engine/serializer';
import { TemplatePicker } from './TemplatePicker';
import { TemplateGallery } from './TemplateGallery';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';

interface WorkflowToolbarProps {
    onAutoLayout?: () => void;
    onFitView?: () => void;
    historyOpen?: boolean;
    onToggleHistory?: () => void;
    triggersOpen?: boolean;
    onToggleTriggers?: () => void;
    liveWireOpen?: boolean;
    onToggleLiveWire?: () => void;
    testRunnerOpen?: boolean;
    onToggleTestRunner?: () => void;
}

export function WorkflowToolbar({ onAutoLayout, onFitView, historyOpen, onToggleHistory, triggersOpen, onToggleTriggers, liveWireOpen, onToggleLiveWire, testRunnerOpen, onToggleTestRunner }: WorkflowToolbarProps) {
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [showTemplateGallery, setShowTemplateGallery] = useState(false);
    const isExecuting = useWorkflowStore((s) => s.isExecuting);
    const dryRun = useWorkflowStore((s) => s.dryRun);
    const toggleDryRun = useWorkflowStore((s) => s.toggleDryRun);

    // Use settings store for theme consistency
    const { theme, toggleTheme } = useSettingsStore();

    const validationErrors = useWorkflowStore((s) => s.validationErrors);
    const workflowName = useWorkflowStore((s) => s.workflowName);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const variables = useWorkflowStore((s) => s.variables);
    const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
    const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
    const stopWorkflow = useWorkflowStore((s) => s.stopWorkflow);
    const importWorkflow = useWorkflowStore((s) => s.importWorkflow);
    const executionPanelOpen = useWorkflowStore((s) => s.executionPanelOpen);
    const toggleExecutionPanel = useWorkflowStore((s) => s.toggleExecutionPanel);
    const autoCheckpoint = useWorkflowStore((s) => s.autoCheckpoint);
    const setAutoCheckpoint = useWorkflowStore((s) => s.setAutoCheckpoint);

    const handleUndo = useCallback(() => {
        useWorkflowStore.temporal.getState().undo();
    }, []);

    const handleRedo = useCallback(() => {
        useWorkflowStore.temporal.getState().redo();
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRun = useCallback(() => {
        runWorkflow();
    }, [runWorkflow]);

    const handleStop = useCallback(() => {
        stopWorkflow();
    }, [stopWorkflow]);

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setWorkflowName(e.target.value);
    }, [setWorkflowName]);

    const handleExport = useCallback(() => {
        const data = serializeToSaveData(nodes, edges, workflowName, variables);
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges, workflowName, variables]);

    const handleImport = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                importWorkflow(data);
            } catch {
                console.error('Failed to parse workflow JSON');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [importWorkflow]);

    return (
        <div className="h-12 border-b border-border/40 bg-card/95 backdrop-blur-sm top-0 z-10 flex items-center px-4 justify-between gap-4">
            <div className="flex items-center gap-1">
                {!isExecuting ? (
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleRun}
                        title="Run workflow"
                    >
                        <Play size={14} fill="currentColor" />
                        Run
                    </Button>
                ) : (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={handleStop}
                        title="Stop workflow"
                    >
                        <Square size={14} fill="currentColor" />
                        Stop
                    </Button>
                )}

                <div className="h-6 w-px bg-border/50 mx-2" />

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTemplateGallery(true)} title="New from template"><LayoutTemplate size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleImport} title="Import workflow"><Upload size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Export workflow"><Download size={14} /></Button>

                <div className="h-6 w-px bg-border/50 mx-2" />

                <Button variant="ghost" size="icon" className={cn("h-8 w-8", executionPanelOpen && "bg-accent text-accent-foreground")} onClick={toggleExecutionPanel} title="Toggle execution panel"><Terminal size={14} /></Button>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8", dryRun && "bg-amber-500/10 text-amber-500")} onClick={toggleDryRun} title="Dry-run"><FlaskConical size={14} /></Button>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8", autoCheckpoint && "bg-green-500/10 text-green-500")} onClick={() => setAutoCheckpoint(!autoCheckpoint)} title="Auto-checkpoint"><Save size={14} /></Button>

                {onToggleHistory && <Button variant="ghost" size="icon" className={cn("h-8 w-8", historyOpen && "bg-accent")} onClick={onToggleHistory}><History size={14} /></Button>}
                {onToggleTriggers && <Button variant="ghost" size="icon" className={cn("h-8 w-8", triggersOpen && "bg-accent")} onClick={onToggleTriggers}><Zap size={14} /></Button>}
                {onToggleLiveWire && <Button variant="ghost" size="icon" className={cn("h-8 w-8", liveWireOpen && "bg-accent")} onClick={onToggleLiveWire}><Cable size={14} /></Button>}
                {onToggleTestRunner && <Button variant="ghost" size="icon" className={cn("h-8 w-8", testRunnerOpen && "bg-accent")} onClick={onToggleTestRunner}><TestTube2 size={14} /></Button>}

                <div className="h-6 w-px bg-border/50 mx-2" />

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} title="Undo"><Undo2 size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} title="Redo"><Redo2 size={14} /></Button>

                <div className="h-6 w-px bg-border/50 mx-2" />

                {onAutoLayout && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAutoLayout} title="Auto-layout"><LayoutDashboard size={14} /></Button>}
                {onFitView && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitView} title="Zoom to fit"><Maximize size={14} /></Button>}

                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            </div>

            <div className="flex-1 max-w-md mx-4">
                <Input
                    className="h-8 text-center font-medium bg-transparent border-transparent hover:border-border focus:border-input transition-colors"
                    type="text"
                    value={workflowName}
                    onChange={handleNameChange}
                    placeholder="Untitled Workflow"
                />
            </div>

            <div className="flex items-center gap-2">
                {validationErrors.length > 0 && (
                    <div className="flex items-center gap-2 text-destructive text-xs font-medium px-3 py-1 bg-destructive/10 rounded-full" title={validationErrors.join('\n')}>
                        <AlertTriangle size={12} />
                        <span className="truncate max-w-[150px]">{validationErrors[0]}</span>
                    </div>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Toggle theme">
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
            </div>

            {showTemplatePicker && <TemplatePicker onClose={() => setShowTemplatePicker(false)} />}
            {showTemplateGallery && <TemplateGallery onSelect={() => { }} onClose={() => setShowTemplateGallery(false)} />}
        </div>
    );
}
