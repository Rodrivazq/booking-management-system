import { useRef, useState } from 'react';
import Icon from './Icon';
import { useToast } from '../context/ToastContext';
import { cloudinaryConfigured, uploadToCloudinary } from '../utils/cloudinary';

interface Props {
    label: string;
    value: string;
    onChange: (url: string) => void;
    helpText?: string;
    /** 'logo' = preview chico cuadrado; 'wide' = preview tipo banner. */
    kind?: 'logo' | 'wide';
}

const MAX_MB = 5;

export default function ImageUploadField({ label, value, onChange, helpText, kind = 'logo' }: Props) {
    const { addToast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const pick = () => {
        if (!cloudinaryConfigured) {
            addToast('La carga de imágenes no está configurada. Pegá una URL https:// en su lugar.', 'info');
            return;
        }
        inputRef.current?.click();
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            addToast('El archivo debe ser una imagen.', 'error');
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            addToast(`La imagen supera el máximo de ${MAX_MB} MB.`, 'error');
            return;
        }
        setUploading(true);
        try {
            const url = await uploadToCloudinary(file);
            onChange(url);
            addToast('Imagen subida correctamente.', 'success');
        } catch (err: any) {
            addToast(err?.message || 'No se pudo subir la imagen.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const previewBox: React.CSSProperties = kind === 'wide'
        ? { width: '100%', height: 90, borderRadius: 'var(--radius)' }
        : { width: 72, height: 72, borderRadius: 12 };

    return (
        <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>{label}</label>

            <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                <div
                    style={{
                        ...previewBox,
                        flexShrink: 0,
                        border: '1px solid var(--border)',
                        background: value
                            ? `var(--bg)`
                            : 'repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}
                >
                    {value
                        ? <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        : <Icon name="image" size={24} style={{ color: 'var(--text-light)' }} />}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={pick} disabled={uploading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Icon name="image" size={15} />
                        {uploading ? 'Subiendo…' : (value ? 'Cambiar imagen' : 'Subir imagen')}
                    </button>
                    {value && (
                        <button type="button" className="btn btn-secondary" onClick={() => onChange('')} disabled={uploading} style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}>
                            Quitar
                        </button>
                    )}
                </div>
            </div>

            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="input"
                placeholder="o pegá una URL https://…"
            />
            {helpText && (
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>{helpText}</p>
            )}
        </div>
    );
}
