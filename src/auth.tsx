import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, setUnauthorizedHandler, tokenStore, type AuthResponse, type User } from './api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Cria a conta (ainda sem sessão) e devolve o e-mail para onde o código foi enviado. */
  register: (name: string, email: string, password: string) => Promise<string>
  /** A senha vai junto: o servidor confere que quem confirma o código é quem definiu a senha. */
  verifyEmail: (email: string, code: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) return
    api
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false))
  }, [logout])

  const start = useCallback(
    (res: AuthResponse) => {
      queryClient.clear()
      tokenStore.set(res.access_token)
      setUser(res.user)
    },
    [queryClient],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      logout,
      login: async (email, password) => start(await api.login(email, password)),
      register: async (name, email, password) => (await api.register(name, email, password)).email,
      verifyEmail: async (email, code, password) => start(await api.verifyEmail(email, code, password)),
    }),
    [user, loading, logout, start],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center text-ink-3">Carregando…</div>
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  return children
}
