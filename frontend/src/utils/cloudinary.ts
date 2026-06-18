// Carga de imágenes a Cloudinary (preset sin firmar). Centraliza la lógica para
// que la usen el AvatarUploader y los campos de imagen de Configuración.
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const cloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/**
 * Sube un archivo/blob a Cloudinary y devuelve la URL https segura.
 * Lanza error con mensaje legible si no está configurado o falla.
 */
export async function uploadToCloudinary(file: Blob): Promise<string> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('La carga de imágenes no está configurada en este entorno.');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: form
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.secure_url) {
        throw new Error(data?.error?.message || 'No se pudo subir la imagen. Probá de nuevo.');
    }
    if (String(data.secure_url).length > 500) {
        throw new Error('La URL de la imagen subida es demasiado larga.');
    }
    return data.secure_url as string;
}
