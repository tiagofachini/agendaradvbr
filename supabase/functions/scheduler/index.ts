import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const ASAAS_URL = 'https://api.asaas.com/v3'
const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

function clientEmailHtml(p: {
  lawyerName: string; dateStr: string; timeStr: string
  specialty: string; address: string; paymentUrl: string | null
}) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
    <p style="color:#a0aec0;margin:8px 0 0">Confirmação de agendamento</p>
  </div>
  <p>Olá! Seu agendamento com <strong>${p.lawyerName}</strong> foi recebido.</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Advogado</td><td style="font-weight:600">${p.lawyerName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${p.specialty}</td></tr>
      ${p.address ? `<tr><td style="color:#6b7280;padding:6px 0">Local</td><td style="font-weight:600">${p.address}</td></tr>` : ''}
    </table>
  </div>
  ${p.paymentUrl
    ? `<p>Para confirmar o agendamento, realize o pagamento clicando no botão abaixo:</p>
       <div style="text-align:center;margin:24px 0">
         <a href="${p.paymentUrl}" style="background:#1a1a2e;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px">Pagar agora</a>
       </div>`
    : `<p style="color:#16a34a;font-weight:600">✓ Agendamento confirmado! Nenhum pagamento é necessário neste momento.</p>`
  }
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv. Não responda este email.</p>
</body></html>`
}

function lawyerEmailHtml(p: {
  clientName: string; clientEmail: string; clientWhatsapp: string
  dateStr: string; timeStr: string; specialty: string; description: string
}) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
    <p style="color:#a0aec0;margin:8px 0 0">Novo agendamento recebido</p>
  </div>
  <p>Você tem um novo agendamento!</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Cliente</td><td style="font-weight:600">${p.clientName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Email</td><td style="font-weight:600">${p.clientEmail}</td></tr>
      ${p.clientWhatsapp ? `<tr><td style="color:#6b7280;padding:6px 0">WhatsApp</td><td style="font-weight:600">${p.clientWhatsapp}</td></tr>` : ''}
      <tr><td style="color:#6b7280;padding:6px 0">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${p.specialty}</td></tr>
    </table>
    ${p.description ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
      <p style="color:#6b7280;margin:0 0 4px 0;font-size:13px">Descrição do caso:</p>
      <p style="margin:0;font-style:italic">"${p.description}"</p>
    </div>` : ''}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv.</p>
</body></html>`
}

async function sendEmail(key: string, to: string, subject: string, html: string) {
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const schedulerIdx = parts.indexOf('scheduler')
  const slug   = schedulerIdx >= 0 ? parts[schedulerIdx + 1] : parts[0]
  const action = schedulerIdx >= 0 ? parts[schedulerIdx + 2] : parts[1]

  if (!slug) return new Response('Not Found', { status: 404, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { data: s, error: sErr } = await sb
      .from('LawyerSettings')
      .select('*')
      .ilike('schedulerSlug', slug.toLowerCase())
      .maybeSingle()

    if (sErr || !s) {
      return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })
    }

    const { data: lawyerRow } = await sb
      .from('Lawyer')
      .select('id,name,email,whatsapp')
      .eq('id', s.lawyerId)
      .maybeSingle()

    if (!lawyerRow) {
      return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })
    }

    const lawyer = lawyerRow as { id: string; name: string; email: string; whatsapp: string }

    // ── GET /scheduler/:slug ───────────────────────────────────────────────
    if (req.method === 'GET' && !action) {
      return Response.json(
        {
          lawyerName: lawyer.name,
          specialties: s.specialties ?? [],
          slotDuration: s.slotDuration ?? 60,
          workDays: s.workDays ?? [1, 2, 3, 4, 5],
          workStartTime: s.workStartTime ?? '09:00',
          workEndTime: s.workEndTime ?? '18:00',
          highlightMessage: s.highlightMessage ?? null,
          hourlyRate: s.hourlyRate ?? null,
          hasAsaas: !!(s.asaasApiKey),
          logoUrl: s.logoUrl ?? null,
          street: s.street ?? '',
          number: s.number ?? '',
          city: s.city ?? '',
          state: s.state ?? '',
        },
        { headers: cors }
      )
    }

    // ── GET /scheduler/:slug/slots ───────────────────────────────────────────
    if (req.method === 'GET' && action === 'slots') {
      const date = url.searchParams.get('date')
      if (!date) return Response.json({ error: 'date required' }, { status: 400, headers: cors })

      const { data: booked } = await sb
        .from('Appointment')
        .select('date,duration')
        .eq('lawyerId', lawyer.id)
        .gte('date', `${date}T00:00:00Z`)
        .lte('date', `${date}T23:59:59Z`)
        .neq('status', 'CANCELLED')

      const [sh, sm] = (s.workStartTime ?? '09:00').split(':').map(Number)
      const [eh, em] = (s.workEndTime ?? '18:00').split(':').map(Number)
      const dur = s.slotDuration ?? 60
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em

      const slots: string[] = []
      for (let m = startMin; m + dur <= endMin; m += dur) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        const slotISO = new Date(`${date}T${hh}:${mm}:00-03:00`).toISOString()
        const taken = (booked ?? []).some((a: { date: string; duration: number }) => {
          const aStart = new Date(a.date).getTime()
          const aEnd = aStart + (a.duration ?? 60) * 60_000
          const sStart = new Date(slotISO).getTime()
          return sStart >= aStart && sStart < aEnd
        })
        if (!taken) slots.push(`${hh}:${mm}`)
      }

      return Response.json({ slots }, { headers: cors })
    }

    // ── POST /scheduler/:slug/book ───────────────────────────────────────────
    if (req.method === 'POST' && action === 'book') {
      const { clientName, clientEmail, clientWhatsapp, specialty, description, selectedDate, selectedSlot } =
        await req.json()

      if (!clientName || !clientEmail || !specialty || !selectedDate || !selectedSlot) {
        return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400, headers: cors })
      }

      const { data: existing } = await sb
        .from('Client')
        .select('id')
        .eq('lawyerId', lawyer.id)
        .eq('email', clientEmail)
        .maybeSingle()

      let clientId: string
      if (existing) {
        clientId = existing.id
      } else {
        const { data: nc, error: ncErr } = await sb
          .from('Client')
          .insert({
            id: crypto.randomUUID(),
            lawyerId: lawyer.id,
            name: clientName,
            email: clientEmail,
            whatsapp: clientWhatsapp,
            updatedAt: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (ncErr) throw ncErr
        clientId = nc.id
      }

      const apptDate = new Date(`${selectedDate}T${selectedSlot}:00-03:00`).toISOString()
      const { data: appt, error: apptErr } = await sb
        .from('Appointment')
        .insert({
          lawyerId: lawyer.id,
          clientId,
          clientName,
          clientEmail,
          clientWhatsapp,
          specialty,
          description,
          date: apptDate,
          duration: s.slotDuration ?? 60,
          status: 'PENDING_PAYMENT',
        })
        .select('id')
        .single()
      if (apptErr) throw apptErr

      let paymentUrl: string | null = null

      if (s.asaasApiKey) {
        const hourlyRate = parseFloat(s.hourlyRate ?? '0')
        const amount = hourlyRate > 0 ? (hourlyRate * (s.slotDuration ?? 60)) / 60 : 0
        if (amount > 0) {
          try {
            const cRes = await fetch(
              `${ASAAS_URL}/customers?email=${encodeURIComponent(clientEmail)}`,
              { headers: { access_token: s.asaasApiKey } }
            )
            const cData = await cRes.json()
            let customerId: string = cData.data?.[0]?.id
            if (!customerId) {
              const createRes = await fetch(`${ASAAS_URL}/customers`, {
                method: 'POST',
                headers: { access_token: s.asaasApiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: clientName, email: clientEmail, mobilePhone: clientWhatsapp }),
              })
              const created = await createRes.json()
              customerId = created.id
            }
            const due = new Date(apptDate)
            due.setDate(due.getDate() - 1)
            const dueDate = due.toISOString().slice(0, 10)
            const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
              method: 'POST',
              headers: { access_token: s.asaasApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer: customerId, billingType: 'UNDEFINED', value: amount, dueDate,
                description: `Consulta: ${specialty}`, externalReference: appt.id,
              }),
            })
            const charge = await chargeRes.json()
            paymentUrl = charge.invoiceUrl ?? charge.bankSlipUrl ?? null
            if (charge.id) {
              await sb.from('Payment').insert({
                lawyerId: lawyer.id, clientId, appointmentId: appt.id,
                amount, status: 'PENDING', asaasId: charge.id, asaasUrl: paymentUrl,
                dueDate: new Date(dueDate).toISOString(),
              })
            }
          } catch (_) {}
        }
      }

      if (!paymentUrl) {
        await sb.from('Appointment').update({ status: 'CONFIRMED' }).eq('id', appt.id)
      }

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
          await sendEmail(
            RESEND_KEY, clientEmail,
            `Agendamento confirmado — ${lawyer.name}`,
            clientEmailHtml({ lawyerName: lawyer.name, dateStr, timeStr, specialty, address, paymentUrl })
          )
          if (s.newBookingByEmail !== false && lawyer.email) {
            await sendEmail(
              RESEND_KEY, lawyer.email,
              `Novo agendamento — ${clientName}`,
              lawyerEmailHtml({ clientName, clientEmail, clientWhatsapp, dateStr, timeStr, specialty, description })
            )
          }
        } catch (_) {}
      }

      return Response.json({ appointmentId: appt.id, paymentUrl }, { status: 201, headers: cors })
    }

    // ── POST /scheduler/:slug/detect ─────────────────────────────────────────
    if (req.method === 'POST' && action === 'detect') {
      const { description } = await req.json()

      if (!description || description.length < 30) {
        return Response.json({ specialty: '' }, { headers: cors })
      }

      const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
      if (!ANTHROPIC_KEY) {
        return Response.json({ specialty: '' }, { headers: cors })
      }

      const SPECIALTIES = [
        'Direito Civil','Direito Penal','Direito Trabalhista','Direito de Família',
        'Direito do Consumidor','Direito Tributário','Direito Previdenciário',
        'Direito Administrativo','Direito Empresarial / Comercial','Direito Imobiliário',
        'Direito Ambiental','Direito Digital e Tecnologia','Direito Internacional',
        'Direito Eleitoral','Direito Constitucional','Direito Bancário',
        'Direito de Trânsito','Direito Médico e da Saúde','Direito Agrário',
        'Direito Sucessório / Inventário','Direito Contratual','Recuperação de Crédito','Outro',
      ]

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 64,
            messages: [{
              role: 'user',
              content: `Classifique o texto abaixo em UMA das áreas jurídicas listadas. Responda APENAS o nome exato da área, sem pontuação, sem explicação.\n\nÁreas:\n${SPECIALTIES.join('\n')}\n\nTexto: "${description.slice(0, 500)}"`,
            }],
          }),
        })
        const data = await res.json()
        const raw = (data?.content?.[0]?.text ?? '').trim()
        const matched = SPECIALTIES.find(s => s.toLowerCase() === raw.toLowerCase()) ?? ''
        return Response.json({ specialty: matched }, { headers: cors })
      } catch (_) {
        return Response.json({ specialty: '' }, { headers: cors })
      }
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
