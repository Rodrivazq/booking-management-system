/**
 * Validates that an image URL is safe and within limits.
 * Reject base64 data URLs to prevent database/memory bloat.
 */
export const validateImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return true; // Empty is valid
    if (url.length > 500) return false; // Hard limit

    // Reject data URLs strictly
    if (url.trim().toLowerCase().startsWith('data:')) {
        return false;
    }

    // Allow https://
    if (url.startsWith('https://')) {
        return true;
    }

    // Reject protocol-relative URLs (e.g. //evil.com)
    if (url.startsWith('//')) {
        return false;
    }

    // Allow specific internal relative paths
    if (url.startsWith('/')) {
        const allowedPrefixes = ['/images/', '/uploads/', '/assets/', '/default-avatar'];
        return allowedPrefixes.some(prefix => url.startsWith(prefix));
    }

    return false;
};

/**
 * Valida la fortaleza de una contraseña. Devuelve un mensaje de error si no
 * cumple, o null si es válida. Regla única usada en registro, cambio de perfil
 * y reset de contraseña.
 */
export const passwordIssue = (p: string | null | undefined): string | null => {
    const pw = String(p || '');
    if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pw)) return 'La contraseña debe incluir al menos una mayúscula.';
    if (!/[a-z]/.test(pw)) return 'La contraseña debe incluir al menos una minúscula.';
    if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número.';
    return null;
};
