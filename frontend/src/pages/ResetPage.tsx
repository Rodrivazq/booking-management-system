import { useState } from 'react'
import apiFetch from '../api'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function ResetPage() {
  const [msg, setMsg] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg('')
    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    try {
      await apiFetch('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) })
      setMsg('Contraseña actualizada. Inicia sesión.')
      setTimeout(() => navigate('/'), 1200)
    } catch (err: any) {
      setMsg(err.message)
    }
  }

  if (!token) return <div className="page"><p className="muted">Token inválido</p></div>

  return (
    <div className="page">
      <div className="card">
        <h2>Restablecer contraseña</h2>
        <form className="form" onSubmit={handleReset}>
          <input name="password" type="password" placeholder="Nueva contraseña" required />
          <button type="submit">Guardar</button>
          <div className="muted">{msg}</div>
        </form>
      </div>
    </div>
  )
}
