import { useState } from 'react'
import { useAuthStore } from '../hooks/useAuthStore'
import HelpModal from './HelpModal'
import Icon from './Icon'

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
                    className="app-header-icon-btn"
                    onClick={() => setIsOpen(true)}
                    title="Ayuda y Documentación"
                    aria-label="Ayuda y Documentación"
                >
                    <Icon name="help" size={18} />
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
