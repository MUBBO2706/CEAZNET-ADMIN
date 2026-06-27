
import React, { useState, useEffect } from 'react';
import { PanelCard, ConfirmationModal, CustomDropdown, timeAgo } from '../ui';
import { LoadingSpinner } from '../skeletons';
import { fetchNewsArticles, deleteNewsArticle, createNewsArticle, updateNewsArticle } from '../../services/supabaseService';
import type { NewsArticle } from '../../types';
import { Search, Trash2, ExternalLink, Tag, Loader2, Eye, Heart, Edit, Plus, X, Save, Image as ImageIcon, Globe, Link as LinkIcon, Check, Clock, FileText, ChevronRight } from 'lucide-react';
import ReactDOM from 'react-dom';

// --- Article Create/Edit Modal ---
const ArticleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (article: Partial<NewsArticle>) => Promise<void>;
    initialData?: NewsArticle | null;
}> = ({ isOpen, onClose, onSave, initialData }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState('Technology');
    const [sourceName, setSourceName] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [views, setViews] = useState(0);
    const [likes, setLikes] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.article_data.title || '');
            setUrl(initialData.article_data.url || '');
            setCategory(initialData.category || 'Technology');
            setSourceName(initialData.article_data.source?.name || '');
            setImageUrl(initialData.article_data.image || '');
            setViews(initialData.views || 0);
            setLikes(initialData.likes || 0);
        } else if (isOpen) {
            setTitle('');
            setUrl('');
            setCategory('Technology');
            setSourceName('');
            setImageUrl('');
            setViews(0);
            setLikes(0);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                category,
                views,
                likes,
                article_data: {
                    title,
                    url,
                    source: { name: sourceName },
                    image: imageUrl,
                    publishedAt: initialData?.article_data?.publishedAt || new Date().toISOString()
                }
            });
            onClose();
        } catch (error) {
            console.error("Failed to save article:", error);
            alert("Failed to save article.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-bg backdrop-blur-sm" onClick={onClose}>
            <div className="modal-content w-full max-w-lg m-4 !rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-5 border-b border-[var(--border-color)] bg-[var(--subtle-bg)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded-lg">
                            {initialData ? <Edit size={18} /> : <Plus size={18} />}
                        </div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">
                            {initialData ? 'Edit Article' : 'Add New Article'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[var(--card-bg)]">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Title</label>
                        <input 
                            required
                            className="form-input w-full text-sm py-2" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            placeholder="Enter article headline..."
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Category</label>
                            <CustomDropdown
                                options={['Technology', 'Business', 'Science', 'Health', 'Sports', 'Entertainment']}
                                value={category}
                                onChange={setCategory}
                                className="w-full"
                                triggerClassName="py-2 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Source Name</label>
                            <input 
                                className="form-input w-full text-sm py-2" 
                                value={sourceName} 
                                onChange={e => setSourceName(e.target.value)} 
                                placeholder="e.g., TechCrunch"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Article URL</label>
                        <input 
                            required
                            type="url"
                            className="form-input w-full font-mono text-xs py-2" 
                            value={url} 
                            onChange={e => setUrl(e.target.value)} 
                            placeholder="https://example.com/article"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Image URL (Optional)</label>
                        <input 
                            type="url"
                            className="form-input w-full font-mono text-xs py-2" 
                            value={imageUrl} 
                            onChange={e => setImageUrl(e.target.value)} 
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Views</label>
                            <input 
                                type="number"
                                min="0"
                                className="form-input w-full text-sm py-2" 
                                value={views} 
                                onChange={e => setViews(parseInt(e.target.value) || 0)} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Likes</label>
                            <input 
                                type="number"
                                min="0"
                                className="form-input w-full text-sm py-2" 
                                value={likes} 
                                onChange={e => setLikes(parseInt(e.target.value) || 0)} 
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-[var(--border-color)]">
                        <button type="button" onClick={onClose} className="btn btn-secondary text-sm px-4 py-2">Cancel</button>
                        <button type="submit" className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2 shadow-sm" disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                            {isSaving ? 'Saving...' : 'Save Article'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const NewsContentManager: React.FC = () => {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);
    
    // State for Create/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);

    const headerRef = React.useRef<HTMLDivElement>(null);

    const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const loadArticles = async () => {
        setLoading(true);
        try {
            const data = await fetchNewsArticles();
            setArticles(data);
        } catch (error) {
            console.error("Failed to fetch articles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArticles();
    }, []);

    const handleDelete = async () => {
        if (deleteId) {
            await deleteNewsArticle(deleteId);
            setDeleteId(null);
            loadArticles();
        }
    };

    const handleSaveArticle = async (articleData: Partial<NewsArticle>) => {
        if (editingArticle) {
            await updateNewsArticle(editingArticle.id, articleData);
        } else {
            await createNewsArticle(articleData);
        }
        loadArticles();
    };

    const openCreateModal = () => {
        setEditingArticle(null);
        setIsModalOpen(true);
    };

    const openEditModal = (article: NewsArticle) => {
        setEditingArticle(article);
        setIsModalOpen(true);
    };

    const handleCopyLink = (id: number, url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredArticles = articles.filter(a => 
        a.article_data.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.category?.toLowerCase().includes(search.toLowerCase()) ||
        a.article_data.source?.name?.toLowerCase().includes(search.toLowerCase())
    );

    // Helper to get domain for favicon
    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
            return null;
        }
    };

    return (
        <>
            <div className="flex flex-col w-full pb-24 animate-fade-in-up">
                {loading ? (
                    <div className="flex flex-col justify-center items-center min-h-[50vh] w-full">
                        <LoadingSpinner message="Loading your articles..." />
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className="p-20 text-center text-[var(--text-secondary)] bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm">
                        <div className="flex flex-col items-center gap-4 opacity-60">
                            <div className="p-4 bg-[var(--subtle-bg)] rounded-full">
                                <Globe size={40} strokeWidth={1.5} />
                            </div>
                            <p className="font-medium text-lg">No articles found.</p>
                            <p className="text-sm">Start by adding a new article to your database.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
                        {filteredArticles.map(article => {
                            const favicon = getFaviconUrl(article.article_data.url);
                            const thumbnail = (article.article_data as any).image; 
                            const hasThumbnail = !!thumbnail;

                            return (
                                <div 
                                    key={article.id} 
                                    className="group flex flex-col bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-color)]/30 relative"
                                >
                                    {/* Top Image Area */}
                                    <div className="relative h-40 w-full overflow-hidden bg-[var(--subtle-bg)] border-b border-[var(--border-color)]">
                                        {hasThumbnail ? (
                                            <img src={thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] opacity-50">
                                                <ImageIcon size={28} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">No Image</span>
                                            </div>
                                        )}
                                        
                                        {/* Floating Badges */}
                                        <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase bg-white/95 dark:bg-black/90 text-[var(--text-primary)] shadow-sm backdrop-blur-md border border-[var(--border-color)]/50">
                                                <Tag size={10} className="text-[var(--accent-color)]" /> 
                                                {article.category}
                                            </span>
                                        </div>

                                        <div className="absolute top-2.5 right-2.5 flex flex-col items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-1 group-hover:translate-x-0">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openEditModal(article); }}
                                                className="p-1.5 rounded-lg bg-white/95 dark:bg-black/90 text-[var(--text-primary)] hover:text-[var(--accent-color)] shadow-sm backdrop-blur-md transition-colors border border-[var(--border-color)]/50"
                                                title="Edit"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteId(article.id); }}
                                                className="p-1.5 rounded-lg bg-white/95 dark:bg-black/90 text-[var(--text-primary)] hover:text-[var(--danger)] shadow-sm backdrop-blur-md transition-colors border border-[var(--border-color)]/50"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-4 flex flex-col flex-grow">
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {favicon && <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-[3px] shadow-sm shrink-0" />}
                                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">
                                                    {article.article_data.source?.name || 'Unknown'}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-70 shrink-0">
                                                {new Date(article.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>
                                        
                                        <a 
                                            href={article.article_data.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="font-bold text-[15px] text-[var(--text-primary)] leading-snug mb-3 hover:text-[var(--accent-color)] transition-colors line-clamp-3 group-hover:underline decoration-[var(--border-color)] underline-offset-4"
                                            title={article.article_data.title}
                                        >
                                            {article.article_data.title}
                                        </a>

                                        <div className="mt-auto pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]" title="Views">
                                                    <Eye size={13} className="text-sky-500/80" />
                                                    {(article.views ?? 0).toLocaleString()}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]" title="Likes">
                                                    <Heart size={13} className="text-rose-500/80" />
                                                    {(article.likes ?? 0).toLocaleString()}
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={(e) => { e.preventDefault(); handleCopyLink(article.id, article.article_data.url); }}
                                                className="flex items-center gap-1 p-1 -mr-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--subtle-bg)] transition-colors"
                                                title="Copy Link"
                                            >
                                                {copiedId === article.id ? (
                                                    <span className="flex items-center gap-1 text-[var(--success)] text-[10px] font-bold uppercase tracking-wider"><Check size={12} /></span>
                                                ) : (
                                                    <LinkIcon size={13} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Add Button - Now safely portal'd/fixed outside the transform wrapper */}
            {(!isModalOpen && !deleteId) && ReactDOM.createPortal(
                <button 
                    onClick={openCreateModal}
                    className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-40 flex items-center justify-center w-14 h-14 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white rounded-full shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--accent-color)]/30 group animate-fade-in-up"
                    title="Add New Article"
                >
                    <Plus size={24} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>,
                document.body
            )}

            <ArticleModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveArticle}
                initialData={editingArticle}
            />

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Article"
                message="Are you sure you want to delete this article? This action cannot be undone."
                confirmText="Delete"
                confirmButtonClass="btn-danger"
            />
        </>
    );
};

export default NewsContentManager;

