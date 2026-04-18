import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import api from '../lib/api'

const STATUS_LABEL = {
  PENDING_PAYMENT: { label: 'Aguardando pgto', color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:       { label: 'Confirmado',       color: 'bg-green-100 text-green-700' },
  CANCELLED:       { label: 'Cancelado',        color: 'bg-red-100 text-red-700' },
  COMPLETED:       { label: 'Realizado',        color: 'bg-blue-100 text-blue-700' },
  EXPIRED:         { label: 'Expirado',         color: 'bg-gray-100 text-gray-500' },
}

// ── Modal de novo cliente ─────────────────────────────────────────────────────
function NewClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/clients', form)
      onCreated(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="font-bold text-navy-900 text-lg">Novo cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
              placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
              placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
              placeholder="(11) 99999-9999" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50 hover:bg-navy-800 transition-colors">
            {loading ? 'Salvando...' : 'Cadastrar cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Drawer de detalhe do cliente ──────────────────────────────────────────────
function ClientDrawer({ clientId, onClose }) {
  const [client, setClient] = useState(null)

  useEffect(() => {
    api.get(`/clients/${clientId}`).then((r) => setClient(r.data)).catch(console.error)
  }, [clientId])

  if (!client) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white h-full shadow-xl flex items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    </div>
  )

  const totalPaid = client.payments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + Number(p.amount), 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white h-full shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-navy-900 text-lg">Detalhes do cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold text-xl mb-3">
              {client.name[0].toUpperCase()}
            </div>
            <h3 className="font-bold text-navy-900 text-lg">{client.name}</h3>
            <p className="text-sm text-gray-500">{client.email}</p>
            {client.whatsapp && <p className="text-sm text-gray-500">{client.whatsapp}</p>}
            <p className="text-xs text-gray-400 mt-2">
              Cliente desde {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* Resumo financeiro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-2xl font-bold text-navy-900">{client.appointments.length}</div>
              <div className="text-xs text-gray-500">Atendimentos</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-600">
                R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500">Total pago</div>
            </div>
          </div>

          {/* Histórico de compromissos */}
          <div>
            <h4 className="font-semibold text-navy-900 mb-3">Histórico de atendimentos</h4>
            {client.appointments.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum atendimento registrado.</p>
            ) : (
              <div className="space-y-2">
                {client.appointments.map((a) => {
                  const s = STATUS_LABEL[a.status] || STATUS_LABEL.EXPIRED
                  return (
                    <div key={a.id} className="flex items-start justify-between bg-gray-50 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-medium text-navy-900">{a.specialty}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(a.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Clients() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/clients?search=${encodeURIComponent(search)}&page=${page}`)
      setClients(data.clients)
      setTotal(data.total)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { load() }, [load])

  // Agrupa por letra inicial
  const grouped = clients.reduce((acc, c) => {
    const letter = c.name[0].toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(c)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clientes</h1>
          <p className="text-sm text-gray-500">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-5 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 transition-colors flex items-center gap-2"
        >
          <span>+</span> Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por nome ou email..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-500 font-medium">
            {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
          {!search && (
            <button onClick={() => setShowNew(true)} className="mt-4 text-navy-700 font-medium hover:underline text-sm">
              Cadastrar primeiro cliente →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
            <div key={letter}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">{letter}</div>
              <div className="space-y-2">
                {group.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedId(client.id)}
                    className="w-full bg-white rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm border border-gray-100 hover:border-navy-200 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {client.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900 truncate">{client.name}</p>
                      <p className="text-sm text-gray-400 truncate">{client.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-navy-900">{client._count.appointments}</p>
                      <p className="text-xs text-gray-400">atend.</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreated={(c) => { setClients((prev) => [c, ...prev].sort((a, b) => a.name.localeCompare(b.name))); setShowNew(false) }}
        />
      )}
      {selectedId && <ClientDrawer clientId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
