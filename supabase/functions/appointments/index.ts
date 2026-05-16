import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Falha ao renovar token Google')
  return data.access_token
}

async function createCalendarEvent(accessToken: string, p: {
  summary: string; description: string; startISO: string; endISO: string
  location?: string; attendeeEmail?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    summary: p.summary,
    description: p.description,
    start: { dateTime: p.startISO, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: p.endISO,   timeZone: 'America/Sao_Paulo' },
  }
  if (p.location)      body.location  = p.location
  if (p.attendeeEmail) body.attendees = [{ email: p.attendeeEmail }]

  await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const id = parts.at(-1) !== 'appointments' ? parts.at(-1) : null

  try {
    if (req.method === 'GET') {
      const start = url.searchParams.get('start')
      const end = url.searchParams.get('end')
      let q = sb
        .from('Appointment')
        .select('*, client:Client(name,email,whatsapp)')
        .order('date')
      if (start) q = q.gte('date', start)
      if (end) q = q.lte('date', end)
      const { data, error } = await q
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    if (req.method === 'POST') {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      const body = await req.json()

      // Combina date (yyyy-MM-dd) + time (HH:mm) em ISO datetime (BRT)
      const { date: dateStr, time: timeStr, ...rest } = body
      const dateISO = timeStr
        ? new Date(`${dateStr}T${timeStr}:00-03:00`).toISOString()
        : new Date(`${dateStr}T00:00:00-03:00`).toISOString()
      const apptId = crypto.randomUUID()

      // Sync com Google Calendar se conectado
      const { data: s } = await sbAdmin
        .from('LawyerSettings')
        .select('googleCalendarConnected, googleCalendarRefreshToken, slotDuration, street, number, city, state')
        .eq('lawyerId', lawyerId)
        .maybeSingle()

      if (s?.googleCalendarConnected && s?.googleCalendarRefreshToken) {
        try {
          const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
          const duration = rest.duration ?? s.slotDuration ?? 60
          const endISO = new Date(new Date(dateISO).getTime() + duration * 60_000).toISOString()
          const hasAddress = !!(s.street && s.city)
          const location = hasAddress
            ? [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
            : undefined
          await createCalendarEvent(accessToken, {
            summary: `Consulta jurídica: ${rest.specialty} — ${rest.clientName}`,
            description: rest.description || `Consulta com ${rest.clientName}`,
            startISO: dateISO,
            endISO,
            location,
            attendeeEmail: rest.clientEmail,
          })
        } catch (_) { /* noop — não bloquear criação por falha no Calendar */ }
      }

      const { data, error } = await sb
        .from('Appointment')
        .insert({ ...rest, id: apptId, lawyerId, source: 'MANUAL', date: dateISO, updatedAt: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { status: 201, headers: cors })
    }

    if (req.method === 'PUT' && id) {
      const body = await req.json()
      const { data, error } = await sb
        .from('Appointment')
        .update(body)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await sb.from('Appointment').delete().eq('id', id)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
