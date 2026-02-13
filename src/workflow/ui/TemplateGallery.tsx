import { useEffect, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '../templates/index';
import { useWorkflowStore } from '../store';
import './TemplateGallery.css';

interface TemplateGalleryProps {
    onSelect: (template: WorkflowTemplate) => void;
    onClose: () => void;
}

type Category = 'all' | 'development' | 'research' | 'automation' | 'ai' | 'files';

const CATEGORY_LABELS: Record<Category, string> = {
    all: 'All',
    development: 'Development',
    research: 'Research',
    automation: 'Automation',
    ai: 'AI',
    files: 'Files',
};

const CATEGORY_COLORS: Record<string, string> = {
    development: '#58a6ff',
    research: '#3fb950',
    automation: '#d29922',
    ai: '#bc8cff',
    files: '#f78166',
};

export function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
    const [selectedCategory, setSelectedCategory] = useState<Category>('all');
    const [search, setSearch] = useState('');
    const overlayRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const setNodes = useWorkflowStore((s) => s.setNodes);
    const setEdges = useWorkflowStore((s) => s.setEdges);
    const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
    const setVariable = useWorkflowStore((s) => s.setVariable);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        searchRef.current?.focus();
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const filtered = WORKFLOW_TEMPLATES.filter((t) => {
        const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
        const q = search.toLowerCase();
        const matchesSearch =
            !q ||
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q));
        return matchesCategory && matchesSearch;
    });

    const handleSelect = (template: WorkflowTemplate) => {
        setNodes(template.definition.nodes);
        setEdges(template.definition.edges);
        setWorkflowName(template.name);
        // Apply template variables
        const vars = template.definition.variables ?? {};
        Object.entries(vars).forEach(([key, value]) => setVariable(key, value));
        onSelect(template);
        onClose();
    };

    const categories: Category[] = ['all', 'development', 'research', 'automation', 'ai', 'files'];

    return (
        <div className="template-gallery-backdrop" onClick={onClose}>
            <div
                ref={overlayRef}
                className="template-gallery"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="template-gallery-header">
                    <span className="template-gallery-title">New from Template</span>
                    <button className="template-gallery-close" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>

                <div className="template-gallery-search-bar">
                    <Search size={14} className="template-gallery-search-icon" />
                    <input
                        ref={searchRef}
                        className="template-gallery-search"
                        type="text"
                        placeholder="Search templates..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="template-gallery-categories">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={`template-gallery-category-btn${selectedCategory === cat ? ' active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {CATEGORY_LABELS[cat]}
                        </button>
                    ))}
                </div>

                <div className="template-gallery-grid">
                    {filtered.length === 0 ? (
                        <div className="template-gallery-empty">
                            No templates match your search.
                        </div>
                    ) : (
                        filtered.map((t) => (
                            <button
                                key={t.id}
                                className="template-gallery-card"
                                onClick={() => handleSelect(t)}
                            >
                                <div className="template-gallery-card-header">
                                    <span className="template-gallery-card-name">{t.name}</span>
                                    <span
                                        className="template-gallery-card-badge"
                                        style={{ color: CATEGORY_COLORS[t.category] ?? '#8b949e', borderColor: CATEGORY_COLORS[t.category] ?? '#30363d' }}
                                    >
                                        {t.category}
                                    </span>
                                </div>
                                <span className="template-gallery-card-desc">{t.description}</span>
                                <div className="template-gallery-card-tags">
                                    {t.tags.slice(0, 4).map((tag) => (
                                        <span key={tag} className="template-gallery-tag">{tag}</span>
                                    ))}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
