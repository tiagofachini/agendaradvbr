import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const ADMIN_EMAIL = 'emaildogago@gmail.com'

const STATUS_CONFIG = {
  ACTIVE:     { label: 'Logada',     cls: 'bg-green-100 text-green-700' },
  REGISTERED: { label: 'Cadastrada', cls: 'bg-blue-100 text-blue-700' },
  DELETED:    { label: 'Excuída',   cls: 'bg-red-100 text-red-500' },
}

const PRESETS = [
  { label: 'Hoje',     days: 0 },
  { label: '7 dias',   days: 7 },
  { label: '30 dias',  days: 30 },
  { label: '90 dias',  days: 90 },
  { label: 'Este ano', year: true },
]

function getPresetRange(p) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const toStr = today.toISOString().slice(0, 10)
  if (p.year) return { from: `${today.getFullYear()}-01-01`, to: toStr }
  if (p.days === 0) return { from: toStr, to: toStr }
  const from = new Date(today)
  from.setDate(from.getDate() - p.days)
  return { from: from.toISOString().slice(0, 10), to: toStr }
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtFull(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const { session, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateField, setDateField] = useState('createdAt')
  const [activePreset, setActivePreset] = useState(null)
  const [custom, setCustom] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (!isAdmin) return
    api.get('/admin')
      .then(r => setUsers(r.data.users))
      .catch(e => setError(e.response?.data?.error || 'Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const applyPreset = (p) => {
    const range = getPresetRange(p)
    setActivePreset(p.label)
    setCustom(false)
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  const clearDate = () => {
    setActivePreset(null)
    setCustom(false)
    setDateFrom('')
    setDateTo('')
  }

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const q = search.toLowerCase()
        if (!u.name?.toLowerCase().includes(q) &&
            !u.email?.toLowerCase().includes(q) &&
            !u.whatsapp?.includes(search)) return false
      }
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false
      if (dateFrom || dateTo) {
        const val = u[dateField]
        if (!val) return false
        const d = val.slice(0, 10)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
      }
      return true
    })
  }, [users, search, statusFilter, dateField, dateFrom, dateTo])

  const stats = useMemo(() => ({
    total:      users.length,
    active:     users.filter(u => u.status === 'ACTIVE').length,
    registered: users.filter(u => u.status === 'REGISTERED').length,
    deleted:    users.filter(u => u.status === 'DELETED').length,
  }), [users])

  const handleDelete = async (u) => {
    if (!window.confirm(
      `Excluir permanentemente a conta de ${u.name} (${u.email})?\n\nEsta ação não pode ser desfeita.`
    )) return
    setDeleting(u.id)
    setError('')
    try {
      await api.delete(`/admin/${u.id}`)
      const { data } = await api.get('/admin')
      setUsers(data.users)
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao excluir conta')
    }
    setDeleting(null)
  }

  if (authLoading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Administração</h1>
        <p className="text-sm text-gray-400">Gestão de contas de usuários da plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',       value: stats.total,      color: 'text-navy-900' },
          { label: 'Logadas',     value: stats.active,     color: 'text-green-600' },
          { label: 'Cadastradas', value: stats.registered, color: 'text-blue-600' },
          { label: 'Excuídas',   value: stats.deleted,    color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou celular…"
            className={`flex-1 min-w-[200px] ${inputCls}`}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Logada</option>
            <option value="REGISTERED">Cadastrada</option>
            <option value="DELETED">Excuída</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={dateField} onChange={e => setDateField(e.target.value)} className={inputCls}>
            <option value="createdAt">Cadastro</option>
            <option value="lastSignInAt">Último login</option>
            <option value="deletedAt">Exclusão</option>
          </select>

          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                activePreset === p.label && !custom
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'border-gray-200 text-gray-500 hover:border-navy-400 hover:text-navy-700'
              }`}>
              {p.label}
            </button>
          ))}

          <button onClick={() => { setCustom(true); setActivePreset(null) }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              custom ? 'bg-navy-900 text-white border-navy-900' : 'border-gray-200 text-gray-500 hover:border-navy-400'
            }`}>
            Personalizado
          </button>

          {(dateFrom || dateTo) && (
            <button onClick={clearDate} className="text-xs text-gray-400 hover:text-red-400 underline">
              Limpar
            </button>
          )}
        </div>

        {custom && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
            <span className="text-gray-400 text-sm">até</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-2 px-1">
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        {users.length !== filtered.length && ` de ${users.length}`}
      </p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Celular</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Cadastro</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Último login</th>
                  <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Exclusão</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : filtered.map(u => {
                  const isSelf = u.email === ADMIN_EMAIL
                  const isDeleted = u.status === 'DELETED'
                  const st = STATUS_CONFIG[u.status] || STATUS_CONFIG.REGISTERED
                  return (
                    <tr key={u.id}
                      className={`hover:bg-gray-50/70 transition-colors ${isDeleted ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-navy-900 truncate max-w-[150px]">{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              você
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{u.email}</td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{u.whatsapp || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell whitespace-nowrap">{fmt(u.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell whitespace-nowrap">{fmtFull(u.lastSignInAt)}</td>
                      <td className="px-4 py-3 text-gray-400 hidden xl:table-cell whitespace-nowrap">{fmt(u.deletedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && !isDeleted && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deleting === u.id}
                            title="Excluir conta"
                            className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            {deleting === u.id ? '…' : 'excluir'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
