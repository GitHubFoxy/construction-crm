import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, supabase } from './api'
import type { Profile } from './domain'

type AuthState = { user: Profile | null; ready: boolean; error?: string }
const AuthContext = createContext<AuthState>({ user: null, ready: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return setState((s) => ({ user: null, ready: true, error: s.error }))
      // вызов в setTimeout: supabase-js не разрешает await внутри колбэка
      setTimeout(() => {
        api.profile(session.user.id).then(
          (user) => setState({ user, ready: true }),
          (e: Error) => {
            setState({ user: null, ready: true, error: `Не удалось загрузить профиль: ${e.message}` })
            supabase.auth.signOut()
          },
        )
      })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export const useAuth = () => useContext(AuthContext)
export const useUser = () => {
  const { user } = useAuth()
  if (!user) throw new Error('Нет пользователя')
  return user
}
