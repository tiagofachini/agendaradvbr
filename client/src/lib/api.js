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

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ2V4bHNmbXlmeXB1ZXNsenhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTM4OTUsImV4cCI6MjA4MjMyOTg5NX0.mqKyQdH9kl4msSONSjsqp0n3Z8HxHskwrK9WtqwJfo0'

export const publicApi = axios.create({
  baseURL: 'https://nfgexlsfmyfypueslzxo.supabase.co/functions/v1',
  headers: { apikey: SUPABASE_ANON_KEY },
})
