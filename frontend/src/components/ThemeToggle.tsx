import { useTheme } from '../context/ThemeContext'
import Icon from './Icon'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="app-header-icon-btn"
            aria-label="Cambiar tema"
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
        </button>
    )
}
