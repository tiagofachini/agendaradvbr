import axios from 'axios'
import { supabase } from './supabase'

const BASE = 'https://nfgexlsfmyfypueslzxo.supabase.co/functions/v1'

// Instância autenticada — para rotas privadas (área administrativa)
const api = axios.create({ baseURL: BASE })
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`
  return config
})

// Instância pública — para o agendador (sem auth, sem risco de travar)
export const publicApi = axios.create({ baseURL: BASE })

export default api
