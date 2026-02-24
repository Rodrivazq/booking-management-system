import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../hooks/useAuthStore'
import apiFetch from '../api'
import { useToast } from '../context/ToastContext'
import ThemeToggle from '../components/ThemeToggle'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import imageCompression from 'browser-image-compression'

export default function ProfilePage() {
    const { user, setUser } = useAuthStore()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState<'info' | 'security'>('info')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        photoUrl: ''
    })

    const [imgSrc, setImgSrc] = useState('')
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const imgRef = useRef<HTMLImageElement>(null)
    const [showCropModal, setShowCropModal] = useState(false)

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                phoneNumber: user.phoneNumber || '',
                photoUrl: user.photoUrl || ''
            }))
        }
    }, [user])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader()
            reader.addEventListener('load', () => {
                setImgSrc(reader.result?.toString() || '')
                setShowCropModal(true)
            })
            reader.readAsDataURL(e.target.files[0])
            e.target.value = ''
        }
    }

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget
        const initialCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
            width, height
        )
        setCrop(initialCrop)
    }

    const handleCropComplete = async () => {
        if (!completedCrop || !imgRef.current) return
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const scaleX = imgRef.current.naturalWidth / imgRef.current.width
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height

        canvas.width = completedCrop.width * scaleX
        canvas.height = completedCrop.height * scaleY

        ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0, 0,
            canvas.width, canvas.height
        )

        canvas.toBlob(async (blob) => {
            if (!blob) return
            try {
                const file = new File([blob], "avatar.webp", { type: "image/webp" })
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 400,
                    useWebWorker: true,
                    fileType: 'image/webp'
                })
                const reader = new FileReader()
                reader.readAsDataURL(compressedFile)
                reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, photoUrl: reader.result as string }))
                    setShowCropModal(false)
                }
            } catch (e) {
                console.error(e)
                addToast('Error al procesar imagen', 'error')
            }
        }, 'image/webp', 0.9)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const payload: any = {
                name: formData.name,
                phoneNumber: formData.phoneNumber,
                photoUrl: formData.photoUrl
            }

            if (activeTab === 'security') {
                if (formData.newPassword) {
                    if (formData.newPassword !== formData.confirmNewPassword) {
                        throw new Error('Las nuevas contraseñas no coinciden')
                    }
                    if (!formData.currentPassword) {
                        throw new Error('Debes ingresar tu contraseña actual')
                    }
                    payload.currentPassword = formData.currentPassword
                    payload.newPassword = formData.newPassword
                }
            }

            const res = await apiFetch<{ user: any, message: string }>('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(payload)
            })

            setUser(res.user)
            addToast(res.message, 'success')

            // Clear password fields on success
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: ''
            }))
        } catch (error: any) {
            addToast(error.message || 'Error al actualizar perfil', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!user) return null

    return (
        <Layout title="Mi Perfil" subtitle="Gestiona tu información personal y preferencias">
            <button
                onClick={() => window.history.back()}
                className="btn btn-secondary"
                style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <span>←</span> Volver
            </button>

            <div className="grid-2" style={{ alignItems: 'start', gap: '2rem' }}>
                {/* Sidebar / User Card */}
                <div className="card" style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            margin: '0 auto 1.5rem',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '3rem',
                            color: 'white',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            border: '4px solid var(--bg)'
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className="profile-avatar"
                    >
                        {formData.photoUrl || user.photoUrl ? (
                            <img src={formData.photoUrl || user.photoUrl} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                            user.name.charAt(0).toUpperCase()
                        )}
                        <div className="avatar-overlay" style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '0.25rem',
                            textAlign: 'center'
                        }}>
                            Cambiar
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileChange}
                        capture="environment"
                    />
                    <h3>{user.name}</h3>
                    <p className="muted">{user.email}</p>
                    <div className="badge badge-success" style={{ marginTop: '0.5rem' }}>
                        {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </div>

                    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', textAlign: 'left' }}>
                        <h4 style={{ marginBottom: '1rem' }}>Preferencias</h4>
                        <div className="flex-between">
                            <span>Tema</span>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="card">
                    <div className="btn-group" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                        <button
                            className={`btn ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('info')}
                        >
                            Información Personal
                        </button>
                        <button
                            className={`btn ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('security')}
                        >
                            Seguridad
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-col">
                        {activeTab === 'info' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre Completo</label>
                                    <input
                                        className="input"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Teléfono</label>
                                    <input
                                        className="input"
                                        name="phoneNumber"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        placeholder="+598 99 123 456"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Número de Funcionario</label>
                                    <input
                                        className="input"
                                        value={user.funcNumber}
                                        disabled
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                    />
                                    <small className="muted">Contacta a RRHH para cambiar esto.</small>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="badge badge-gray" style={{ marginBottom: '1rem' }}>
                                    Deja los campos vacíos si no deseas cambiar tu contraseña.
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña Actual</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nueva Contraseña</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Confirmar Nueva Contraseña</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="confirmNewPassword"
                                        value={formData.confirmNewPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {showCropModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Recortar Imagen</h3>
                        {imgSrc && (
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img ref={imgRef} src={imgSrc} onLoad={onImageLoad} style={{ maxHeight: '60vh', maxWidth: '100%' }} />
                            </ReactCrop>
                        )}
                        <div className="flex-between" style={{ marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCropModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleCropComplete}>Aplicar y Optimizar</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
