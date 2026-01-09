import { useSettings } from '../context/SettingsContext';
import { useEffect, useState } from 'react';

export default function AnnouncementBanner() {
    const { settings } = useSettings();
    const [visible, setVisible] = useState(false);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        if (settings.announcementMessage) {
            setClosed(false);
            // Small delay to trigger animation
            const timer = setTimeout(() => setVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [settings.announcementMessage]);

    if (!settings.announcementMessage || closed) return null;

    const getStyles = () => {
        switch (settings.announcementType) {
            case 'warning':
                return {
                    background: 'linear-gradient(to right, #f59e0b, #d97706)',
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </svg>
                    )
                };
            case 'error':
                return {
                    background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="m15 9-6 6" />
                            <path d="m9 9 6 6" />
                        </svg>
                    )
                };
            case 'info':
            default:
                return {
                    background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                        </svg>
                    )
                };
        }
    };

    const styleConfig = getStyles();

    return (
        <div style={{
            position: 'fixed',
            top: '2rem',
            left: '50%',
            zIndex: 1000,
            background: styleConfig.background,
            color: 'white',
            padding: '3rem 1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            maxWidth: '95vw',
            width: '95vw',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: visible ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, -20px) scale(0.95)',
            opacity: visible ? 1 : 0,
        }}>
            <div style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '12px', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {styleConfig.icon}
            </div>
            
            <div style={{ flex: 1, fontSize: '1.1rem', lineHeight: '1.5' }}>
                <div style={{ fontWeight: '700', marginBottom: '0.25rem', textTransform: 'capitalize', fontSize: '1.2rem' }}>
                    {settings.announcementType === 'info' ? 'Información' : settings.announcementType === 'warning' ? 'Atención' : 'Importante'}
                </div>
                <div style={{ opacity: 0.9 }}>
                    {settings.announcementMessage}
                </div>
            </div>

            <button 
                onClick={() => setVisible(false)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    opacity: 0.7,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
            </button>
        </div>
    );
}
