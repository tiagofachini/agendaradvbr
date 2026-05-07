import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  // last segment is the section (account/office/…) or 'settings' itself
  const section = parts.at(-1) !== 'settings' ? parts.at(-1) : null

  try {
    // ── GET /settings — load all settings ────────────────────────────────────
    if (req.method === 'GET') {
      const [lawyerRes, sRes] = await Promise.all([
        sb.from('Lawyer').select('id,name,email,whatsapp').single(),
        sb.from('LawyerSettings').select('*').maybeSingle(),
      ])
      if (lawyerRes.error) throw lawyerRes.error
      const l = lawyerRes.data
      const s = sRes.data

      return Response.json(
        {
          account: { name: l.name, email: l.email, whatsapp: l.whatsapp },
          office: {
            cep: s?.cep ?? null,
            street: s?.street ?? null,
            number: s?.number ?? null,
            complement: s?.complement ?? null,
            neighborhood: s?.neighborhood ?? null,
            city: s?.city ?? null,
            state: s?.state ?? null,
            logoUrl: s?.logoUrl ?? null,
            specialties: s?.specialties ?? [],
          },
          scheduler: {
            schedulerSlug: s?.schedulerSlug ?? null,
            slotDuration: s?.slotDuration ?? 60,
            highlightMessage: s?.highlightMessage ?? null,
          },
          calendar: {
            workDays: s?.workDays ?? [1, 2, 3, 4, 5],
            workStartTime: s?.workStartTime ?? '09:00',
            workEndTime: s?.workEndTime ?? '18:00',
            hourlyRate: s?.hourlyRate ?? null,
          },
          financial: {
            asaasApiKey: s?.asaasApiKey
              ? '••••••••' + (s.asaasApiKey as string).slice(-4)
              : '',
          },
          alerts: {
            newBookingByEmail: s?.newBookingByEmail ?? true,
            newBookingByWhatsapp: s?.newBookingByWhatsapp ?? false,
            cancellationByEmail: s?.cancellationByEmail ?? true,
            cancellationByWhatsapp: s?.cancellationByWhatsapp ?? false,
          },
        },
        { headers: cors }
      )
    }

    // ── Helper: get lawyer ID from RPC ────────────────────────────────────────
    const getLawyerId = async () => {
      const { data } = await sb.rpc('get_lawyer_id')
      return data as string
    }

    if (req.method === 'PUT' && section === 'account') {
      const { name, email, whatsapp } = await req.json()
      const lawyerId = await getLawyerId()
      await sb.from('Lawyer').update({ name, email, whatsapp }).eq('id', lawyerId)
      return Response.json({ ok: true }, { headers: cors })
    }

    if (req.method === 'PUT' && section === 'office') {
      const body = await req.json()
      const lawyerId = await getLawyerId()
      await sb.from('LawyerSettings').update(body).eq('lawyerId', lawyerId)
      return Response.json({ ok: true }, { headers: cors })
    }

    if (req.method === 'PUT' && section === 'scheduler') {
      const body = await req.json()
      const lawyerId = await getLawyerId()
      const { error } = await sb.from('LawyerSettings').update(body).eq('lawyerId', lawyerId)
      if (error) {
        if (error.code === '23505')
          return Response.json({ error: 'Este endereço já está em uso. Escolha outro.' }, { status: 409, headers: cors })
        throw error
      }
      return Response.json({ ok: true }, { headers: cors })
    }

    if (req.method === 'PUT' && section === 'calendar') {
      const body = await req.json()
      const lawyerId = await getLawyerId()
      await sb.from('LawyerSettings').update(body).eq('lawyerId', lawyerId)
      return Response.json({ ok: true }, { headers: cors })
    }

    if (req.method === 'PUT' && section === 'financial') {
      const { asaasApiKey } = await req.json()
      const lawyerId = await getLawyerId()
      await sb.from('LawyerSettings').update({ asaasApiKey }).eq('lawyerId', lawyerId)
      return Response.json({ ok: true }, { headers: cors })
    }

    if (req.method === 'PUT' && section === 'alerts') {
      const body = await req.json()
      const lawyerId = await getLawyerId()
      await sb.from('LawyerSettings').update(body).eq('lawyerId', lawyerId)
      return Response.json({ ok: true }, { headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
