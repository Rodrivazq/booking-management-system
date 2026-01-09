import React, { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void
    removeToast: (id: string) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts(prev => [...prev, { id, message, type }])

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id)
        }, 3000)
    }, [removeToast])

    const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast])
    const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast])
    const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast])

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, info }}>
            {children}
            {createPortal(
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            {t.message}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    )
}
