import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [lawyer, setLawyer] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    let { data } = await supabase
      .from('Lawyer')
      .select('*, settings:LawyerSettings(*)')
      .eq('auth_id', userId)
      .maybeSingle()

    // Trigger may still be committing — retry once after 2s
    if (!data) {
      await new Promise((r) => setTimeout(r, 2000))
      ;({ data } = await supabase
        .from('Lawyer')
        .select('*, settings:LawyerSettings(*)')
        .eq('auth_id', userId)
        .maybeSingle())
    }

    setLawyer(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await loadProfile(session.user.id)
      else setLawyer(null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ lawyer, loading, logout, setLawyer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
