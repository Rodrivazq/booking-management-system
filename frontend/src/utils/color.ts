// Convierte un color HEX (#rgb o #rrggbb) a rgba() con la opacidad dada.
// Si el color es inválido, cae a un slate oscuro neutro.
export function hexToRgba(hex: string, alpha: number): string {
    let h = (hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '1e293b';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Paleta de tintes sugeridos para el oscurecido del fondo del login.
export const OVERLAY_PALETTE: { name: string; value: string }[] = [
    { name: 'Pizarra', value: '#1e293b' },
    { name: 'Verde', value: '#15803d' },
    { name: 'Negro', value: '#000000' },
    { name: 'Azul', value: '#1e3a8a' },
    { name: 'Vino', value: '#7f1d1d' },
    { name: 'Violeta', value: '#4c1d95' },
];
