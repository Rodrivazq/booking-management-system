import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import ImageCropModal from './ImageCropModal';

interface AvatarUploaderProps {
    currentPhotoUrl: string;
    onPhotoChange: (url: string) => void;
    nameForInitials?: string;
    size?: string;
}

export interface AvatarUploaderHandle {
    openPicker: () => void;
}

// Subida a Cloudinary mediante un "unsigned upload preset": el archivo (ya
// recortado por el usuario) va directo al CDN y guardamos sólo la URL https,
// respetando la policy de seguridad (nada de base64).
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB de origen (el recorte final pesa mucho menos)

const AvatarUploader = forwardRef<AvatarUploaderHandle, AvatarUploaderProps>(
    function AvatarUploader({ currentPhotoUrl, onPhotoChange, nameForInitials = 'U', size = '120px' }, ref) {
        const { addToast } = useToast();
        const inputRef = useRef<HTMLInputElement>(null);
        const [uploading, setUploading] = useState(false);
        const [cropSrc, setCropSrc] = useState<string | null>(null);

        const configured = !!CLOUD_NAME && !!UPLOAD_PRESET;

        const openPicker = () => {
            if (!configured) {
                addToast('La carga de fotos todavía no está configurada en este entorno.', 'info');
                return;
            }
            inputRef.current?.click();
        };

        useImperativeHandle(ref, () => ({ openPicker }));

        const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // permite volver a elegir el mismo archivo
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                addToast('El archivo debe ser una imagen.', 'error');
                return;
            }
            if (file.size > MAX_BYTES) {
                addToast('La imagen supera los 8 MB. Elegí una más liviana.', 'error');
                return;
            }
            if (!configured) {
                addToast('La carga de fotos todavía no está configurada en este entorno.', 'info');
                return;
            }
            setCropSrc(URL.createObjectURL(file));
        };

        const closeCrop = () => {
            setCropSrc(prev => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        };

        const uploadBlob = async (blob: Blob) => {
            closeCrop();
            setUploading(true);
            try {
                const fd = new FormData();
                fd.append('file', blob, 'avatar.jpg');
                fd.append('upload_preset', UPLOAD_PRESET as string);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: fd,
                });
                const data = await res.json();
                if (!res.ok || !data.secure_url) {
                    throw new Error(data?.error?.message || 'No se pudo subir la imagen.');
                }
                if (String(data.secure_url).length > 500) {
                    throw new Error('La URL de la imagen es demasiado larga.');
                }
                onPhotoChange(data.secure_url);
                addToast('Foto cargada correctamente.', 'success');
            } catch (err: any) {
                addToast(err.message || 'No se pudo subir la imagen.', 'error');
            } finally {
                setUploading(false);
            }
        };

        const displayInitial = nameForInitials ? nameForInitials.charAt(0).toUpperCase() : 'U';

        return (
            <div style={{ display: 'inline-block', textAlign: 'center' }}>
                <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                <div
                    onClick={openPicker}
                    className="profile-avatar"
                    title="Cambiar foto"
                    style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `calc(${size} / 2.5)`,
                        color: 'white',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        border: '4px solid var(--bg)',
                    }}
                >
                    {currentPhotoUrl ? (
                        <img src={currentPhotoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        displayInitial
                    )}
                    {uploading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                            Subiendo…
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={openPicker}
                    disabled={uploading}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '0.75rem' }}
                >
                    {uploading ? 'Subiendo…' : currentPhotoUrl ? 'Cambiar foto' : 'Subir foto'}
                </button>

                {cropSrc && (
                    <ImageCropModal src={cropSrc} onCancel={closeCrop} onCropped={uploadBlob} />
                )}
            </div>
        );
    }
);

export default AvatarUploader;
