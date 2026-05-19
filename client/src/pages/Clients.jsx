import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import api from '../lib/api'

const STATUS_LABEL = {
  PENDING_PAYMENT: { label: 'Ag. Pagamento', color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:       { label: 'Confirmado',    color: 'bg-green-100 text-green-700' },
  CANCELLED:       { label: 'Cancelado',     color: 'bg-red-100 text-red-700' },
  COMPLETED:       { label: 'Realizado',     color: 'bg-blue-100 text-blue-700' },
  EXPIRED:         { label: 'Expirado',      color: 'bg-gray-100 text-gray-500' },
}

const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

function maskPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ── Modal novo / editar cliente ───────────────────────────────────────────────
function ClientModal({ initial, onClose, onSaved }) {
  const isNew = !initial?.id
  const [form, setForm] = useState({
    name:     initial?.name     || '',
    email:    initial?.email    || '',
    whatsapp: initial?.whatsapp || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (isNew) {
        const { data } = await api.post('/clients', form)
        onSaved(data)
      } else {
        const { data } = await api.put(`/clients/${initial.id}`, form)
        onSaved(data)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="font-bold text-navy-900 text-lg">{isNew ? 'Novo cliente' : 'Editar cliente'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls} placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputCls} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))}
              className={inputCls} placeholder="(11) 99999-9999" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50 hover:bg-navy-800 transition-colors">
            {loading ? 'Salvando...' : isNew ? 'Cadastrar cliente' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Seção de WhatsApp no drawer ───────────────────────────────────────────────
function WhatsAppSection({ clientId, clientWhatsapp }) {
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    api.get(`/whatsapp?clientId=${clientId}`)
      .then(r => setMessages(r.data))
      .catch(() => {})
  }, [clientId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    if (!msgText.trim() || sending) return
    setSending(true); setError('')
    try {
      const { data } = await api.post('/whatsapp/send', { clientId, message: msgText.trim() })
      setMessages(prev => [...prev, data])
      setMsgText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar mensagem')
    } finally { setSending(false) }
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="bg-gray-50 rounded-xl p-3 h-64 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">Nenhuma mensagem ainda.</p>
        ) : messages.map(m => (
          <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
              m.direction === 'OUTBOUND'
                ? 'bg-navy-900 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
            }`}>
              <p>{m.body}</p>
              <p className={`text-xs mt-1 ${m.direction === 'OUTBOUND' ? 'text-gray-400' : 'text-gray-400'}`}>
                {format(new Date(m.createdAt), 'HH:mm', { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <input
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Digite a mensagem..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
        />
        <button onClick={send} disabled={sending || !msgText.trim()}
          className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors">
          {sending ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

// ── Drawer de detalhe do cliente ──────────────────────────────────────────────
function ClientDrawer({ clientId, onClose, onClientUpdated }) {
  const [client, setClient] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)

  useEffect(() => {
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(console.error)
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
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-white h-full shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 bg-white">
            <h2 className="font-bold text-navy-900 text-lg">Detalhes do cliente</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditMode(true)}
                className="text-sm text-navy-700 font-medium hover:underline">
                Editar
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl ml-2">×</button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold text-xl mb-3">
                {client.name[0].toUpperCase()}
              </div>
              <h3 className="font-bold text-navy-900 text-lg">{client.name}</h3>
              <p className="text-sm text-gray-500">{client.email}</p>
              {client.whatsapp && (
                <button
                  onClick={() => setWhatsappOpen(o => !o)}
                  className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 mt-1">
                  <span>📱</span> {maskPhone(client.whatsapp)}
                  <span className="text-xs text-gray-400">({whatsappOpen ? 'fechar' : 'conversar'})</span>
                </button>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Cliente desde {format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>

            {/* WhatsApp conversation */}
            {whatsappOpen && client.whatsapp && (
              <div>
                <h4 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
                  <span>💬</span> WhatsApp
                </h4>
                <WhatsAppSection clientId={client.id} clientWhatsapp={client.whatsapp} />
              </div>
            )}

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

            {/* Histórico de atendimentos */}
            <div>
              <h4 className="font-semibold text-navy-900 mb-3">Histórico de atendimentos</h4>
              {client.appointments.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum atendimento registrado.</p>
              ) : (
                <div className="space-y-3">
                  {[...client.appointments]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((a) => {
                      const s = STATUS_LABEL[a.status] || STATUS_LABEL.EXPIRED
                      return (
                        <div key={a.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-navy-900">{a.specialty}</p>
                              <p className="text-xs text-gray-400">
                                {format(new Date(a.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${s.color}`}>{s.label}</span>
                          </div>
                          {a.description && (
                            <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2">
                              "{a.description}"
                            </p>
                          )}
                          {a.attendanceNotes && (
                            <div className="border-t border-gray-200 pt-2">
                              <p className="text-xs font-medium text-gray-500 mb-1">📝 Detalhes do atendimento:</p>
                              <div
                                className="text-xs text-gray-700 prose prose-xs max-w-none"
                                dangerouslySetInnerHTML={{ __html: a.attendanceNotes }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editMode && (
        <ClientModal
          initial={client}
          onClose={() => setEditMode(false)}
          onSaved={(updated) => {
            setClient(c => ({ ...c, ...updated }))
            onClientUpdated?.(updated)
            setEditMode(false)
          }}
        />
      )}
    </>
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
  const [selected, setSelected] = useState(new Set())
  const [bulkError, setBulkError] = useState('')

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

  const grouped = clients.reduce((acc, c) => {
    const letter = c.name[0].toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(c)
    return acc
  }, {})

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelect = () => setSelected(new Set())

  const bulkDelete = async () => {
    if (!window.confirm(`Excluir ${selected.size} cliente(s)? Esta ação não pode ser desfeita.`)) return
    setBulkError('')
    try {
      await api.delete('/clients/bulk', { data: { ids: [...selected] } })
      setClients(prev => prev.filter(c => !selected.has(c.id)))
      setTotal(t => t - selected.size)
      clearSelect()
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Erro ao excluir clientes')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clientes</h1>
          <p className="text-sm text-gray-500">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="px-5 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 transition-colors">
            + Novo cliente
          </button>
        </div>
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
          {Array(5).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}
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
                  <div key={client.id} className="flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(client.id)}
                      onChange={() => toggleSelect(client.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-navy-900 flex-shrink-0" />
                    <button
                      onClick={() => setSelectedId(client.id)}
                      className={`flex-1 bg-white rounded-xl px-4 py-4 flex items-center gap-4 shadow-sm border transition-all text-left
                        ${selected.has(client.id) ? 'border-navy-400 bg-navy-50' : 'border-gray-100 hover:border-navy-200 hover:shadow-md'}`}>
                      <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy-900 truncate">{client.name}</p>
                        <p className="text-sm text-gray-400 truncate">{client.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-navy-900">{client._count?.appointments ?? 0}</p>
                        <p className="text-xs text-gray-400">atend.</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de ações em lote */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-navy-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          {bulkError && <span className="text-xs text-red-400">{bulkError}</span>}
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <button onClick={() => setSelected(new Set(clients.map(c => c.id)))}
            className="text-xs text-gray-300 hover:text-white underline">Selecionar todos</button>
          <button onClick={bulkDelete}
            className="text-sm bg-red-500 hover:bg-red-400 px-3 py-1 rounded-lg transition-colors">
            Excluir selecionados
          </button>
          <button onClick={clearSelect} className="text-gray-300 hover:text-white text-lg">×</button>
        </div>
      )}

      {/* Modais */}
      {showNew && (
        <ClientModal
          onClose={() => setShowNew(false)}
          onSaved={(c) => {
            setClients(prev => [c, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
            setTotal(t => t + 1)
            setShowNew(false)
          }}
        />
      )}
      {selectedId && (
        <ClientDrawer
          clientId={selectedId}
          onClose={() => setSelectedId(null)}
          onClientUpdated={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))}
        />
      )}
    </div>
  )
}
