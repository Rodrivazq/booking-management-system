/**
 * ConfirmDialog — modal de confirmación tematizado para reemplazar
 * window.confirm(). Respeta tema claro/oscuro y color de marca.
 *
 * Patrón de uso (promesa) en el contenedor:
 *   const ok = await requestConfirm({ title, message, tone: 'danger' })
 *   if (!ok) return
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'primary' | 'danger';
}

export default function ConfirmDialog({
    state,
    onConfirm,
    onCancel,
}: {
    state: ConfirmOptions | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [state, onCancel]);

    if (!state) return null;
    const danger = state.tone === 'danger';

    return createPortal(
        <div className="modal-backdrop animate-fade-in" onClick={onCancel} role="presentation">
            <div
                className="modal animate-slide-up"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 440 }}
            >
                <div className="modal-header">
                    <h2 id="confirm-dialog-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: danger ? 'var(--error-text)' : 'var(--text)' }}>
                        {danger && <Icon name="alert" size={18} />} {state.title}
                    </h2>
                    <button
                        onClick={onCancel}
                        aria-label="Cerrar"
                        style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}
                    >×</button>
                </div>
                <div className="modal-body">
                    <p style={{ color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{state.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={onCancel}>{state.cancelLabel || 'Cancelar'}</button>
                        <button
                            className="btn btn-primary"
                            onClick={onConfirm}
                            autoFocus
                            style={danger ? { backgroundColor: 'var(--error-text)', borderColor: 'var(--error-text)' } : undefined}
                        >
                            {state.confirmLabel || 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
