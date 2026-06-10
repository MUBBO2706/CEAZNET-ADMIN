import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dbMain } from '../services/supabaseService';

export interface PlatformSettings {
    support_email: string;
    platform_logo_url: string;
    platform_favicon_url: string;
}

const defaultSettings: PlatformSettings = {
    support_email: 'Support@ceaznet.com',
    platform_logo_url: '/logo.png',
    platform_favicon_url: '/logo.png',
};

interface PlatformSettingsContextType {
    settings: PlatformSettings;
    isLoading: boolean;
    refreshSettings: () => Promise<void>;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextType>({
    settings: defaultSettings,
    isLoading: true,
    refreshSettings: async () => {},
});

export const PlatformSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);

    const refreshSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await dbMain.from('platform_settings').select('setting_key, setting_value');
            if (error) {
                // If the table does not exist, use defaults silently
                console.warn('Failed to fetch platform settings, using defaults.', error);
                return;
            }

            if (data) {
                const newSettings = { ...defaultSettings };
                data.forEach((row) => {
                    const val = row.setting_value.replace(/^"|"$/g, '');
                    if (row.setting_key === 'support_email') newSettings.support_email = val;
                    if (row.setting_key === 'platform_logo_url') newSettings.platform_logo_url = val;
                    if (row.setting_key === 'platform_favicon_url') newSettings.platform_favicon_url = val;
                });
                setSettings(newSettings);
                
                // Update favicon dynamically
                const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (faviconLink) {
                    faviconLink.href = newSettings.platform_favicon_url;
                }
                const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
                if (appleTouchIcon) {
                    appleTouchIcon.href = newSettings.platform_favicon_url;
                }
            }
        } catch (error) {
            console.error('Error in refreshSettings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshSettings();
    }, []);

    return (
        <PlatformSettingsContext.Provider value={{ settings, isLoading, refreshSettings }}>
            {children}
        </PlatformSettingsContext.Provider>
    );
};

export const usePlatformSettings = () => useContext(PlatformSettingsContext);
