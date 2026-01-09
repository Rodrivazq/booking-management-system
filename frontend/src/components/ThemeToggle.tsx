import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-icon"
            style={{
                width: '2.5rem',
                height: '2.5rem',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
            }}
            aria-label="Toggle Theme"
        >
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
    )
}
