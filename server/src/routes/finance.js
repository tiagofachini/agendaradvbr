import { Router } from 'express'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'
import { getBalance } from '../services/asaas.js'

const router = Router()
router.use(verifyToken)

// GET /api/finance?status=&page=
router.get('/', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const lawyerId = req.lawyerId
  const skip = (Number(page) - 1) * Number(limit)
  const where = { lawyerId, ...(status && { status }) }

  try {
    // Agrega resumo
    const [paid, pending, overdue, cancelled, payments, total] = await Promise.all([
      prisma.payment.aggregate({ where: { lawyerId, status: 'PAID' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { lawyerId, status: 'PENDING' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { lawyerId, status: 'OVERDUE' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { lawyerId, status: 'CANCELLED' }, _sum: { amount: true } }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { client: { select: { name: true } }, appointment: { select: { specialty: true, date: true } } },
      }),
      prisma.payment.count({ where }),
    ])

    // Dados para gráfico: recebido por mês nos últimos 6 meses
    const chartData = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i)
        return prisma.payment.aggregate({
          where: { lawyerId, status: 'PAID', paidAt: { gte: startOfMonth(d), lte: endOfMonth(d) } },
          _sum: { amount: true },
        }).then((r) => ({ month: format(d, 'MMM', { locale: { code: 'pt-BR' } }), value: Number(r._sum.amount || 0) }))
      })
    )

    return res.json({
      summary: {
        paid: Number(paid._sum.amount || 0),
        pending: Number(pending._sum.amount || 0),
        overdue: Number(overdue._sum.amount || 0),
        cancelled: Number(cancelled._sum.amount || 0),
      },
      payments,
      total,
      pages: Math.ceil(total / Number(limit)),
      chartData,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao carregar financeiro' })
  }
})

// GET /api/finance/balance — saldo Asaas
router.get('/balance', async (req, res) => {
  try {
    const settings = await prisma.lawyerSettings.findUnique({ where: { lawyerId: req.lawyerId } })
    if (!settings?.asaasApiKey) return res.json({ balance: null, reason: 'Asaas não configurado' })
    const data = await getBalance(settings.asaasApiKey)
    return res.json({ balance: data.balance })
  } catch {
    return res.json({ balance: null, reason: 'Erro ao consultar Asaas' })
  }
})

export default router
