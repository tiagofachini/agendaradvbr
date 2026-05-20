import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const PLATFORM_FEE_RATE = 0.0005 // 0.05%
const APP_BASE_URL = 'https://agendar.adv.br'
const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

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
}): Promise<string | null> {
  const body: Record<string, unknown> = {
    summary: p.summary,
    description: p.description,
    start: { dateTime: p.startISO, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: p.endISO,   timeZone: 'America/Sao_Paulo' },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
  if (p.location)      body.location  = p.location
  if (p.attendeeEmail) body.attendees = [{ email: p.attendeeEmail }]
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  const event = await res.json()
  const entry = (event?.conferenceData?.entryPoints ?? [])
    .find((e: { entryPointType: string; uri: string }) => e.entryPointType === 'video')
  return entry?.uri ?? null
}

async function sendEmail(key: string, to: string, subject: string, html: string) {
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
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
  await fetch(
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
}

function stripe() {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' as const })
}

async function handleCheckout(req: Request): Promise<Response> {
  const body = await req.json()
  const { slug, clientName, clientEmail, clientWhatsapp, specialty, description, selectedDate, selectedSlot } = body

  if (!slug || !clientName || !clientEmail || !specialty || !selectedDate || !selectedSlot) {
    return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400, headers: cors })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: s } = await sb
    .from('LawyerSettings')
    .select('*')
    .ilike('schedulerSlug', slug.toLowerCase())
    .maybeSingle()

  if (!s) return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })

  const { data: lawyer } = await sb
    .from('Lawyer')
    .select('id,name,email,stripeAccountId,stripeChargesEnabled')
    .eq('id', s.lawyerId)
    .maybeSingle()

  if (!lawyer?.stripeChargesEnabled || !lawyer.stripeAccountId) {
    return Response.json({ error: 'Pagamentos não configurados para este advogado' }, { status: 400, headers: cors })
  }

  const hourlyRate = parseFloat(s.hourlyRate ?? '0')
  const amountBRL = hourlyRate > 0 ? (hourlyRate * (s.slotDuration ?? 60)) / 60 : 0
  if (amountBRL <= 0) {
    return Response.json({ error: 'Consulta sem valor configurado' }, { status: 400, headers: cors })
  }

  const amountCents = Math.round(amountBRL * 100)
  const platformFeeCents = Math.max(1, Math.round(amountCents * PLATFORM_FEE_RATE))

  const { data: existing } = await sb
    .from('Client')
    .select('id')
    .eq('lawyerId', lawyer.id)
    .eq('email', clientEmail)
    .maybeSingle()

  let clientId: string
  if (existing) {
    clientId = existing.id
    await sb.from('Client').update({ name: clientName, whatsapp: clientWhatsapp }).eq('id', clientId)
  } else {
    const { data: nc, error: ncErr } = await sb
      .from('Client')
      .insert({ id: crypto.randomUUID(), lawyerId: lawyer.id, name: clientName, email: clientEmail, whatsapp: clientWhatsapp, updatedAt: new Date().toISOString() })
      .select('id').single()
    if (ncErr) throw ncErr
    clientId = nc.id
  }

  const apptDate = new Date(`${selectedDate}T${selectedSlot}:00-03:00`).toISOString()
  const apptId = crypto.randomUUID()
  const hasAddress = !!(s.street && s.city)

  let meetingLink: string | null = null
  if (s.googleCalendarConnected && s.googleCalendarRefreshToken) {
    try {
      const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
      const endISO = new Date(new Date(apptDate).getTime() + (s.slotDuration ?? 60) * 60_000).toISOString()
      const location = hasAddress
        ? [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
        : undefined
      meetingLink = await createCalendarEvent(accessToken, {
        summary: `Consulta jurídica: ${specialty} — ${clientName}`,
        description: description ? `Descrição: ${description}` : `Consulta com ${clientName}`,
        startISO: apptDate,
        endISO,
        location,
        attendeeEmail: clientEmail,
      })
    } catch (_) { /* fallback below */ }
  }
  if (!meetingLink) {
    meetingLink = s.customMeetingUrl?.trim() || null
  }

  const { error: apptErr } = await sb.from('Appointment').insert({
    id: apptId, lawyerId: lawyer.id, clientId,
    clientName, clientEmail, clientWhatsapp, specialty, description,
    date: apptDate, duration: s.slotDuration ?? 60,
    status: 'PENDING_PAYMENT', meetingLink, updatedAt: new Date().toISOString(),
  })
  if (apptErr) throw apptErr

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
  if (RESEND_KEY) {
    try {
      const apptDateObj = new Date(apptDate)
      const dateStr = apptDateObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      const timeStr = apptDateObj.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
      })
      const address = [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
      const locationRow = meetingLink
        ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Reunião online</td><td style="font-weight:600"><a href="${meetingLink}" style="color:#2563eb">${meetingLink}</a></td></tr>`
        : address ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Local</td><td style="font-weight:600">${address}</td></tr>` : ''
      const clientHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
        <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
          <p style="color:#a0aec0;margin:8px 0 0">Confirmação de agendamento</p>
        </div>
        <p>Olá! Seu agendamento com <strong>${lawyer.name}</strong> foi recebido.</p>
        <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:6px 0;width:40%">Data</td><td style="font-weight:600">${dateStr}</td></tr>
            <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${timeStr}</td></tr>
            <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${specialty}</td></tr>
            ${locationRow}
          </table>
        </div>
        <p style="color:#f59e0b;font-weight:600">⚠ Aguardando confirmação do pagamento.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv.</p>
      </body></html>`
      await sendEmail(RESEND_KEY, clientEmail, `Agendamento recebido — ${lawyer.name}`, clientHtml)
      if (s.newBookingByEmail !== false && lawyer.email) {
        const lawyerHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
          <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
            <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
            <p style="color:#a0aec0;margin:8px 0 0">Novo agendamento (aguardando pagamento)</p>
          </div>
          <p>Novo agendamento recebido de <strong>${clientName}</strong>.</p>
          <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#6b7280;padding:6px 0;width:40%">Cliente</td><td style="font-weight:600">${clientName}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Email</td><td style="font-weight:600">${clientEmail}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Data</td><td style="font-weight:600">${dateStr}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${timeStr}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${specialty}</td></tr>
            </table>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv.</p>
        </body></html>`
        await sendEmail(RESEND_KEY, lawyer.email, `Novo agendamento — ${clientName}`, lawyerHtml)
      }
      if (s.newBookingByWhatsapp && lawyer.whatsapp) {
        await sendWhatsApp(
          lawyer.whatsapp,
          `📅 Novo agendamento!\n\nCliente: ${clientName}\nData: ${dateStr}\nHorário: ${timeStr}\nÁrea: ${specialty}${clientWhatsapp ? `\nWhatsApp: ${clientWhatsapp}` : ''}`
        )
      }
    } catch (_) {}
  }

  const st = stripe()
  const paymentIntent = await st.paymentIntents.create({
    amount: amountCents,
    currency: 'brl',
    automatic_payment_methods: { enabled: true },
    application_fee_amount: platformFeeCents,
    transfer_data: { destination: lawyer.stripeAccountId },
    metadata: { appointmentId: apptId, lawyerId: lawyer.id, slug },
    description: `Consulta: ${specialty} — ${lawyer.name}`,
  })

  await sb.from('Payment').insert({
    lawyerId: lawyer.id, clientId, appointmentId: apptId,
    amount: amountBRL, status: 'PENDING',
    stripeId: paymentIntent.id, platformFeeCents,
    dueDate: new Date(apptDate).toISOString(),
  })

  return Response.json(
    { clientSecret: paymentIntent.client_secret, appointmentId: apptId, amount: amountBRL, meetingLink },
    { status: 201, headers: cors }
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const action = parts.at(-1)

  if (req.method === 'POST' && action === 'checkout') {
    try { return await handleCheckout(req) }
    catch (err) { return Response.json({ error: err.message }, { status: 500, headers: cors }) }
  }

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  try {
    const { data: lawyer } = await sb
      .from('Lawyer')
      .select('id,name,email,stripeAccountId,stripeOnboardingComplete,stripeChargesEnabled')
      .maybeSingle()

    if (!lawyer) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

    const st = stripe()

    if (req.method === 'POST' && action === 'onboard') {
      let accountId = lawyer.stripeAccountId

      if (!accountId) {
        const account = await st.accounts.create({
          type: 'express',
          country: 'BR',
          email: lawyer.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: 'individual',
          metadata: { lawyerId: lawyer.id },
        })
        accountId = account.id

        const sbAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        await sbAdmin.from('Lawyer').update({ stripeAccountId: accountId }).eq('id', lawyer.id)
      }

      const accountLink = await st.accountLinks.create({
        account: accountId,
        refresh_url: `${APP_BASE_URL}/settings?stripe=refresh`,
        return_url: `${APP_BASE_URL}/settings?stripe=success`,
        type: 'account_onboarding',
      })

      return Response.json({ url: accountLink.url }, { headers: cors })
    }

    if (req.method === 'GET' && action === 'refresh') {
      if (!lawyer.stripeAccountId) {
        return Response.json({ error: 'Conta Stripe não criada' }, { status: 400, headers: cors })
      }

      const accountLink = await st.accountLinks.create({
        account: lawyer.stripeAccountId,
        refresh_url: `${APP_BASE_URL}/settings?stripe=refresh`,
        return_url: `${APP_BASE_URL}/settings?stripe=success`,
        type: 'account_onboarding',
      })

      return Response.json({ url: accountLink.url }, { headers: cors })
    }

    if (req.method === 'GET' && action === 'balance') {
      if (!lawyer.stripeAccountId || !lawyer.stripeChargesEnabled) {
        return Response.json({ available: null, pending: null }, { headers: cors })
      }

      const balance = await st.balance.retrieve({ stripeAccount: lawyer.stripeAccountId })
      const brl = (amounts: Stripe.Balance.Available[]) =>
        (amounts.find(a => a.currency === 'brl')?.amount ?? 0) / 100

      return Response.json(
        { available: brl(balance.available), pending: brl(balance.pending) },
        { headers: cors }
      )
    }

    if (req.method === 'GET' && action === 'transactions') {
      const page = parseInt(url.searchParams.get('page') ?? '1')
      const pageSize = 20
      const status = url.searchParams.get('status') || ''

      let q = sb
        .from('Payment')
        .select('*, client:Client(name,email), appointment:Appointment(specialty,date)', { count: 'exact' })
        .order('createdAt', { ascending: false })
      if (status && status !== 'all') q = q.eq('status', status)

      const from = (page - 1) * pageSize
      const { data: payments, error, count } = await q.range(from, from + pageSize - 1)
      if (error) throw error

      const { data: all } = await sb.from('Payment').select('status,amount')
      const summary = { paid: 0, pending: 0, overdue: 0, cancelled: 0 }
      for (const p of all ?? []) {
        const amt = parseFloat(p.amount)
        if (p.status === 'PAID') summary.paid += amt
        else if (p.status === 'PENDING') summary.pending += amt
        else if (p.status === 'OVERDUE') summary.overdue += amt
        else if (p.status === 'CANCELLED') summary.cancelled += amt
      }

      const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth() - 6)
      const { data: paid } = await sb.from('Payment').select('amount,paidAt')
        .eq('status', 'PAID').gte('paidAt', sixAgo.toISOString())

      const byMonth: Record<string, number> = {}
      for (const p of paid ?? []) {
        const month = (p.paidAt as string)?.slice(0, 7)
        if (month) byMonth[month] = (byMonth[month] ?? 0) + parseFloat(p.amount)
      }
      const chartData = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, value }))

      return Response.json(
        { payments, summary, chartData, pagination: { page, total: count ?? 0, pages: Math.ceil((count ?? 0) / pageSize) } },
        { headers: cors }
      )
    }

    if (req.method === 'GET' && action === 'dashboard-link') {
      if (!lawyer.stripeAccountId) {
        return Response.json({ error: 'Conta Stripe não configurada' }, { status: 400, headers: cors })
      }

      const loginLink = await st.accounts.createLoginLink(lawyer.stripeAccountId)
      return Response.json({ url: loginLink.url }, { headers: cors })
    }

    if (req.method === 'POST' && action === 'sync') {
      if (!lawyer.stripeAccountId) {
        return Response.json({ stripeChargesEnabled: false, stripeOnboardingComplete: false }, { headers: cors })
      }

      const account = await st.accounts.retrieve(lawyer.stripeAccountId)
      const sbAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await sbAdmin.from('Lawyer').update({
        stripeOnboardingComplete: account.details_submitted ?? false,
        stripeChargesEnabled: account.charges_enabled ?? false,
      }).eq('id', lawyer.id)

      return Response.json({
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripeOnboardingComplete: account.details_submitted ?? false,
      }, { headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
