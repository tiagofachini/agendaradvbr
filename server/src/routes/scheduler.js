import { Router } from 'express'
import { format, addMinutes, isAfter, startOfDay, endOfDay, getDay } from 'date-fns'
import prisma from '../lib/prisma.js'
import { findOrCreateCustomer, createPaymentLink } from '../services/asaas.js'

const router = Router()

// GET /api/scheduler/:slug — perfil público do agendador
router.get('/:slug', async (req, res) => {
  try {
    const settings = await prisma.lawyerSettings.findUnique({
      where: { schedulerSlug: req.params.slug },
      include: { lawyer: { select: { name: true, avatarUrl: true } } },
    })
    if (!settings) return res.status(404).json({ error: 'Agendador não encontrado' })

    return res.json({
      lawyerName: settings.lawyer.name,
      avatarUrl: settings.lawyer.avatarUrl,
      logoUrl: settings.logoUrl,
      highlightMessage: settings.highlightMessage,
      slotDuration: settings.slotDuration,
      workDays: settings.workDays,
      workStartTime: settings.workStartTime,
      workEndTime: settings.workEndTime,
      specialties: settings.specialties,
      hourlyRate: settings.hourlyRate ? Number(settings.hourlyRate) : null,
    })
  } catch {
    return res.status(500).json({ error: 'Erro ao carregar agendador' })
  }
})

// GET /api/scheduler/:slug/slots?date=YYYY-MM-DD — horários disponíveis
router.get('/:slug/slots', async (req, res) => {
  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date é obrigatório' })

  try {
    const settings = await prisma.lawyerSettings.findUnique({
      where: { schedulerSlug: req.params.slug },
    })
    if (!settings) return res.status(404).json({ error: 'Agendador não encontrado' })

    const dateObj = new Date(`${date}T00:00:00`)
    const dayOfWeek = getDay(dateObj)

    if (!settings.workDays.includes(dayOfWeek)) return res.json({ slots: [] })

    // Gera todos os slots do dia
    const [startH, startM] = settings.workStartTime.split(':').map(Number)
    const [endH, endM] = settings.workEndTime.split(':').map(Number)
    const allSlots = []
    let current = new Date(dateObj)
    current.setHours(startH, startM, 0, 0)
    const endOfWork = new Date(dateObj)
    endOfWork.setHours(endH, endM, 0, 0)

    while (current < endOfWork) {
      allSlots.push(format(current, 'HH:mm'))
      current = addMinutes(current, settings.slotDuration)
    }

    // Busca horários já ocupados
    const booked = await prisma.appointment.findMany({
      where: {
        lawyerId: settings.lawyerId,
        date: { gte: startOfDay(dateObj), lte: endOfDay(dateObj) },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      select: { date: true },
    })
    const bookedSet = new Set(booked.map((a) => format(a.date, 'HH:mm')))

    // Filtra passados e ocupados
    const now = new Date()
    const available = allSlots.filter((slot) => {
      const [h, m] = slot.split(':').map(Number)
      const slotDate = new Date(dateObj)
      slotDate.setHours(h, m, 0, 0)
      return !bookedSet.has(slot) && isAfter(slotDate, now)
    })

    return res.json({ slots: available })
  } catch {
    return res.status(500).json({ error: 'Erro ao carregar horários' })
  }
})

// POST /api/scheduler/:slug/book — cria agendamento
router.post('/:slug/book', async (req, res) => {
  const { clientName, clientEmail, clientWhatsapp, specialty, description, date, time } = req.body
  if (!clientName || !clientEmail || !specialty || !date || !time)
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

  try {
    const settings = await prisma.lawyerSettings.findUnique({
      where: { schedulerSlug: req.params.slug },
      include: { lawyer: true },
    })
    if (!settings) return res.status(404).json({ error: 'Agendador não encontrado' })

    // Monta datetime do compromisso
    const [h, m] = time.split(':').map(Number)
    const appointmentDate = new Date(`${date}T00:00:00`)
    appointmentDate.setHours(h, m, 0, 0)
    if (!isAfter(appointmentDate, new Date()))
      return res.status(400).json({ error: 'Horário já passou' })

    // Verifica disponibilidade
    const conflict = await prisma.appointment.findFirst({
      where: {
        lawyerId: settings.lawyerId,
        date: appointmentDate,
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
    })
    if (conflict) return res.status(409).json({ error: 'Horário não disponível' })

    // Cria ou localiza cliente
    let client = await prisma.client.findUnique({
      where: { lawyerId_email: { lawyerId: settings.lawyerId, email: clientEmail } },
    })
    if (!client) {
      client = await prisma.client.create({
        data: { lawyerId: settings.lawyerId, name: clientName, email: clientEmail, whatsapp: clientWhatsapp },
      })
    }

    // Cria compromisso
    const appointment = await prisma.appointment.create({
      data: {
        lawyerId: settings.lawyerId,
        clientId: client.id,
        clientName,
        clientEmail,
        clientWhatsapp,
        specialty,
        description,
        date: appointmentDate,
        duration: settings.slotDuration,
        status: 'PENDING_PAYMENT',
      },
    })

    // Gera cobrança Asaas (se configurado)
    let paymentUrl = null
    const hourlyRate = Number(settings.hourlyRate || 0)
    const amount = (hourlyRate / 60) * settings.slotDuration

    if (settings.asaasApiKey && amount > 0) {
      try {
        const dueDate = format(addMinutes(new Date(), 60), 'yyyy-MM-dd')
        const customer = await findOrCreateCustomer(settings.asaasApiKey, {
          name: clientName,
          email: clientEmail,
          phone: clientWhatsapp,
        })
        const charge = await createPaymentLink(settings.asaasApiKey, {
          customerId: customer.id,
          amount,
          description: `Consulta — ${specialty} — ${format(appointmentDate, 'dd/MM HH:mm')}`,
          dueDate,
        })
        await prisma.payment.create({
          data: {
            lawyerId: settings.lawyerId,
            clientId: client.id,
            appointmentId: appointment.id,
            amount,
            status: 'PENDING',
            asaasId: charge.id,
            asaasUrl: charge.invoiceUrl,
            dueDate: new Date(dueDate),
          },
        })
        paymentUrl = charge.invoiceUrl
      } catch (err) {
        console.error('Asaas error (non-fatal):', err.message)
      }
    }

    return res.status(201).json({ appointmentId: appointment.id, paymentUrl })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar agendamento' })
  }
})

export default router
