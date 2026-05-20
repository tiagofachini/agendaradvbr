import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

async function sendEmail(key: string, to: string, subject: string, html: string) {
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

function cancellationEmailHtml(p: {
  clientName: string; dateStr: string; timeStr: string; specialty: string
}) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
    <p style="color:#a0aec0;margin:8px 0 0">Consulta cancelada</p>
  </div>
  <p>Um agendamento foi cancelado.</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Cliente</td><td style="font-weight:600">${p.clientName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${p.specialty}</td></tr>
    </table>
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv.</p>
</body></html>`
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`
  return `+${digits}`
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const rawFrom    = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!accountSid || !authToken || !rawFrom) return
  const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`
  const toWa = `whatsapp:${toE164(to)}`
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: toWa, Body: body }),
    }
  )
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || `Twilio HTTP ${res.status}`)
  }
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
}): Promise<string> {
  const body: Record<string, unknown> = {
    summary: p.summary,
    description: p.description,
    start: { dateTime: p.startISO, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: p.endISO,   timeZone: 'America/Sao_Paulo' },
  }
  if (p.location)      body.location  = p.location
  if (p.attendeeEmail) body.attendees = [{ email: p.attendeeEmail }]

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error?.message || `Google Calendar HTTP ${res.status}`)
  }
  const event = await res.json()
  return event.id as string
}

async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
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

      const { date: dateStr, time: timeStr, ...rest } = body
      const dateISO = timeStr
        ? new Date(`${dateStr}T${timeStr}:00-03:00`).toISOString()
        : new Date(dateStr).toISOString()
      const apptId = crypto.randomUUID()

      const { data: s } = await sbAdmin
        .from('LawyerSettings')
        .select('googleCalendarConnected, googleCalendarRefreshToken, slotDuration, street, number, city, state')
        .eq('lawyerId', lawyerId)
        .maybeSingle()

      let calendarSynced = false
      let calendarError: string | undefined
      let calendarEventId: string | undefined
      if (s?.googleCalendarConnected && s?.googleCalendarRefreshToken) {
        try {
          const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
          const duration = rest.duration ?? s.slotDuration ?? 60
          const endISO = new Date(new Date(dateISO).getTime() + duration * 60_000).toISOString()
          const hasAddress = !!(s.street && s.city)
          const location = hasAddress
            ? [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
            : undefined
          calendarEventId = await createCalendarEvent(accessToken, {
            summary: `Consulta jurídica: ${rest.specialty} — ${rest.clientName}`,
            description: rest.description || `Consulta com ${rest.clientName}`,
            startISO: dateISO,
            endISO,
            location,
            attendeeEmail: rest.clientEmail,
          })
          calendarSynced = true
        } catch (calErr) {
          calendarError = calErr.message
          console.error('Google Calendar sync failed:', calErr.message)
        }
      }

      const { data, error } = await sb
        .from('Appointment')
        .insert({ ...rest, id: apptId, lawyerId, source: 'MANUAL', date: dateISO, updatedAt: new Date().toISOString(), googleCalendarEventId: calendarEventId })
        .select()
        .single()
      if (error) throw error
      return Response.json(
        { ...data, _calendarSynced: calendarSynced, _calendarError: calendarError },
        { status: 201, headers: cors }
      )
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

    if (req.method === 'DELETE' && id === 'bulk') {
      const { ids } = await req.json()
      if (!Array.isArray(ids) || ids.length === 0) {
        return Response.json({ error: 'ids required' }, { status: 400, headers: cors })
      }
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

      const { data: appts } = await sbAdmin
        .from('Appointment')
        .select('googleCalendarEventId')
        .in('id', ids)
        .eq('lawyerId', lawyerId)

      const { error } = await sbAdmin.from('Appointment').delete().in('id', ids).eq('lawyerId', lawyerId)
      if (error) throw error

      const eventIds = (appts ?? []).map(a => a.googleCalendarEventId).filter(Boolean) as string[]
      if (eventIds.length > 0) {
        const { data: calSettings } = await sbAdmin
          .from('LawyerSettings')
          .select('googleCalendarConnected, googleCalendarRefreshToken')
          .eq('lawyerId', lawyerId)
          .maybeSingle()
        if (calSettings?.googleCalendarConnected && calSettings?.googleCalendarRefreshToken) {
          try {
            const accessToken = await getGoogleAccessToken(calSettings.googleCalendarRefreshToken)
            await Promise.allSettled(eventIds.map(eid => deleteCalendarEvent(accessToken, eid)))
          } catch (_) {}
        }
      }

      return new Response(null, { status: 204, headers: cors })
    }

    if (req.method === 'DELETE' && id) {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

      const { data: appt } = await sbAdmin
        .from('Appointment')
        .select('clientName, date, specialty, googleCalendarEventId')
        .eq('id', id)
        .eq('lawyerId', lawyerId)
        .maybeSingle()

      const { error } = await sbAdmin.from('Appointment').delete().eq('id', id).eq('lawyerId', lawyerId)
      if (error) throw error

      if (appt) {
        const [sRes, lawyerRes] = await Promise.all([
          sbAdmin.from('LawyerSettings').select('cancellationByEmail, cancellationByWhatsapp, googleCalendarConnected, googleCalendarRefreshToken').eq('lawyerId', lawyerId).maybeSingle(),
          sbAdmin.from('Lawyer').select('email, whatsapp').eq('id', lawyerId).maybeSingle(),
        ])
        const s = sRes.data
        const lawyer = lawyerRes.data

        if (appt.googleCalendarEventId && s?.googleCalendarConnected && s?.googleCalendarRefreshToken) {
          try {
            const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
            await deleteCalendarEvent(accessToken, appt.googleCalendarEventId)
          } catch (_) {}
        }

        if (s && lawyer) {
          const apptDate = new Date(appt.date)
          const dateStr = apptDate.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })
          const timeStr = apptDate.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
          })
          try {
            const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
            if (s.cancellationByEmail && lawyer.email && RESEND_KEY) {
              await sendEmail(
                RESEND_KEY, lawyer.email,
                `Consulta cancelada — ${appt.clientName}`,
                cancellationEmailHtml({ clientName: appt.clientName, dateStr, timeStr, specialty: appt.specialty })
              )
            }
            if (s.cancellationByWhatsapp && lawyer.whatsapp) {
              await sendWhatsApp(
                lawyer.whatsapp,
                `⚠ Consulta cancelada\n\nCliente: ${appt.clientName}\nData: ${dateStr}\nHorário: ${timeStr}\nÁrea: ${appt.specialty}`
              )
            }
          } catch (_) {}
        }
      }

      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
