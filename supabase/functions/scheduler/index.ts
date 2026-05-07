import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const ASAAS_URL = 'https://api.asaas.com/v3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  // /functions/v1/scheduler/:slug[/slots|book]
  const slug = parts[3]
  const action = parts[4] // 'slots' | 'book' | undefined

  if (!slug) return new Response('Not Found', { status: 404, headers: cors })

  // Service role bypasses RLS — public endpoint
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { data: s, error: sErr } = await sb
      .from('LawyerSettings')
      .select('*, lawyer:Lawyer(id,name)')
      .eq('schedulerSlug', slug)
      .single()

    if (sErr || !s) {
      return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })
    }

    const lawyer = s.lawyer as { id: string; name: string }

    // ── GET /scheduler/:slug — public profile ────────────────────────────────
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
        },
        { headers: cors }
      )
    }

    // ── GET /scheduler/:slug/slots?date=YYYY-MM-DD ───────────────────────────
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

      // Find or create client
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
          .insert({ lawyerId: lawyer.id, name: clientName, email: clientEmail, whatsapp: clientWhatsapp })
          .select('id')
          .single()
        if (ncErr) throw ncErr
        clientId = nc.id
      }

      // Create appointment
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

      // Asaas integration (optional)
      if (s.asaasApiKey) {
        const hourlyRate = parseFloat(s.hourlyRate ?? '0')
        const amount = hourlyRate > 0 ? (hourlyRate * (s.slotDuration ?? 60)) / 60 : 0

        if (amount > 0) {
          try {
            // Find or create Asaas customer
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

            // Charge due 1 day before appointment
            const due = new Date(apptDate)
            due.setDate(due.getDate() - 1)
            const dueDate = due.toISOString().slice(0, 10)

            const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
              method: 'POST',
              headers: { access_token: s.asaasApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer: customerId,
                billingType: 'UNDEFINED',
                value: amount,
                dueDate,
                description: `Consulta: ${specialty}`,
                externalReference: appt.id,
              }),
            })
            const charge = await chargeRes.json()
            paymentUrl = charge.invoiceUrl ?? charge.bankSlipUrl ?? null

            if (charge.id) {
              await sb.from('Payment').insert({
                lawyerId: lawyer.id,
                clientId,
                appointmentId: appt.id,
                amount,
                status: 'PENDING',
                asaasId: charge.id,
                asaasUrl: paymentUrl,
                dueDate: new Date(dueDate).toISOString(),
              })
            }
          } catch (_) {
            // Asaas failure doesn't block the booking
          }
        }
      }

      return Response.json({ appointmentId: appt.id, paymentUrl }, { status: 201, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
