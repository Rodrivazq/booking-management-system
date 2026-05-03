import { forwardRef, useImperativeHandle } from 'react';
import { useToast } from '../context/ToastContext';

interface AvatarUploaderProps {
    currentPhotoUrl: string;
    onPhotoChange: (base64: string) => void;
    nameForInitials?: string;
    size?: string;
}

export interface AvatarUploaderHandle {
    openPicker: () => void;
}

// NOTE: La carga de foto está deshabilitada temporalmente. La policy de seguridad
// rechaza base64 (validateImageUrl) y todavía no existe un endpoint de upload real.
// Cuando se agregue ese endpoint, se restaura el flujo de file picker + crop + upload.
const AvatarUploader = forwardRef<AvatarUploaderHandle, AvatarUploaderProps>(
    function AvatarUploader(props, ref) {
    const { currentPhotoUrl, nameForInitials = 'U', size = '120px' } = props;
    void props.onPhotoChange; // mantenido por compatibilidad de tipos con los callers
    const { addToast } = useToast();

    const showUploadDisabledToast = () => {
        addToast('La carga de foto de perfil estará disponible próximamente. Por ahora se usan tus iniciales.', 'info');
    };

    useImperativeHandle(ref, () => ({
        openPicker: showUploadDisabledToast
    }));

    const displayInitial = nameForInitials ? nameForInitials.charAt(0).toUpperCase() : 'U';

    return (
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
                cursor: 'default',
                border: '4px solid var(--bg)'
            }}
            className="profile-avatar"
        >
            {currentPhotoUrl ? (
                <img src={currentPhotoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                displayInitial
            )}
        </div>
    );
});

export default AvatarUploader;
