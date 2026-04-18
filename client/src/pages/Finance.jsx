import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../lib/api'

const TABS = [
  { value: '',         label: 'Todos' },
  { value: 'PAID',     label: 'Recebidos' },
  { value: 'PENDING',  label: 'A receber' },
  { value: 'OVERDUE',  label: 'Vencidos' },
]

const STATUS_STYLE = {
  PAID:      { label: 'Recebido',  color: 'bg-green-100 text-green-700' },
  PENDING:   { label: 'A receber', color: 'bg-yellow-100 text-yellow-700' },
  OVERDUE:   { label: 'Vencido',   color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-400' },
  REFUNDED:  { label: 'Estornado', color: 'bg-purple-100 text-purple-600' },
}

const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

function SummaryCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 border-l-4 ${color}`}>
      <div className="text-2xl font-extrabold text-navy-900">{fmt(value)}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-navy-900 mb-1">{label}</p>
      <p className="text-green-600">{fmt(payload[0].value)}</p>
    </div>
  )
}

export default function Finance() {
  const [tab, setTab] = useState('')
  const [data, setData] = useState(null)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api.get(`/finance?status=${tab}&page=${page}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab, page])

  useEffect(() => {
    api.get('/finance/balance').then((r) => setBalance(r.data)).catch(() => {})
  }, [])

  const handleTabChange = (v) => { setTab(v); setPage(1) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-900">Financeiro</h1>
        <p className="text-sm text-gray-500">Controle de recebíveis e pagamentos</p>
      </div>

      {/* Saldo Asaas */}
      {balance?.balance != null && (
        <div className="bg-navy-900 rounded-2xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="text-gold-400 text-sm font-medium">Saldo disponível em conta</p>
            <p className="text-white text-3xl font-extrabold mt-1">{fmt(balance.balance)}</p>
            <p className="text-gray-400 text-xs mt-1">via Asaas</p>
          </div>
          <span className="text-5xl">🏦</span>
        </div>
      )}

      {/* Resumo */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Recebido"  value={data.summary.paid}      color="border-l-green-500" />
          <SummaryCard label="A receber" value={data.summary.pending}   color="border-l-yellow-500" />
          <SummaryCard label="Vencido"   value={data.summary.overdue}   color="border-l-red-500" />
          <SummaryCard label="Cancelado" value={data.summary.cancelled} color="border-l-gray-300" />
        </div>
      )}

      {/* Gráfico */}
      {data?.chartData && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-navy-900 mb-4">Recebidos — últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1e3a5f" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#1e3a5f" strokeWidth={2.5} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs + Lista */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTabChange(value)}
              className={`flex-1 py-4 text-sm font-medium transition-colors
                ${tab === value ? 'text-navy-900 border-b-2 border-navy-900' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : data?.payments?.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">💳</div>
            <p>Nenhum pagamento encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.payments.map((p) => {
              const s = STATUS_STYLE[p.status] || STATUS_STYLE.CANCELLED
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-navy-900 truncate">{p.client?.name || 'Cliente não vinculado'}</p>
                    <p className="text-xs text-gray-400">
                      {p.appointment?.specialty || '—'} &bull;{' '}
                      {p.appointment?.date
                        ? format(new Date(p.appointment.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : format(new Date(p.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    <span className="font-bold text-navy-900 whitespace-nowrap">{fmt(p.amount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginação */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-100">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
            <span className="text-sm text-gray-500">{page} / {data.pages}</span>
            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Próxima →</button>
          </div>
        )}
      </div>
    </div>
  )
}
