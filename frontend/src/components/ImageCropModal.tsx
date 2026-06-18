import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT = 280; // tamaño del recuadro de recorte (px)
const OUTPUT = 400;   // tamaño final de la imagen subida (px, cuadrada)

/**
 * Modal de recorte/zoom manual para avatares. El usuario arrastra y hace zoom
 * para encuadrar; al confirmar genera un Blob cuadrado (JPEG) listo para subir.
 * Sin dependencias externas (canvas + pointer events).
 */
export default function ImageCropModal({
    src,
    onCancel,
    onCropped,
}: {
    src: string;
    onCancel: () => void;
    onCropped: (blob: Blob) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [busy, setBusy] = useState(false);

    const baseScale = nat ? VIEWPORT / Math.min(nat.w, nat.h) : 1;
    const scale = baseScale * zoom;
    const dw = nat ? nat.w * scale : 0;
    const dh = nat ? nat.h * scale : 0;

    // Mantiene la imagen cubriendo todo el recuadro (sin huecos).
    const clamp = (x: number, y: number, w = dw, h = dh) => ({
        x: Math.min(0, Math.max(VIEWPORT - w, x)),
        y: Math.min(0, Math.max(VIEWPORT - h, y)),
    });

    const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const im = e.currentTarget;
        const w = im.naturalWidth, h = im.naturalHeight;
        const bs = VIEWPORT / Math.min(w, h);
        const dwv = w * bs, dhv = h * bs;
        setNat({ w, h });
        setZoom(1);
        setOffset({ x: (VIEWPORT - dwv) / 2, y: (VIEWPORT - dhv) / 2 });
    };

    const onPointerDown = (e: React.PointerEvent) => {
        drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        const nx = drag.current.ox + (e.clientX - drag.current.sx);
        const ny = drag.current.oy + (e.clientY - drag.current.sy);
        setOffset(clamp(nx, ny));
    };
    const onPointerUp = () => { drag.current = null; };

    const onZoom = (z: number) => {
        if (!nat) return;
        const s = baseScale * z;
        const dwv = nat.w * s, dhv = nat.h * s;
        setZoom(z);
        setOffset(o => clamp(o.x, o.y, dwv, dhv));
    };

    const handleCrop = () => {
        if (!nat || !imgRef.current) return;
        setBusy(true);
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setBusy(false); return; }
        const ratio = OUTPUT / VIEWPORT;
        ctx.drawImage(imgRef.current, offset.x * ratio, offset.y * ratio, dw * ratio, dh * ratio);
        canvas.toBlob(
            b => { setBusy(false); if (b) onCropped(b); },
            'image/jpeg',
            0.9
        );
    };

    return createPortal(
        <div className="modal-backdrop animate-fade-in" onClick={onCancel} role="presentation">
            <div className="modal animate-slide-up" role="dialog" aria-modal="true" aria-label="Recortar foto" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
                <div className="modal-header">
                    <h2 style={{ fontSize: '1.05rem' }}>Ajustá tu foto</h2>
                    <button onClick={onCancel} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}>×</button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                        style={{ position: 'relative', width: VIEWPORT, height: VIEWPORT, overflow: 'hidden', borderRadius: 12, background: 'var(--bg)', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
                    >
                        <img
                            ref={imgRef}
                            src={src}
                            onLoad={onImgLoad}
                            draggable={false}
                            alt="Recorte"
                            style={{ position: 'absolute', left: offset.x, top: offset.y, width: dw, height: dh, maxWidth: 'none', pointerEvents: 'none' }}
                        />
                        {/* Guía circular del área del avatar */}
                        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.7)', borderRadius: '50%', pointerEvents: 'none' }} />
                    </div>

                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="muted" style={{ fontSize: '0.8rem' }}>Zoom</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={e => onZoom(Number(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--accent)' }}
                        />
                    </div>
                    <p className="muted" style={{ fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Arrastrá para mover · deslizá para acercar.</p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', width: '100%' }}>
                        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleCrop} disabled={busy || !nat}>
                            {busy ? 'Procesando…' : 'Recortar y subir'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
