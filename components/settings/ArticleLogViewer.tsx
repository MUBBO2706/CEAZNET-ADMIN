import React, { useState } from 'react';
import { PanelCard, CopyButton } from '../ui';
import { 
    ArrowLeft, Link as LinkIcon, FileText, Image as ImageIcon, Calendar, Globe,
    Eye, Heart, Bookmark, Hash
} from 'lucide-react';

// --- Type Guard to ensure the row has the expected structure ---
export const isArticleData = (row: any): boolean => {
    return (
        row &&
        typeof row === 'object' &&
        'article_data' in row &&
        'formatted_content_md' in row &&
        typeof row.article_data === 'object' &&
        typeof row.formatted_content_md === 'object'
    );
};

// --- Helper Components ---

const simpleMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    return markdown
        .replace(/####\s(.*?)\n/g, '<h4 class="text-base font-bold text-[var(--text-primary)] mt-4 mb-2">$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
};

const JsonToggleCard: React.FC<{
    title: string;
    data: any;
    structuredRenderer: (data: any) => React.ReactNode;
}> = ({ title, data, structuredRenderer }) => {
    const [isStructured, setIsStructured] = useState(true);
    const rawJsonString = JSON.stringify(data, null, 2);

    return (
        <div className="pt-1">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold opacity-70 mb-0">{title}</h3>
                <div className="flex bg-[var(--subtle-bg)] rounded-sm p-0.5 border border-[var(--border-color)]/60 shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsStructured(true); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${isStructured ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Structured
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsStructured(false); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${!isStructured ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Raw
                    </button>
                </div>
            </div>

            <div className="relative group">
                 {!isStructured && <CopyButton textToCopy={rawJsonString} />}
                <div className="">
                    {isStructured ? (
                        structuredRenderer(data)
                    ) : (
                        <pre className="p-3 bg-[var(--subtle-bg)]/30 border border-[var(--subtle-border)] rounded-lg font-mono text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto custom-scrollbar [&::-webkit-scrollbar:horizontal]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <code>{rawJsonString}</code>
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Structured Renderers ---

const ArticleDataStructured: React.FC<{ data: any }> = ({ data }) => {
    if (!data) return <p className="text-sm text-[var(--text-secondary)]">No article data available.</p>;
    return (
        <div className="space-y-3">
            {data.image && (
                <img src={data.image} alt="Article Image" className="rounded-md w-full h-32 sm:h-40 object-cover bg-slate-100" />
            )}
            <h4 className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight">
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-color)] transition-colors">
                    {data.title}
                </a>
            </h4>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{data.description}</p>
            <div className="text-[11px] sm:text-xs text-[var(--text-secondary)] space-y-1.5 pt-2 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-1.5"><Globe size={12}/>Source: <a href={data.source?.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent-color)]">{data.source?.name}</a></div>
                <div className="flex items-center gap-1.5"><Calendar size={12}/>Published: {new Date(data.publishedAt).toLocaleString()}</div>
            </div>
        </div>
    );
};

const FormattedContentStructured: React.FC<{ data: any }> = ({ data }) => {
    if (!data || !data.markdown) return <p className="text-sm text-[var(--text-secondary)]">No formatted content available.</p>;
    const htmlContent = simpleMarkdownToHtml(data.markdown);
    return (
        <div 
            className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)] text-sm"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};


// --- Main Article Viewer Component ---

const ArticleLogViewer: React.FC<{ row: any; onBack: () => void }> = ({ row, onBack }) => {
    const metadataItems = [
        { icon: <Hash size={14} />, label: "Article ID", value: row.id },
        { icon: <Eye size={14} />, label: "Views", value: row.views },
        { icon: <Heart size={14} />, label: "Likes", value: row.likes },
        { icon: <Bookmark size={14} />, label: "Bookmarks", value: row.bookmarks },
    ];

    return (
        <div className="animate-fade-in-up space-y-6 pt-1">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="btn btn-secondary px-2 py-1 flex items-center gap-1 text-xs">
                    <ArrowLeft size={14} />
                    <span>Back</span>
                </button>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Article Details</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pb-4 border-b border-[var(--border-color)]">
                {metadataItems.map(item => (
                     <div key={item.label} className="flex flex-col gap-0.5">
                         <div className="flex items-center gap-1.5 text-[var(--text-secondary)] opacity-80">
                            {item.icon}
                            <span className="text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
                         </div>
                        <div className="font-semibold text-[var(--text-primary)] text-sm font-mono">{item.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <JsonToggleCard
                    title="Article Data"
                    data={row.article_data}
                    structuredRenderer={(data) => <ArticleDataStructured data={data} />}
                />
                <JsonToggleCard
                    title="Formatted Content"
                    data={row.formatted_content_md}
                    structuredRenderer={(data) => <FormattedContentStructured data={data} />}
                />
            </div>
        </div>
    );
};

export default ArticleLogViewer;