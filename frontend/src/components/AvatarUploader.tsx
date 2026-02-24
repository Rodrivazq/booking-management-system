import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import imageCompression from 'browser-image-compression';
import { useToast } from '../context/ToastContext';

interface AvatarUploaderProps {
    currentPhotoUrl: string;
    onPhotoChange: (base64: string) => void;
    nameForInitials?: string;
    size?: string;
}

export default function AvatarUploader({ currentPhotoUrl, onPhotoChange, nameForInitials = 'U', size = '120px' }: AvatarUploaderProps) {
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [showCropModal, setShowCropModal] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImgSrc(reader.result?.toString() || '');
                setShowCropModal(true);
            });
            reader.readAsDataURL(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
            width, height
        );
        setCrop(initialCrop);
    };

    const handleCropComplete = async () => {
        if (!completedCrop || !imgRef.current) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;

        ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0, 0,
            canvas.width, canvas.height
        );

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                const file = new File([blob], "avatar.webp", { type: "image/webp" });
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 400,
                    useWebWorker: true,
                    fileType: 'image/webp'
                });
                const reader = new FileReader();
                reader.readAsDataURL(compressedFile);
                reader.onloadend = () => {
                    onPhotoChange(reader.result as string);
                    setShowCropModal(false);
                };
            } catch (e) {
                console.error(e);
                addToast('Error al procesar imagen', 'error');
            }
        }, 'image/webp', 0.9);
    };

    const displayInitial = nameForInitials ? nameForInitials.charAt(0).toUpperCase() : 'U';

    return (
        <>
            <div
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
                    border: '4px solid var(--bg)'
                }}
                onClick={() => fileInputRef.current?.click()}
                className="profile-avatar"
            >
                {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    displayInitial
                )}
                <div className="avatar-overlay" style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    fontSize: '0.7rem',
                    padding: '0.25rem',
                    textAlign: 'center'
                }}>
                    Cambiar
                </div>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />

            {showCropModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Recortar Imagen</h3>
                        {imgSrc && (
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img ref={imgRef} src={imgSrc} onLoad={onImageLoad} style={{ maxHeight: '60vh', maxWidth: '100%' }} />
                            </ReactCrop>
                        )}
                        <div className="flex-between" style={{ marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCropModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleCropComplete}>Aplicar y Optimizar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
