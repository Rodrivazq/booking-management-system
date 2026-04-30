import { useState } from 'react'
import { useAuthStore } from '../hooks/useAuthStore'
import HelpModal from './HelpModal'

interface HelpButtonProps {
    customTrigger?: React.ReactNode;
}

export default function HelpButton({ customTrigger }: HelpButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const user = useAuthStore(s => s.user)

    if (!user) return null

    // Determine role (fallback to user if undefined)
    const role = user.role === 'superadmin' ? 'superadmin' : (user.role === 'admin' ? 'admin' : 'user')

    return (
        <>
            {customTrigger ? (
                <div onClick={() => setIsOpen(true)}>{customTrigger}</div>
            ) : (
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsOpen(true)}
                    title="Ayuda y Documentación"
                    aria-label="Ayuda y Documentación"
                    style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        padding: 0,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        color: 'var(--accent)',
                        fontWeight: 'bold',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    ?
                </button>
            )}

            <HelpModal 
                role={role}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    )
}
