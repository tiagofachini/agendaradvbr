import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: 'https://nfgexlsfmyfypueslzxo.supabase.co/functions/v1',
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`
  return config
})

export default api
