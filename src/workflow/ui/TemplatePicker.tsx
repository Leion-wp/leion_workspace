import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../templates';
import { useWorkflowStore } from '../store';
import './TemplatePicker.css';

interface TemplatePickerProps {
    onClose: () => void;
}

export function TemplatePicker({ onClose }: TemplatePickerProps) {
    const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSelect = (id: string) => {
        loadTemplate(id);
        onClose();
    };

    return (
        <div className="template-picker-backdrop" onClick={onClose}>
            <div
                ref={overlayRef}
                className="template-picker"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="template-picker-header">
                    <span className="template-picker-title">New from Template</span>
                    <button className="template-picker-close" onClick={onClose}><X size={14} /></button>
                </div>
                <div className="template-picker-grid">
                    {WORKFLOW_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            className="template-picker-item"
                            onClick={() => handleSelect(t.id)}
                        >
                            <span className="template-picker-item-name">{t.name}</span>
                            <span className="template-picker-item-desc">{t.description}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
