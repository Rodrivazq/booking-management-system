import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Icon from '../components/Icon';
import ImageUploadField from '../components/ImageUploadField';
import { hexToRgba, OVERLAY_PALETTE } from '../utils/color';
import { useSettings } from '../context/SettingsContext';
import { useAuthStore } from '../hooks/useAuthStore';
import { useNavigate } from 'react-router-dom';

type AnnouncementType = 'info' | 'warning' | 'error';

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 600 };

function Section({ icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 11, background: 'var(--accent)', color: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={icon} size={19} />
                </span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
                    {subtitle && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

export default function AdminSettingsPage() {
    const { settings, updateSettings } = useSettings();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // Init directo desde settings (ya cargado por el provider). Sin useEffect que
    // pise lo que el admin tipea — ese era el bug del "mensaje de bienvenida".
    const [formData, setFormData] = useState(() => ({
        companyName: settings.companyName || '',
        logoUrl: settings.logoUrl || '',
        primaryColor: settings.primaryColor || '#16a34a',
        secondaryColor: settings.secondaryColor || '#1e293b',
        deadlineDay: settings.deadlineDay ?? 4,
        deadlineTime: settings.deadlineTime || '23:59',
        supportEmail: settings.supportEmail || '',
        supportPhone: settings.supportPhone || '',
        welcomeTitle: settings.welcomeTitle || '',
        welcomeMessage: settings.welcomeMessage || '',
        loginBackgroundImage: settings.loginBackgroundImage || '',
        loginBackgroundBlur: settings.loginBackgroundBlur ?? 0,
        loginBackgroundDim: settings.loginBackgroundDim ?? 55,
        loginBackgroundColor: settings.loginBackgroundColor || '#1e293b',
        maintenanceMode: settings.maintenanceMode || false,
        announcementMessage: settings.announcementMessage || '',
        announcementType: (settings.announcementType || 'info') as AnnouncementType
    }));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    useEffect(() => {
        if (user && user.role !== 'superadmin') navigate('/admin');
    }, [user, navigate]);

    const set = (name: string, value: any) => setFormData(prev => ({ ...prev, [name]: value }));
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        set(e.target.name, e.target.value);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await updateSettings({
                ...formData,
                deadlineDay: parseInt(formData.deadlineDay as any),
                announcementType: formData.announcementType
            });
            setMessage({ text: 'Configuración guardada con éxito.', ok: true });
        } catch {
            setMessage({ text: 'Error al guardar la configuración.', ok: false });
        } finally {
            setSaving(false);
        }
    };

    const announcePreviewColor: Record<AnnouncementType, string> = {
        info: 'var(--accent)', warning: '#d97706', error: 'var(--error)'
    };

    return (
        <Layout title="Configuración Global" subtitle="Apariencia, reglas de reserva y anuncios">
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <button
                    onClick={() => navigate('/admin')}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.25rem' }}
                >
                    <Icon name="arrowLeft" size={16} /> Volver al panel
                </button>

                <form onSubmit={handleSubmit} className="flex-col" style={{ gap: '1.5rem' }}>
                    <div className="grid-2" style={{ alignItems: 'start', gap: '1.5rem' }}>
                        {/* ---------- Identidad / Marca ---------- */}
                        <Section icon="image" title="Identidad de marca" subtitle="Nombre, logo y colores">
                            <div>
                                <label style={labelStyle}>Nombre de la empresa</label>
                                <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="input" placeholder="Ej: Real Sabor" />
                            </div>

                            <ImageUploadField
                                label="Logo"
                                value={formData.logoUrl}
                                onChange={(url) => set('logoUrl', url)}
                                kind="logo"
                                helpText="Recomendado: PNG con fondo transparente. Podés subir un archivo o pegar una URL."
                            />

                            <div className="grid-2">
                                <div>
                                    <label style={labelStyle}>Color primario</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input type="color" name="primaryColor" value={formData.primaryColor} onChange={handleChange} style={{ width: 48, height: 40, padding: 0, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
                                        <input type="text" name="primaryColor" value={formData.primaryColor} onChange={handleChange} className="input" />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Color secundario</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input type="color" name="secondaryColor" value={formData.secondaryColor} onChange={handleChange} style={{ width: 48, height: 40, padding: 0, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
                                        <input type="text" name="secondaryColor" value={formData.secondaryColor} onChange={handleChange} className="input" />
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* ---------- Pantalla de login ---------- */}
                        <Section icon="home" title="Pantalla de login" subtitle="Lo que ven antes de entrar">
                            <div>
                                <label style={labelStyle}>Título de bienvenida</label>
                                <input type="text" name="welcomeTitle" value={formData.welcomeTitle} onChange={handleChange} className="input" placeholder="Sistema de Reservas Real Sabor" />
                            </div>
                            <div>
                                <label style={labelStyle}>Mensaje de bienvenida</label>
                                <textarea name="welcomeMessage" value={formData.welcomeMessage} onChange={handleChange} className="input" rows={3} placeholder="Frase que acompaña al título en el login." />
                            </div>

                            <ImageUploadField
                                label="Imagen de fondo (opcional)"
                                value={formData.loginBackgroundImage}
                                onChange={(url) => set('loginBackgroundImage', url)}
                                kind="wide"
                                helpText="Imagen amplia y de buena resolución. Si la dejás vacía, se usa el fondo por defecto."
                            />

                            {/* Controles de difuminado del fondo */}
                            <div className="grid-2">
                                <div>
                                    <label style={labelStyle}>Desenfoque del fondo: {formData.loginBackgroundBlur}px</label>
                                    <input
                                        type="range" min={0} max={20} step={1}
                                        value={formData.loginBackgroundBlur}
                                        onChange={e => set('loginBackgroundBlur', Number(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Oscurecido del fondo: {formData.loginBackgroundDim}%</label>
                                    <input
                                        type="range" min={0} max={100} step={5}
                                        value={formData.loginBackgroundDim}
                                        onChange={e => set('loginBackgroundDim', Number(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                                    />
                                </div>
                            </div>

                            {/* Color del tinte del oscurecido (paleta + personalizado) */}
                            <div>
                                <label style={labelStyle}>Color del tinte</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {OVERLAY_PALETTE.map(c => {
                                        const active = (formData.loginBackgroundColor || '').toLowerCase() === c.value.toLowerCase();
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                title={c.name}
                                                onClick={() => set('loginBackgroundColor', c.value)}
                                                style={{
                                                    width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: c.value,
                                                    border: active ? '3px solid var(--accent)' : '2px solid var(--border)',
                                                    boxShadow: active ? '0 0 0 2px var(--card)' : 'none', padding: 0,
                                                }}
                                            />
                                        );
                                    })}
                                    <input
                                        type="color"
                                        value={formData.loginBackgroundColor || '#1e293b'}
                                        onChange={e => set('loginBackgroundColor', e.target.value)}
                                        title="Color personalizado"
                                        style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }}
                                    />
                                    <span className="muted" style={{ fontSize: '0.8rem' }}>{formData.loginBackgroundColor}</span>
                                </div>
                            </div>

                            {/* Vista previa en vivo (refleja imagen + desenfoque + oscurecido) */}
                            <div>
                                <label style={labelStyle}>Vista previa</label>
                                <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minHeight: 150 }}>
                                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${formData.loginBackgroundImage || '/assets/background.png'}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: formData.loginBackgroundBlur ? `blur(${formData.loginBackgroundBlur}px)` : undefined, transform: 'scale(1.1)' }} />
                                    <div style={{ position: 'absolute', inset: 0, background: hexToRgba(formData.loginBackgroundColor || '#1e293b', formData.loginBackgroundDim / 100) }} />
                                    <div style={{ position: 'relative', padding: '1.5rem', textAlign: 'center' }}>
                                        {formData.logoUrl
                                            ? <img src={formData.logoUrl} alt="logo" style={{ height: 44, objectFit: 'contain', marginBottom: '0.5rem' }} />
                                            : null}
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                                            {formData.welcomeTitle || formData.companyName || 'Título de bienvenida'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'rgba(255,255,255,0.85)' }}>
                                            {formData.welcomeMessage || 'Aquí se mostrará el mensaje de bienvenida.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* ---------- Reglas de reserva ---------- */}
                        <Section icon="clock" title="Reglas de reserva" subtitle="Cierre de la ventana semanal">
                            <div className="grid-2">
                                <div>
                                    <label style={labelStyle}>Día de cierre</label>
                                    <select name="deadlineDay" value={formData.deadlineDay} onChange={handleChange} className="input">
                                        <option value="0">Domingo</option>
                                        <option value="1">Lunes</option>
                                        <option value="2">Martes</option>
                                        <option value="3">Miércoles</option>
                                        <option value="4">Jueves</option>
                                        <option value="5">Viernes</option>
                                        <option value="6">Sábado</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Hora de cierre</label>
                                    <input type="time" name="deadlineTime" value={formData.deadlineTime} onChange={handleChange} className="input" />
                                </div>
                            </div>
                            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
                                Las reservas de la próxima semana se cierran ese día a esa hora (zona horaria Uruguay).
                            </p>
                        </Section>

                        {/* ---------- Soporte ---------- */}
                        <Section icon="help" title="Soporte" subtitle="Contacto para los usuarios">
                            <div className="grid-2">
                                <div>
                                    <label style={labelStyle}>Email</label>
                                    <input type="email" name="supportEmail" value={formData.supportEmail} onChange={handleChange} className="input" placeholder="soporte@reservasrealsabor.com.uy" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Teléfono</label>
                                    <input type="text" name="supportPhone" value={formData.supportPhone} onChange={(e) => set('supportPhone', e.target.value.replace(/[^\d+\s]/g, ''))} className="input" placeholder="+598 99 123 456" />
                                </div>
                            </div>
                        </Section>
                    </div>

                    {/* ---------- Sistema y anuncios (ancho completo) ---------- */}
                    <Section icon="alert" title="Sistema y anuncios" subtitle="Mantenimiento y cartel global">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                            <div>
                                <h4 style={{ margin: 0 }}>Modo mantenimiento</h4>
                                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>Solo los administradores pueden acceder al sitio.</p>
                            </div>
                            <label className="switch">
                                <input type="checkbox" name="maintenanceMode" checked={formData.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="grid-2" style={{ alignItems: 'start' }}>
                            <div>
                                <label style={labelStyle}>Mensaje de anuncio</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="text" name="announcementMessage" value={formData.announcementMessage} onChange={handleChange} className="input" placeholder="Ej: Cerrado por feriado el lunes" style={{ flex: 1 }} />
                                    {formData.announcementMessage && (
                                        <button type="button" className="btn btn-secondary" onClick={() => set('announcementMessage', '')} title="Quitar anuncio">Quitar</button>
                                    )}
                                </div>
                                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    Si hay texto, se muestra como cartel a todos en la app. Dejalo vacío para no mostrar nada.
                                </p>
                            </div>
                            <div>
                                <label style={labelStyle}>Tipo de anuncio</label>
                                <select name="announcementType" value={formData.announcementType} onChange={handleChange} className="input">
                                    <option value="info">Información (azul)</option>
                                    <option value="warning">Advertencia (amarillo)</option>
                                    <option value="error">Alerta (rojo)</option>
                                </select>
                            </div>
                        </div>

                        {formData.announcementMessage && (
                            <div style={{ borderLeft: `4px solid ${announcePreviewColor[formData.announcementType]}`, background: 'var(--bg)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                                <strong style={{ color: announcePreviewColor[formData.announcementType] }}>Vista previa: </strong>
                                {formData.announcementMessage}
                            </div>
                        )}
                    </Section>

                    {message && (
                        <div className={`card ${message.ok ? 'card-success' : 'card-error'}`} style={{ padding: '1rem', textAlign: 'center' }}>
                            {message.text}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => navigate('/admin')} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Icon name="save" size={16} />
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
