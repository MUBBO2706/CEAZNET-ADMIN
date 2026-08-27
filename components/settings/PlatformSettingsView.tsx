import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { usePlatformSettings } from '../PlatformSettingsContext';
import { dbMain } from '../../services/supabaseService';
import { Settings, Save, Mail, Image as ImageIcon, Globe, Upload, Database, CheckCircle2 } from 'lucide-react';

const PlatformSettingsView: React.FC = () => {
    const { settings, refreshSettings } = usePlatformSettings();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        support_email: '',
        platform_logo_url: '',
        platform_favicon_url: '',
        activity_logs_max_limit: 1000,
    });

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData({
            support_email: settings.support_email,
            platform_logo_url: settings.platform_logo_url,
            platform_favicon_url: settings.platform_favicon_url,
            activity_logs_max_limit: settings.activity_logs_max_limit || 1000,
        });
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? parseInt(value, 10) || 0 : value 
        }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetField: 'platform_logo_url' | 'platform_favicon_url') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // Limit to 2MB
            toast.error('File size exceeds 2MB. Please upload a smaller image.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setFormData(prev => ({ ...prev, [targetField]: base64String }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await Promise.all([
                dbMain.from('platform_settings').upsert({ setting_key: 'support_email', setting_value: `"${formData.support_email}"` }, { onConflict: 'setting_key' }),
                dbMain.from('platform_settings').upsert({ setting_key: 'platform_logo_url', setting_value: `"${formData.platform_logo_url}"` }, { onConflict: 'setting_key' }),
                dbMain.from('platform_settings').upsert({ setting_key: 'platform_favicon_url', setting_value: `"${formData.platform_favicon_url}"` }, { onConflict: 'setting_key' }),
                dbMain.from('platform_settings').upsert({ setting_key: 'activity_logs_max_limit', setting_value: String(formData.activity_logs_max_limit) }, { onConflict: 'setting_key' }),
            ]);
            await refreshSettings();
            toast.success('Platform Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save platform settings:', error);
            toast.error('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-0">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/60">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-indigo-500" />
                        Platform Settings
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Configure core settings, branding resources, email settings, and data retention rules.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Support Email Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 py-5 items-start">
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Mail className="w-4 h-4 text-slate-400" />
                            Support Email
                        </label>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            This email is visible to customers in their client app and support messages.
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <input 
                            type="email" 
                            name="support_email" 
                            required 
                            value={formData.support_email} 
                            onChange={handleChange} 
                            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400" 
                            placeholder="support@ceaznet.com"
                        />
                    </div>
                </div>

                {/* Platform Logo Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 py-5 items-start">
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                            Platform Logo
                        </label>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            The primary brand identity logo rendered in sidebars and major headers.
                        </p>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                name="platform_logo_url" 
                                required 
                                value={formData.platform_logo_url.startsWith('data:image') ? 'Uploaded Image (Base64)' : formData.platform_logo_url} 
                                onChange={handleChange} 
                                className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400" 
                                placeholder="https://example.com/logo.png"
                                disabled={formData.platform_logo_url.startsWith('data:image')}
                            />
                            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'platform_logo_url')} />
                            <button type="button" onClick={() => {
                                if (formData.platform_logo_url.startsWith('data:image')) {
                                    setFormData(prev => ({ ...prev, platform_logo_url: '' }));
                                } else {
                                    logoInputRef.current?.click();
                                }
                            }} className="shrink-0 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-sm transition-all flex items-center gap-1.5 h-[38px]">
                                {formData.platform_logo_url.startsWith('data:image') ? (
                                    'Clear'
                                ) : (
                                    <>
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {formData.platform_logo_url && (
                            <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800/60 rounded-lg p-2.5 max-w-sm">
                                <div className="w-12 h-12 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                                    <img src={formData.platform_logo_url} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Logo Active Preview</span>
                                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> Live
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Platform Favicon Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 py-5 items-start">
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Globe className="w-4 h-4 text-slate-400" />
                            Favicon
                        </label>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            The tiny brand asset used in browser tabs and bookmarks.
                        </p>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                name="platform_favicon_url" 
                                required 
                                value={formData.platform_favicon_url.startsWith('data:image') ? 'Uploaded Image (Base64)' : formData.platform_favicon_url} 
                                onChange={handleChange} 
                                className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400" 
                                placeholder="https://example.com/favicon.png"
                                disabled={formData.platform_favicon_url.startsWith('data:image')}
                            />
                            <input type="file" ref={faviconInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'platform_favicon_url')} />
                            <button type="button" onClick={() => {
                                if (formData.platform_favicon_url.startsWith('data:image')) {
                                    setFormData(prev => ({ ...prev, platform_favicon_url: '' }));
                                } else {
                                    faviconInputRef.current?.click();
                                }
                            }} className="shrink-0 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-sm transition-all flex items-center gap-1.5 h-[38px]">
                                {formData.platform_favicon_url.startsWith('data:image') ? (
                                    'Clear'
                                ) : (
                                    <>
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload
                                    </>
                                )}
                            </button>
                        </div>

                        {formData.platform_favicon_url && (
                            <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800/60 rounded-lg p-2.5 max-w-sm">
                                <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                                    <img src={formData.platform_favicon_url} alt="Favicon Preview" className="max-h-full max-w-full object-contain" />
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Favicon Active Preview</span>
                                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> Live
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Max Activity Logs Limit Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 py-5 items-start">
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Database className="w-4 h-4 text-slate-400" />
                            Activity Log Retention
                        </label>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Maximum logs count retained inside the system. Extra older logs are auto-purged.
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <input 
                            type="number" 
                            name="activity_logs_max_limit" 
                            required 
                            min="10"
                            max="1000000"
                            value={formData.activity_logs_max_limit} 
                            onChange={handleChange} 
                            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-slate-100" 
                            placeholder="1000"
                        />
                    </div>
                </div>

                {/* Save Changes Area */}
                <div className="pt-5 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isSaving} 
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed text-xs w-full sm:w-auto"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving Changes...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PlatformSettingsView;

