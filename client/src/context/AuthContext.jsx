import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchLawyer(session) {
  if (!session) return null
  const { data: lawyerData } = await supabase
    .from('Lawyer')
    .select('*')
    .eq('auth_id', session.user.id)
    .maybeSingle()
  if (!lawyerData) return null
  const { data: settings } = await supabase
    .from('LawyerSettings')
    .select('*')
    .eq('lawyerId', lawyerData.id)
    .maybeSingle()
  return { ...lawyerData, settings }
}

export function AuthProvider({ children }) {
  const [lawyer, setLawyer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Leitura imediata do localStorage — não depende de evento
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      try {
        setLawyer(await fetchLawyer(session))
      } catch {
        setLawyer(null)
      } finally {
        setLoading(false)
      }
    })

    // Escuta apenas mudanças após a carga inicial (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return // já tratado pelo getSession acima
      if (cancelled) return
      try {
        setLawyer(await fetchLawyer(session))
      } catch {
        setLawyer(null)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ lawyer, loading, logout, setLawyer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
