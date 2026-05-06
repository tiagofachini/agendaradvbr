import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://nfgexlsfmyfypueslzxo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ2V4bHNmbXlmeXB1ZXNsenhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTM4OTUsImV4cCI6MjA4MjMyOTg5NX0.mqKyQdH9kl4msSONSjsqp0n3Z8HxHskwrK9WtqwJfo0'
)
