import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'

type AuthState = {
  user: User | null
  loading: boolean
  setUser: (u: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
        localStorage.removeItem('token')
        set({ user: null })
      }
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false)
      }
    }
  )
)
