import { Router } from 'express'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

// GET /api/appointments?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { start, end } = req.query
  const where = {
    lawyerId: req.lawyerId,
    ...(start && end && {
      date: { gte: new Date(start + 'T00:00:00'), lte: new Date(end + 'T23:59:59') },
    }),
    status: { notIn: ['EXPIRED'] },
  }
  try {
    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { client: { select: { name: true } } },
    })
    return res.json(appointments)
  } catch {
    return res.status(500).json({ error: 'Erro ao listar compromissos' })
  }
})

// POST /api/appointments — criação manual pelo advogado
router.post('/', async (req, res) => {
  const { clientId, clientName, clientEmail, clientWhatsapp, specialty, description, date, time, duration } = req.body
  if (!clientName || !clientEmail || !specialty || !date || !time)
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

  const [h, m] = time.split(':').map(Number)
  const appointmentDate = new Date(`${date}T00:00:00`)
  appointmentDate.setHours(h, m, 0, 0)

  try {
    let resolvedClientId = clientId
    if (!resolvedClientId) {
      const existing = await prisma.client.findUnique({
        where: { lawyerId_email: { lawyerId: req.lawyerId, email: clientEmail } },
      })
      resolvedClientId = existing?.id
      if (!resolvedClientId) {
        const created = await prisma.client.create({
          data: { lawyerId: req.lawyerId, name: clientName, email: clientEmail, whatsapp: clientWhatsapp },
        })
        resolvedClientId = created.id
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        lawyerId: req.lawyerId,
        clientId: resolvedClientId,
        clientName,
        clientEmail,
        clientWhatsapp,
        specialty,
        description,
        date: appointmentDate,
        duration: Number(duration) || 60,
        status: 'CONFIRMED',
      },
      include: { client: { select: { name: true } } },
    })
    return res.status(201).json(appointment)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar compromisso' })
  }
})

// PUT /api/appointments/:id — atualizar status
router.put('/:id', async (req, res) => {
  const { status, description } = req.body
  try {
    const updated = await prisma.appointment.updateMany({
      where: { id: req.params.id, lawyerId: req.lawyerId },
      data: { ...(status && { status }), ...(description !== undefined && { description }) },
    })
    if (updated.count === 0) return res.status(404).json({ error: 'Compromisso não encontrado' })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar compromisso' })
  }
})

// DELETE /api/appointments/:id — cancelar (soft)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.appointment.updateMany({
      where: { id: req.params.id, lawyerId: req.lawyerId },
      data: { status: 'CANCELLED' },
    })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Erro ao cancelar compromisso' })
  }
})

export default router
