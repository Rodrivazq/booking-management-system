// Validaciones compartidas de auth (registro, perfil, reset).

export const isValidEmail = (e: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

/** Devuelve un mensaje si la contraseña no cumple, o null si es válida. */
export function passwordIssue(p: string): string | null {
    const pw = p || '';
    if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pw)) return 'La contraseña debe incluir al menos una mayúscula.';
    if (!/[a-z]/.test(pw)) return 'La contraseña debe incluir al menos una minúscula.';
    if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número.';
    return null;
}
