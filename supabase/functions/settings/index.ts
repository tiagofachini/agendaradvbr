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

  try {
    if (req.method === 'GET') {
      const [lawyerRes, sRes] = await Promise.all([
        sb.from('Lawyer').select('id,name,email,whatsapp,avatarUrl,stripeAccountId,stripeOnboardingComplete,stripeChargesEnabled').maybeSingle(),
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
            brandColor1: s?.brandColor1 ?? '',
            brandColor2: s?.brandColor2 ?? '',
          },
          scheduler: {
            schedulerSlug: s?.schedulerSlug ?? '',
            slotDuration: s?.slotDuration ?? 60,
            highlightMessage: s?.highlightMessage ?? '',
            customMeetingUrl: s?.customMeetingUrl ?? '',
            googleCalendarConnected: s?.googleCalendarConnected ?? false,
          },
          calendar: {
            workDays: s?.workDays ?? [1, 2, 3, 4, 5],
            workStartTime: s?.workStartTime ?? '09:00',
            workEndTime: s?.workEndTime ?? '18:00',
            hourlyRate: s?.hourlyRate ?? '',
          },
          financial: {
            stripeAccountId: l?.stripeAccountId ?? null,
            stripeOnboardingComplete: l?.stripeOnboardingComplete ?? false,
            stripeChargesEnabled: l?.stripeChargesEnabled ?? false,
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

    if (req.method === 'PUT') {
      const { data: lawyer } = await sb.from('Lawyer').select('id').maybeSingle()
      if (!lawyer?.id) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })
      const lawyerId = lawyer.id

      if (section === 'account') {
        const { name, email, whatsapp } = await req.json()
        const { error } = await sb.from('Lawyer')
          .update({ name, email, whatsapp })
          .eq('id', lawyerId)
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      const { data: existing } = await sb.from('LawyerSettings').select('id').eq('lawyerId', lawyerId).maybeSingle()
      const settingsId = existing?.id ?? crypto.randomUUID()

      const upsertSettings = async (body: Record<string, unknown>) => {
        const { error } = await sb.from('LawyerSettings')
          .upsert({ id: settingsId, lawyerId, ...body }, { onConflict: 'lawyerId' })
        return error
      }

      if (section === 'office') {
        const body = await req.json()
        const error = await upsertSettings(body)
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'scheduler') {
        const body = await req.json()
        if (body.schedulerSlug) body.schedulerSlug = String(body.schedulerSlug).toLowerCase()
        const error = await upsertSettings(body)
        if (error) {
          if (error.code === '23505')
            return Response.json({ error: 'Este endereço já está em uso. Escolha outro.' }, { status: 409, headers: cors })
          throw error
        }
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'calendar') {
        const body = await req.json()
        const error = await upsertSettings(body)
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }

      if (section === 'alerts') {
        const body = await req.json()
        const error = await upsertSettings(body)
        if (error) throw error
        return Response.json({ ok: true }, { headers: cors })
      }
    }

    if (req.method === 'DELETE' && section === 'account') {
      const sbAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401, headers: cors })

      const { data: lawyer } = await sbAdmin
        .from('Lawyer')
        .select('name, whatsapp, createdAt')
        .eq('auth_id', user.id)
        .maybeSingle()

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      const l = lawyer as Record<string, unknown> | null

      await sbAdmin.from('AdminDeletedUser').insert({
        id: crypto.randomUUID(),
        auth_id: user.id,
        email: user.email,
        name: l?.name || meta.name || user.email?.split('@')[0],
        whatsapp: l?.whatsapp || meta.whatsapp || null,
        createdAt: l?.createdAt || user.created_at,
        lastSignInAt: user.last_sign_in_at || null,
        deletedAt: new Date().toISOString(),
        deletedBy: user.email,
      })

      const { error: delErr } = await sbAdmin.auth.admin.deleteUser(user.id)
      if (delErr) throw delErr

      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
