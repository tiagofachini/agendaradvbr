import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  const section = parts.at(-1) !== 'settings' ? parts.at(-1) : null

  const getLawyerId = async (): Promise<string | null> => {
    const { data } = await sb.from('Lawyer').select('id').maybeSingle()
    return data?.id ?? null
  }

  try {
    // ── GET /settings ─────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const [lawyerRes, sRes] = await Promise.all([
        sb.from('Lawyer').select('id,name,email,whatsapp,avatarUrl').maybeSingle(),
        sb.from('LawyerSettings').select('*').maybeSingle(),
      ])
      if (lawyerRes.error) throw lawyerRes.error
      const l = lawyerRes.data
      const s = sRes.data

      return Response.json(
        {
          account: { name: l?.name ?? '', email: l?.email ?? '', whatsapp: l?.whatsapp ?? '' },
          office: {
            cep: s?.cep ?? '',
            street: s?.street ?? '',
            number: s?.number ?? '',
            complement: s?.complement ?? '',
            neighborhood: s?.neighborhood ?? '',
            city: s?.city ?? '',
            state: s?.state ?? '',
            logoUrl: s?.logoUrl ?? '',
            specialties: s?.specialties ?? [],
          },
          scheduler: {
            schedulerSlug: s?.schedulerSlug ?? '',
            slotDuration: s?.slotDuration ?? 60,
            highlightMessage: s?.highlightMessage ?? '',
          },
          calendar: {
            workDays: s?.workDays ?? [1, 2, 3, 4, 5],
            workStartTime: s?.workStartTime ?? '09:00',
            workEndTime: s?.workEndTime ?? '18:00',
            hourlyRate: s?.hourlyRate ?? '',
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

    // ── PUT handlers ──────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const lawyerId = await getLawyerId()
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

      if (section === 'account') {
        const { name, email, whatsapp } = await req.json()
        const { error } = await sb.from('Lawyer')
          .update({ name, email, whatsapp })
          .eq('id', lawyerId)
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'office') {
        const body = await req.json()
        const { error } = await sb.from('LawyerSettings')
          .upsert({ lawyerId, ...body }, { onConflict: 'lawyerId' })
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'scheduler') {
        const body = await req.json()
        const { error } = await sb.from('LawyerSettings')
          .upsert({ lawyerId, ...body }, { onConflict: 'lawyerId' })
        if (error) {
          if (error.code === '23505')
            return Response.json({ error: 'Este endereço já está em uso. Escolha outro.' }, { status: 409, headers: cors })
          throw error
        }
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'calendar') {
        const body = await req.json()
        const { error } = await sb.from('LawyerSettings')
          .upsert({ lawyerId, ...body }, { onConflict: 'lawyerId' })
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'financial') {
        const { asaasApiKey } = await req.json()
        const { error } = await sb.from('LawyerSettings')
          .upsert({ lawyerId, asaasApiKey }, { onConflict: 'lawyerId' })
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'alerts') {
        const body = await req.json()
        const { error } = await sb.from('LawyerSettings')
          .upsert({ lawyerId, ...body }, { onConflict: 'lawyerId' })
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
