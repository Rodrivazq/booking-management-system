import React, { createContext, useContext, useState, useEffect } from 'react';
import apiFetch from '../api';

interface Settings {
    companyName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    deadlineDay: number;
    deadlineTime: string;
    supportEmail: string;
    supportPhone: string;
    welcomeTitle: string;
    welcomeMessage: string;
    loginBackgroundImage: string;
    maintenanceMode: boolean;
    announcementMessage: string;
    announcementType: 'info' | 'warning' | 'error';
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    loading: boolean;
}

const defaultSettings: Settings = {
    companyName: 'Sistema de Reservas Corporativo',
    logoUrl: '',
    primaryColor: '#16a34a',
    secondaryColor: '#1e293b',
    deadlineDay: 3,
    deadlineTime: '23:59',
    supportEmail: 'soporte@empresa.com',
    supportPhone: '',
    welcomeTitle: 'Sistema de Reservas Corporativo',
    welcomeMessage: 'Gestiona tus comidas diarias de forma eficiente. Planifica tu semana y disfruta de un servicio de comedor de primera clase.',
    loginBackgroundImage: '',
    maintenanceMode: false,
    announcementMessage: '',
    announcementType: 'info'
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        // Apply colors to CSS variables
        const root = document.documentElement;
        root.style.setProperty('--accent', settings.primaryColor);
        root.style.setProperty('--secondary', settings.secondaryColor);

        // Also update hover/light variants if possible, or just let CSS calc them if we used HSL
        // For now, we just update the main variables.
    }, [settings]);

    const fetchSettings = async () => {
        try {
            const data = await apiFetch<Settings>('/api/settings');
            // Merge with defaults to ensure all keys exist
            setSettings({ ...defaultSettings, ...data });
        } catch (error) {
            console.error('Failed to fetch settings', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<Settings>) => {
        try {
            const data = await apiFetch<{ ok: boolean, settings: Settings }>('/api/settings', {
                method: 'PUT',
                body: JSON.stringify(newSettings)
            });
            setSettings(data.settings);
        } catch (error) {
            console.error('Failed to update settings', error);
            throw error;
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
