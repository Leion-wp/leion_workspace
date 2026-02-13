import { useEffect, useState } from 'react';
import { mcpClient, type MCPConnectionStatus } from '../services/mcp';
import { Play, Square, Wrench, GitBranch, StickyNote, Timer, Search, Globe, Repeat, Terminal, FileCode, MessageSquare, GitFork, BookOpen, BookMarked, Layout, FolderOpen, Bell, GitCommit, PenLine, Save, Table2, Camera, GitCompare, Database, Trash2, FileText, FileEdit, Zap, SlidersHorizontal, ChevronDown, ArrowDownToLine, Eye, KeyRound, Check, FileJson, Keyboard, Code, MousePointerClick } from 'lucide-react';
import type { WorkflowNodeData, WorkflowNodeType } from '../workflow/types';
import {
    WORKFLOW_DND_NODE_DATA_MIME,
    WORKFLOW_DND_NODE_TYPE_MIME,
    normalizeWorkflowNodeData,
    toWorkflowDragPayload,
} from './workflowDnd';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/input';

// Moved outside to prevent re-mounting
const Section = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-border/40 last:border-0">
            <button
                className="w-full flex items-center justify-between py-2 px-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                onClick={() => setIsOpen(!isOpen)}
            >
                {title}
                <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen ? "rotate-180" : "")} />
            </button>
            {isOpen && <div className="pb-3 grid grid-cols-2 gap-2 animate-accordion-down">{children}</div>}
        </div>
    )
}

const SectionWrapper = ({
    id,
    title,
    children,
    draggedSection,
    onDragStart,
    onDragOver,
    onDrop,
    defaultOpen = true
}: {
    id: string,
    title: string,
    children: React.ReactNode,
    draggedSection: string | null,
    onDragStart: (e: React.DragEvent, id: string) => void,
    onDragOver: (e: React.DragEvent, id: string) => void,
    onDrop: (e: React.DragEvent, id: string) => void,
    defaultOpen?: boolean
}) => (
    <div
        className={cn(
            "border-b border-border/40 last:border-0",
            draggedSection === id ? "opacity-50" : "opacity-100"
        )}
        draggable
        onDragStart={(e) => onDragStart(e, id)}
        onDragOver={(e) => onDragOver(e, id)}
        onDrop={(e) => onDrop(e, id)}
    >
        <Section title={title} defaultOpen={defaultOpen}>
            {children}
        </Section>
    </div>
);

export default function WorkflowSidebar() {
    const [status, setStatus] = useState<MCPConnectionStatus>(mcpClient.getStatus());
    const [search, setSearch] = useState('');
    const [sectionOrder, setSectionOrder] = useState<string[]>([
        'essentials', 'browser', 'terminal', 'data', 'control',
        'interaction', 'memory', 'processing', 'git', 'mcp'
    ]);
    const [draggedSection, setDraggedSection] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = mcpClient.subscribe(setStatus);
        return () => { unsubscribe() };
    }, []);

    const filteredTools = status.tools.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase())
    );

    const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType, nodeData: Record<string, unknown> = {}) => {
        event.stopPropagation();
        const normalizedData: WorkflowNodeData = normalizeWorkflowNodeData(nodeData, nodeType);
        event.dataTransfer.setData(WORKFLOW_DND_NODE_TYPE_MIME, nodeType);
        event.dataTransfer.setData(WORKFLOW_DND_NODE_DATA_MIME, JSON.stringify(normalizedData));
        event.dataTransfer.setData('text/plain', toWorkflowDragPayload(nodeType, normalizedData));
        event.dataTransfer.effectAllowed = 'copyMove';
    };

    const onDragEnd = () => { };

    const D = (type: WorkflowNodeType, label: string, icon: React.ReactNode) => (
        <div
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border/50 hover:border-primary/50 hover:bg-accent cursor-grab active:cursor-grabbing transition-all text-xs font-medium text-foreground select-none"
            draggable
            onDragStart={(e) => onDragStart(e, type, { label })}
            onDragEnd={onDragEnd}
        >
            <div className="text-muted-foreground">{icon}</div>
            <span className="truncate">{label}</span>
        </div>
    );

    const handleSectionDragStart = (e: React.DragEvent, id: string) => {
        setDraggedSection(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleSectionDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleSectionDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedSection || draggedSection === targetId) return;

        const newOrder = [...sectionOrder];
        const oldIndex = newOrder.indexOf(draggedSection);
        const newIndex = newOrder.indexOf(targetId);

        if (oldIndex !== -1 && newIndex !== -1) {
            newOrder.splice(oldIndex, 1);
            newOrder.splice(newIndex, 0, draggedSection);
            setSectionOrder(newOrder);
        }
        setDraggedSection(null);
    };

    const renderSection = (id: string) => {
        const props = {
            id,
            draggedSection,
            onDragStart: handleSectionDragStart,
            onDragOver: handleSectionDragOver,
            onDrop: handleSectionDrop
        };

        switch (id) {
            case 'essentials': return (
                <SectionWrapper {...props} title="Essentials" key={id}>
                    {D('start', 'Start', <Play size={14} className="text-green-500" />)}
                    {D('end', 'End', <Square size={14} className="text-red-500" />)}
                    {D('comment', 'Comment', <StickyNote size={14} className="text-yellow-500" />)}
                    {D('subworkflow', 'Subworkflow', <GitFork size={14} className="text-indigo-500" />)}
                </SectionWrapper>
            );
            case 'browser': return (
                <SectionWrapper {...props} title="Browser Automation" key={id} defaultOpen={true}>
                    {D('navigate', 'Navigate', <Globe size={14} className="text-blue-400" />)}
                    {D('click', 'Click', <MousePointerClick size={14} className="text-blue-400" />)}
                    {D('fill', 'Fill Input', <Keyboard size={14} className="text-blue-400" />)}
                    {D('extract', 'Extract Data', <Table2 size={14} className="text-blue-400" />)}
                    {D('screenshot', 'Screenshot', <Camera size={14} className="text-blue-400" />)}
                    {D('scroll', 'Scroll', <ArrowDownToLine size={14} className="text-blue-400" />)}
                    {D('execute-js', 'Execute JS', <FileCode size={14} className="text-blue-400" />)}
                </SectionWrapper>
            );
            case 'terminal': return (
                <SectionWrapper {...props} title="Terminal & Editor" key={id}>
                    {D('run', 'Run Command', <Terminal size={14} className="text-slate-400" />)}
                    {D('send-input', 'Send Input', <Keyboard size={14} className="text-slate-400" />)}
                    {D('read-terminal', 'Read Output', <Eye size={14} className="text-slate-400" />)}
                    {D('wait-pattern', 'Wait Pattern', <Timer size={14} className="text-slate-400" />)}
                    {D('write-editor', 'Write Editor', <PenLine size={14} className="text-slate-400" />)}
                    {D('read-editor', 'Read Editor', <FileText size={14} className="text-slate-400" />)}
                    {D('save-file', 'Save File', <Save size={14} className="text-slate-400" />)}
                </SectionWrapper>
            );
            case 'data': return (
                <SectionWrapper {...props} title="Data & Files" key={id} defaultOpen={false}>
                    {D('read-file', 'Read File', <FileText size={14} className="text-orange-400" />)}
                    {D('write-file', 'Write File', <FileEdit size={14} className="text-orange-400" />)}
                    {D('list-files', 'List Files', <FolderOpen size={14} className="text-orange-400" />)}
                    {D('db-query', 'Query DB', <Database size={14} className="text-blue-500" />)}
                    {D('db-insert', 'Insert DB', <Database size={14} className="text-blue-500" />)}
                </SectionWrapper>
            );
            case 'control': return (
                <SectionWrapper {...props} title="Control Flow" key={id}>
                    {D('if', 'If / Else', <GitBranch size={14} className="text-pink-500" />)}
                    {D('switch', 'Switch', <GitFork size={14} className="text-pink-500" />)}
                    {D('repeat', 'Loop', <Repeat size={14} className="text-pink-500" />)}
                    {D('race', 'Race', <Zap size={14} className="text-pink-500" />)}
                    {D('pause', 'Delay', <Timer size={14} className="text-pink-500" />)}
                </SectionWrapper>
            );
            case 'interaction': return (
                <SectionWrapper {...props} title="Interaction & API" key={id}>
                    {D('ask', 'Ask AI', <MessageSquare size={14} className="text-purple-400" />)}
                    {D('notify', 'Notify User', <Bell size={14} className="text-purple-400" />)}
                    {D('fetch', 'HTTP Request', <Globe size={14} className="text-purple-400" />)}
                    {D('space', 'Switch Space', <Layout size={14} className="text-purple-400" />)}
                </SectionWrapper>
            );
            case 'memory': return (
                <SectionWrapper {...props} title="Memory & Variables" key={id}>
                    {D('remember', 'Remember', <BookMarked size={14} className="text-teal-400" />)}
                    {D('recall', 'Recall', <BookOpen size={14} className="text-teal-400" />)}
                    {D('variable', 'Set Variable', <SlidersHorizontal size={14} className="text-teal-400" />)}
                    {D('read-env', 'Read Env', <KeyRound size={14} className="text-teal-400" />)}
                    {D('forget', 'Forget', <Trash2 size={14} className="text-teal-400" />)}
                </SectionWrapper>
            );
            case 'processing': return (
                <SectionWrapper {...props} title="Data Processing" key={id}>
                    {D('format', 'Format', <Code size={14} className="text-indigo-400" />)}
                    {D('parse', 'Parse', <FileJson size={14} className="text-indigo-400" />)}
                    {D('validate', 'Validate', <Check size={14} className="text-indigo-400" />)}
                    {D('diff', 'Diff', <GitCompare size={14} className="text-indigo-400" />)}
                </SectionWrapper>
            );
            case 'git': return (
                <SectionWrapper {...props} title="Git" key={id}>
                    {D('git-status', 'Git Status', <GitBranch size={14} className="text-orange-600" />)}
                    {D('git-diff', 'Git Diff', <GitCompare size={14} className="text-orange-600" />)}
                    {D('git-commit', 'Git Commit', <GitCommit size={14} className="text-orange-600" />)}
                </SectionWrapper>
            );
            case 'mcp': return (
                <SectionWrapper {...props} title="MCP Tools" key={id}>
                    {status.connected ? (
                        filteredTools.length > 0 ? (
                            <div className="col-span-2 space-y-2">
                                {filteredTools.map(tool => (
                                    <div
                                        key={tool.name}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 border border-border/30 hover:border-primary/50 hover:bg-accent cursor-grab active:cursor-grabbing transition-all text-xs text-foreground group"
                                        draggable
                                        onDragStart={(event) => onDragStart(event, 'tool', {
                                            label: tool.name,
                                            description: tool.description,
                                            inputSchema: tool.inputSchema
                                        })}
                                        onDragEnd={onDragEnd}
                                        title={tool.description}
                                    >
                                        <Wrench size={14} className="text-amber-500" />
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate font-medium">{tool.name}</div>
                                            <div className="truncate text-[10px] text-muted-foreground">{tool.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="col-span-2 text-xs text-muted-foreground italic text-center py-2">
                                {search ? 'No matches' : 'No tools found'}
                            </div>
                        )
                    ) : (
                        <div className="col-span-2 text-xs text-muted-foreground italic text-center py-2">
                            MCP not connected
                        </div>
                    )}
                </SectionWrapper>
            );
            default: return null;
        }
    };

    return (
        <div className="w-64 bg-card/95 border-r border-border/40 flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-border/40">
                <h2 className="text-sm font-semibold mb-2 px-1">Nodes</h2>
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="h-8 pl-8 text-xs bg-secondary/50"
                        placeholder="Search nodes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
                {sectionOrder.map(id => renderSection(id))}
            </div>
        </div>
    );
}
