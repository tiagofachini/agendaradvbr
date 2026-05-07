import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [lawyer, setLawyer] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(true)

  useEffect(() => {
    // Fallback: garante que loading sai de true mesmo se o Supabase não responder
    const timeout = setTimeout(() => {
      if (loadingRef.current) setLoading(false)
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session) {
          setLawyer(null)
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
      } catch {
        setLawyer(null)
      } finally {
        loadingRef.current = false
        setLoading(false)
        clearTimeout(timeout)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
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
