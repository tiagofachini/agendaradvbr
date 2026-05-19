import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'emaildogago@gmail.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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

  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return new Response('Forbidden', { status: 403, headers: cors })
  }

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const targetId = parts.at(-1) !== 'admin' ? parts.at(-1) : null

  try {
    if (req.method === 'GET') {
      const { data: { users: authUsers }, error: listErr } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) throw listErr

      const { data: lawyers } = await sbAdmin.from('Lawyer').select('auth_id, name, whatsapp, createdAt')
      const lawyerMap = new Map((lawyers ?? []).map((l: Record<string, unknown>) => [l.auth_id, l]))

      const { data: deleted } = await sbAdmin
        .from('AdminDeletedUser')
        .select('*')
        .order('deletedAt', { ascending: false })

      const activeUsers = authUsers.map((u: Record<string, unknown>) => {
        const lawyer = lawyerMap.get(u.id as string) as Record<string, unknown> | undefined
        const meta = (u.raw_user_meta_data ?? {}) as Record<string, unknown>
        return {
          id: u.id,
          email: u.email ?? '',
          name: lawyer?.name || meta.name || (u.email as string)?.split('@')[0] || '',
          whatsapp: lawyer?.whatsapp || meta.whatsapp || null,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at || null,
          deletedAt: null,
          status: u.last_sign_in_at ? 'ACTIVE' : 'REGISTERED',
        }
      })

      const deletedUsers = (deleted ?? []).map((d: Record<string, unknown>) => ({
        id: d.id,
        email: d.email ?? '',
        name: d.name ?? '',
        whatsapp: d.whatsapp ?? null,
        createdAt: d.createdAt,
        lastSignInAt: d.lastSignInAt ?? null,
        deletedAt: d.deletedAt,
        status: 'DELETED',
      }))

      return Response.json({ users: [...activeUsers, ...deletedUsers] }, { headers: cors })
    }

    if (req.method === 'DELETE' && targetId) {
      if (targetId === user.id) {
        return Response.json({ error: 'Não é possível excluir a própria conta' }, { status: 400, headers: cors })
      }

      const { data: { user: target }, error: getErr } = await sbAdmin.auth.admin.getUserById(targetId)
      if (getErr || !target) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404, headers: cors })
      }

      const { data: lawyer } = await sbAdmin
        .from('Lawyer')
        .select('name, whatsapp, createdAt')
        .eq('auth_id', targetId)
        .maybeSingle()

      const meta = (target.user_metadata ?? {}) as Record<string, unknown>

      await sbAdmin.from('AdminDeletedUser').insert({
        id: crypto.randomUUID(),
        auth_id: targetId,
        email: target.email,
        name: (lawyer as Record<string, unknown> | null)?.name || meta.name || target.email?.split('@')[0],
        whatsapp: (lawyer as Record<string, unknown> | null)?.whatsapp || meta.whatsapp || null,
        createdAt: (lawyer as Record<string, unknown> | null)?.createdAt || target.created_at,
        lastSignInAt: target.last_sign_in_at || null,
        deletedAt: new Date().toISOString(),
        deletedBy: user.email,
      })

      const { error: delErr } = await sbAdmin.auth.admin.deleteUser(targetId)
      if (delErr) throw delErr

      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500, headers: cors })
  }
})
