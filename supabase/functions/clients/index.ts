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
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const last = parts.at(-1)
  const id = last !== 'clients' ? last : null

  try {
    if (req.method === 'GET' && id) {
      const { data, error } = await sb
        .from('Client')
        .select('*, appointments:Appointment(*), payments:Payment(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    if (req.method === 'GET') {
      const search = url.searchParams.get('search') ?? ''
      const page = parseInt(url.searchParams.get('page') ?? '1')
      const pageSize = 20
      const from = (page - 1) * pageSize

      let q = sb
        .from('Client')
        .select('*, appointments:Appointment(count)', { count: 'exact' })
        .order('name')
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      const { data, error, count } = await q.range(from, from + pageSize - 1)
      if (error) throw error
      const clients = (data ?? []).map(({ appointments, ...c }) => ({
        ...c,
        _count: { appointments: appointments?.[0]?.count ?? 0 },
      }))
      return Response.json(
        { clients, total: count, page, pages: Math.ceil((count ?? 0) / pageSize) },
        { headers: cors }
      )
    }

    if (req.method === 'POST') {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      const body = await req.json()
      const { data, error } = await sb
        .from('Client')
        .insert({ ...body, lawyerId })
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { status: 201, headers: cors })
    }

    if (req.method === 'PUT' && id && id !== 'bulk') {
      const body = await req.json()
      const { data, error } = await sb
        .from('Client')
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
      const { error } = await sbAdmin.from('Client').delete().in('id', ids).eq('lawyerId', lawyerId)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    if (req.method === 'DELETE' && id) {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })
      const { error } = await sbAdmin.from('Client').delete().eq('id', id).eq('lawyerId', lawyerId)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
