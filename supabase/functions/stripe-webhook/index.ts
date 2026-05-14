import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

function confirmedEmailHtml(p: {
  lawyerName: string; dateStr: string; timeStr: string
  specialty: string; address: string; meetingLink: string | null
}) {
  const locationRow = p.meetingLink
    ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Reuni&atilde;o online</td><td style="font-weight:600"><a href="${p.meetingLink}" style="color:#2563eb">${p.meetingLink}</a></td></tr>`
    : p.address ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Local</td><td style="font-weight:600">${p.address}</td></tr>` : ''

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
    <p style="color:#a0aec0;margin:8px 0 0">Consulta confirmada</p>
  </div>
  <p>Ol&aacute;! Seu pagamento foi aprovado e sua consulta com <strong>${p.lawyerName}</strong> est&aacute; confirmada.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
    <p style="color:#16a34a;font-weight:700;margin:0;font-size:15px">&#10003; Pagamento confirmado &mdash; Consulta garantida!</p>
  </div>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Hor&aacute;rio</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Advogado</td><td style="font-weight:600">${p.lawyerName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">&Aacute;rea</td><td style="font-weight:600">${p.specialty}</td></tr>
      ${locationRow}
    </table>
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv. N&atilde;o responda este email.</p>
</body></html>`
}

async function sendConfirmationEmail(sb: ReturnType<typeof createClient>, appointmentId: string) {
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
  if (!RESEND_KEY) return

  const { data: appt } = await sb
    .from('Appointment')
    .select('clientEmail,clientName,specialty,date,meetingLink,lawyerId')
    .eq('id', appointmentId)
    .maybeSingle()

  if (!appt?.clientEmail) return

  const [{ data: lawyer }, { data: settings }] = await Promise.all([
    sb.from('Lawyer').select('name').eq('id', appt.lawyerId).maybeSingle(),
    sb.from('LawyerSettings').select('street,number,city,state').eq('lawyerId', appt.lawyerId).maybeSingle(),
  ])

  if (!lawyer) return

  const apptDateObj = new Date(appt.date)
  const dateStr = apptDateObj.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = apptDateObj.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  })
  const address = settings
    ? [settings.street, settings.number, settings.city, settings.state].filter(Boolean).join(', ')
    : ''

  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: appt.clientEmail,
      subject: `Consulta confirmada — ${lawyer.name}`,
      html: confirmedEmailHtml({
        lawyerName: lawyer.name,
        dateStr,
        timeStr,
        specialty: appt.specialty,
        address,
        meetingLink: appt.meetingLink ?? null,
      }),
    }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!sig || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  const st = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' as const })
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await st.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const appointmentId = pi.metadata?.appointmentId
        if (!appointmentId) break

        await sb.from('Payment').update({ status: 'PAID', paidAt: new Date().toISOString() })
          .eq('stripeId', pi.id)
        await sb.from('Appointment').update({ status: 'CONFIRMED' })
          .eq('id', appointmentId)

        await sendConfirmationEmail(sb, appointmentId)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const appointmentId = pi.metadata?.appointmentId
        if (!appointmentId) break

        await sb.from('Payment').update({ status: 'CANCELLED' }).eq('stripeId', pi.id)
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const { data: lawyer } = await sb
          .from('Lawyer')
          .select('id')
          .eq('stripeAccountId', account.id)
          .maybeSingle()

        if (!lawyer) break

        await sb.from('Lawyer').update({
          stripeOnboardingComplete: account.details_submitted ?? false,
          stripeChargesEnabled: account.charges_enabled ?? false,
        }).eq('id', lawyer.id)
        break
      }

      case 'payout.paid': {
        break
      }
    }

    return Response.json({ received: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
})
