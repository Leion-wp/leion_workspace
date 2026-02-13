import { useState } from 'react'

interface NotesData {
    content: string
}

interface NotesPaneProps {
    data?: NotesData
    onUpdate?: (data: NotesData) => void
}

export function NotesPane({ data, onUpdate }: NotesPaneProps) {
    const [content, setContent] = useState(data?.content || '')

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value
        setContent(newContent)
        onUpdate?.({ content: newContent })
    }

    return (
        <div className="h-full flex flex-col p-2 bg-background text-foreground">
            <textarea
                value={content}
                onChange={handleChange}
                placeholder="Write your notes here..."
                className="flex-1 bg-card text-card-foreground border border-border rounded-lg p-3 text-sm leading-relaxed resize-none font-sans focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
            />
        </div>
    )
}
