import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useSettings } from '../context/SettingsContext';
import { useAuthStore } from '../hooks/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function AdminSettingsPage() {
    const { settings, updateSettings } = useSettings();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        companyName: '',
        logoUrl: '',
        primaryColor: '',
        secondaryColor: '',
        deadlineDay: 3,
        deadlineTime: '',
        supportEmail: '',
        supportPhone: '',
        welcomeTitle: '',
        welcomeMessage: '',
        loginBackgroundImage: '',
        maintenanceMode: false,
        announcementMessage: '',
        announcementType: 'info'
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            navigate('/admin');
            return;
        }
        setFormData({
            companyName: settings.companyName,
            logoUrl: settings.logoUrl,
            primaryColor: settings.primaryColor,
            secondaryColor: settings.secondaryColor,
            deadlineDay: settings.deadlineDay,
            deadlineTime: settings.deadlineTime,
            supportEmail: settings.supportEmail,
            supportPhone: settings.supportPhone,
            welcomeTitle: settings.welcomeTitle,
            welcomeMessage: settings.welcomeMessage,
            loginBackgroundImage: settings.loginBackgroundImage,
            maintenanceMode: settings.maintenanceMode,
            announcementMessage: settings.announcementMessage,
            announcementType: settings.announcementType as 'info' | 'warning' | 'error'
        });
    }, [settings, user, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await updateSettings({
                ...formData,
                deadlineDay: parseInt(formData.deadlineDay as any),
                announcementType: formData.announcementType as 'info' | 'warning' | 'error'
            });
            setMessage('Configuración actualizada con éxito');
        } catch (error) {
            setMessage('Error al actualizar la configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout title="Configuración Global" subtitle="Personaliza la apariencia de la aplicación">
            <div style={{ maxWidth: '1200px', margin: '0 auto 1rem', display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={() => navigate('/admin')} className="btn btn-secondary">
                    ← Volver
                </button>
            </div>
            <div className="card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* General Settings */}
                            <div>
                                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>General</h3>
                                <div className="flex-col" style={{ gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre de la Empresa</label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="Ej: Mi Empresa S.A."
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>URL del Logo</label>
                                        <input
                                            type="text"
                                            name="logoUrl"
                                            value={formData.logoUrl}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="https://ejemplo.com/logo.png"
                                        />
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                                            Recomendado: Imagen PNG transparente.
                                        </p>
                                    </div>

                                    <div className="grid-2">
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Color Primario</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <input
                                                    type="color"
                                                    name="primaryColor"
                                                    value={formData.primaryColor}
                                                    onChange={handleChange}
                                                    style={{ width: '50px', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }}
                                                />
                                                <input
                                                    type="text"
                                                    name="primaryColor"
                                                    value={formData.primaryColor}
                                                    onChange={handleChange}
                                                    className="input"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Color Secundario</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <input
                                                    type="color"
                                                    name="secondaryColor"
                                                    value={formData.secondaryColor}
                                                    onChange={handleChange}
                                                    style={{ width: '50px', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }}
                                                />
                                                <input
                                                    type="text"
                                                    name="secondaryColor"
                                                    value={formData.secondaryColor}
                                                    onChange={handleChange}
                                                    className="input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reservation Rules */}
                            <div>
                                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>Reglas de Reserva</h3>
                                <div className="grid-2">
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Día de Cierre</label>
                                        <select
                                            name="deadlineDay"
                                            value={formData.deadlineDay}
                                            onChange={handleChange}
                                            className="input"
                                        >
                                            <option value="0">Domingo</option>
                                            <option value="1">Lunes</option>
                                            <option value="2">Martes</option>
                                            <option value="3">Miércoles</option>
                                            <option value="4">Jueves</option>
                                            <option value="5">Viernes</option>
                                            <option value="6">Sábado</option>
                                        </select>
                                        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                            Día límite para la próxima semana.
                                        </p>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Hora de Cierre</label>
                                        <input
                                            type="time"
                                            name="deadlineTime"
                                            value={formData.deadlineTime}
                                            onChange={handleChange}
                                            className="input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Support */}
                            <div>
                                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>Soporte</h3>
                                <div className="grid-2">
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Email</label>
                                        <input
                                            type="email"
                                            name="supportEmail"
                                            value={formData.supportEmail}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="soporte@empresa.com"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Teléfono</label>
                                        <input
                                            type="text"
                                            name="supportPhone"
                                            value={formData.supportPhone}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="+598 99 123 456"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Login Customization */}
                            <div>
                                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>Personalización Login</h3>
                                <div className="flex-col" style={{ gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Título de Bienvenida</label>
                                        <input
                                            type="text"
                                            name="welcomeTitle"
                                            value={formData.welcomeTitle}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="Sistema de Reservas"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mensaje de Bienvenida</label>
                                        <textarea
                                            name="welcomeMessage"
                                            value={formData.welcomeMessage}
                                            onChange={handleChange as any}
                                            className="input"
                                            rows={3}
                                            placeholder="Mensaje en pantalla de login."
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Imagen de Fondo (URL)</label>
                                        <input
                                            type="text"
                                            name="loginBackgroundImage"
                                            value={formData.loginBackgroundImage}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="https://ejemplo.com/fondo.jpg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* System & Announcements */}
                            <div>
                                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>Sistema y Anuncios</h3>

                                <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <h4 style={{ margin: 0 }}>Modo Mantenimiento</h4>
                                            <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>
                                                Solo admins pueden acceder.
                                            </p>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                name="maintenanceMode"
                                                checked={formData.maintenanceMode}
                                                onChange={(e) => setFormData(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex-col" style={{ gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mensaje de Anuncio</label>
                                        <input
                                            type="text"
                                            name="announcementMessage"
                                            value={formData.announcementMessage}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="Ej: Cerrado por feriado"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tipo de Anuncio</label>
                                        <select
                                            name="announcementType"
                                            value={formData.announcementType}
                                            onChange={handleChange}
                                            className="input"
                                        >
                                            <option value="info">Información (Azul)</option>
                                            <option value="warning">Advertencia (Amarillo)</option>
                                            <option value="error">Alerta (Rojo)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`card ${message.includes('Error') ? 'card-error' : 'card-success'}`} style={{ padding: '1rem', textAlign: 'center', marginTop: '2rem' }}>
                            {message}
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => navigate('/admin')} className="btn btn-secondary">
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
