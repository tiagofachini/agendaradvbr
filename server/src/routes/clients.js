import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

// GET /api/clients?search=&page=&limit=
router.get('/', async (req, res) => {
  const { search = '', page = 1, limit = 30 } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where = {
    lawyerId: req.lawyerId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  }

  try {
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { appointments: true, payments: true } },
        },
      }),
      prisma.client.count({ where }),
    ])
    return res.json({ clients, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    return res.status(500).json({ error: 'Erro ao listar clientes' })
  }
})

// GET /api/clients/:id — detalhe com histórico
router.get('/:id', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, lawyerId: req.lawyerId },
      include: {
        appointments: { orderBy: { date: 'desc' }, take: 20 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
    return res.json(client)
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar cliente' })
  }
})

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, email, whatsapp } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' })

  try {
    const exists = await prisma.client.findUnique({
      where: { lawyerId_email: { lawyerId: req.lawyerId, email } },
    })
    if (exists) return res.status(409).json({ error: 'Cliente com este email já cadastrado' })

    const client = await prisma.client.create({
      data: { lawyerId: req.lawyerId, name, email, whatsapp },
    })
    return res.status(201).json(client)
  } catch {
    return res.status(500).json({ error: 'Erro ao criar cliente' })
  }
})

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const { name, email, whatsapp } = req.body
  try {
    const client = await prisma.client.updateMany({
      where: { id: req.params.id, lawyerId: req.lawyerId },
      data: { name, email, whatsapp },
    })
    if (client.count === 0) return res.status(404).json({ error: 'Cliente não encontrado' })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar cliente' })
  }
})

export default router
