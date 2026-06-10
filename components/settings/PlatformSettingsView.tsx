import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { usePlatformSettings } from '../PlatformSettingsContext';
import { dbMain } from '../../services/supabaseService';
import { Settings, Save, Mail, Image as ImageIcon, Globe, Upload } from 'lucide-react';

const PlatformSettingsView: React.FC = () => {
    const { settings, refreshSettings } = usePlatformSettings();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        support_email: '',
        platform_logo_url: '',
        platform_favicon_url: '',
    });

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData({
            support_email: settings.support_email,
            platform_logo_url: settings.platform_logo_url,
            platform_favicon_url: settings.platform_favicon_url,
        });
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
        <div className="max-w-4xl max-w-[100vw] overflow-hidden py-2">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    Platform Settings
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage your core platform configuration, branding, and contact details.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Support Email */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            <Mail className="w-4 h-4 text-slate-400" />
                            Support Email
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Visible to users in the Support Inbox.</p>
                        <input 
                            type="email" 
                            name="support_email" 
                            required 
                            value={formData.support_email} 
                            onChange={handleChange} 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none text-slate-800 dark:text-slate-100" 
                            placeholder="support@ceaznet.com"
                        />
                    </div>

                    {/* Platform Logo */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 md:row-span-2 flex flex-col">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                            Platform Logo URL
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Main logo displayed in the header and sidebars.</p>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                name="platform_logo_url" 
                                required 
                                value={formData.platform_logo_url.startsWith('data:image') ? 'Uploaded Image (Base64)' : formData.platform_logo_url} 
                                onChange={handleChange} 
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400" 
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
                            }} className="shrink-0 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {formData.platform_logo_url.startsWith('data:image') ? 'Clear' : <Upload className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="mt-4 flex-1 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 min-h-[120px]">
                            {formData.platform_logo_url ? (
                                <img src={formData.platform_logo_url} alt="Logo Preview" className="max-h-24 max-w-full object-contain drop-shadow-sm" onError={(e) => e.currentTarget.style.display = 'none'} onLoad={(e) => e.currentTarget.style.display = 'block'} />
                            ) : (
                                <span className="text-sm text-slate-400 italic">No image</span>
                            )}
                        </div>
                    </div>

                    {/* Platform Favicon */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            <Globe className="w-4 h-4 text-slate-400" />
                            Favicon URL
                        </label>
                        <p className="text-xs text-slate-500 mb-3">The small icon shown in browser tabs.</p>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                name="platform_favicon_url" 
                                required 
                                value={formData.platform_favicon_url.startsWith('data:image') ? 'Uploaded Image (Base64)' : formData.platform_favicon_url} 
                                onChange={handleChange} 
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400" 
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
                            }} className="shrink-0 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {formData.platform_favicon_url.startsWith('data:image') ? 'Clear' : <Upload className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                             <div className="w-9 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center p-1.5 overflow-hidden shadow-sm">
                                {formData.platform_favicon_url ? (
                                    <img src={formData.platform_favicon_url} alt="Favicon Preview" className="w-full h-full object-contain" />
                                ) : (
                                    <Globe className="w-4 h-4 text-slate-300" />
                                )}
                             </div>
                             <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Preview</span>
                        </div>
                    </div>
                </div>

                <div className="pt-2 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isSaving} 
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm w-full sm:w-auto"
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
