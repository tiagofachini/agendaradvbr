import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [lawyer, setLawyer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange dispara INITIAL_SESSION na montagem — não precisamos de getSession separado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setLawyer(null)
        setLoading(false)
        return
      }

      const { data: lawyerData } = await supabase
        .from('Lawyer')
        .select('*')
        .eq('auth_id', session.user.id)
        .maybeSingle()

      if (lawyerData) {
        const { data: settings } = await supabase
          .from('LawyerSettings')
          .select('*')
          .eq('lawyerId', lawyerData.id)
          .maybeSingle()
        setLawyer({ ...lawyerData, settings })
      } else {
        setLawyer(null)
      }

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
