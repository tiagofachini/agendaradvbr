import { useState, useEffect, useCallback, useRef } from 'react'
import {
  format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, addMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import api from '../lib/api'
import { LEGAL_SPECIALTIES } from '../lib/specialties'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

const SOURCE_STYLES = {
  MANUAL: {
    PENDING_PAYMENT: { label: 'Ag. Pagamento', bg: 'bg-yellow-400', text: 'text-yellow-900', badge: 'bg-yellow-100 text-yellow-700' },
    CONFIRMED:       { label: 'Confirmado',    bg: 'bg-blue-600',   text: 'text-white',       badge: 'bg-blue-100 text-blue-700' },
    COMPLETED:       { label: 'Realizado',     bg: 'bg-green-500',  text: 'text-white',       badge: 'bg-green-100 text-green-700' },
    CANCELLED:       { label: 'Cancelado',     bg: 'bg-gray-300',   text: 'text-gray-600',    badge: 'bg-gray-100 text-gray-500' },
  },
  SCHEDULER: {
    PENDING_PAYMENT: { label: 'Ag. Pagamento', bg: 'bg-orange-400',  text: 'text-orange-900', badge: 'bg-orange-100 text-orange-700' },
    CONFIRMED:       { label: 'Confirmado',    bg: 'bg-violet-500',  text: 'text-white',       badge: 'bg-violet-100 text-violet-700' },
    COMPLETED:       { label: 'Realizado',     bg: 'bg-teal-500',    text: 'text-white',       badge: 'bg-teal-100 text-teal-700' },
    CANCELLED:       { label: 'Cancelado',     bg: 'bg-slate-300',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-500' },
  },
}

function getStyle(appt) {
  const src = appt?.source === 'SCHEDULER' ? 'SCHEDULER' : 'MANUAL'
  return SOURCE_STYLES[src][appt?.status] || SOURCE_STYLES[src].CONFIRMED
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

// ── Editor de texto rico (contenteditable) ────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder = 'Digite as anotações sobre o atendimento...' }) {
  const ref = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || ''
      initialized.current = true
    }
  }, [value])

  const exec = (cmd) => {
    ref.current.focus()
    document.execCommand(cmd, false)
    onChange(ref.current.innerHTML)
  }

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-navy-700">
      <div className="flex gap-1 p-1.5 border-b border-gray-200 bg-gray-50">
        {[
          { cmd: 'bold',                label: 'N', title: 'Negrito',  cls: 'font-bold' },
          { cmd: 'italic',              label: 'I', title: 'Itálico',  cls: 'italic' },
          { cmd: 'insertUnorderedList', label: '≡', title: 'Lista',    cls: '' },
        ].map(({ cmd, label, title, cls }) => (
          <button key={cmd} type="button" title={title}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd) }}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-200 text-gray-700 ${cls}`}>
            {label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current.innerHTML)}
        onBlur={() => onChange(ref.current.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[120px] px-4 py-3 text-sm focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  )
}

// ── Modal de compromisso ──────────────────────────────────────────────────────
function AppointmentModal({ initial, onClose, onSaved, onCancelled }) {
  const isNew = !initial?.id
  const [form, setForm] = useState({
    clientName: initial?.clientName || '',
    clientEmail: initial?.clientEmail || '',
    clientWhatsapp: initial?.clientWhatsapp || '',
    specialty: initial?.specialty || '',
    description: initial?.description || '',
    attendanceNotes: initial?.attendanceNotes || '',
    date: initial?.date ? format(new Date(initial.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: initial?.date ? format(new Date(initial.date), 'HH:mm') : '09:00',
    duration: initial?.duration || 60,
    status: initial?.status || 'PENDING_PAYMENT',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (isNew) {
        const { data } = await api.post('/appointments', form)
        onSaved(data)
      } else {
        const { data } = await api.put(`/appointments/${initial.id}`, {
          status: form.status,
          description: form.description,
          attendanceNotes: form.attendanceNotes,
        })
        onSaved({ ...initial, status: form.status, description: form.description, attendanceNotes: form.attendanceNotes })
      }
    } catch (err) {
      const msg = err.response?.data?.error
        || (typeof err.response?.data === 'string' ? err.response.data : null)
        || err.message
        || 'Erro ao salvar'
      setError(msg)
    } finally { setLoading(false) }
  }

  const cancel = async () => {
    if (!window.confirm('Cancelar este compromisso?')) return
    await api.delete(`/appointments/${initial.id}`).then(() => onCancelled(initial.id)).catch(console.error)
  }

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-navy-900 text-lg">{isNew ? 'Novo compromisso' : 'Compromisso'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {isNew && <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cliente *</label>
              <input required className={inputCls} value={form.clientName} onChange={upd('clientName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input required type="email" className={inputCls} value={form.clientEmail} onChange={upd('clientEmail')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input className={inputCls} value={form.clientWhatsapp}
                onChange={e => setForm(f => ({ ...f, clientWhatsapp: maskPhone(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade *</label>
              <select required className={inputCls} value={form.specialty} onChange={upd('specialty')}>
                <option value="">Selecione...</option>
                {LEGAL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>}
          {!isNew && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-navy-900">{initial.clientName}</p>
              <p className="text-sm text-gray-500">{initial.specialty}</p>
              <p className="text-sm text-gray-400">{format(new Date(initial.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input required type="date" className={inputCls} value={form.date} onChange={upd('date')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário *</label>
              <input required type="time" className={inputCls} value={form.time} onChange={upd('time')} />
            </div>
          </div>
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duração</label>
              <select className={inputCls} value={form.duration} onChange={upd('duration')}>
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={120}>120 minutos</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isNew ? 'Observações do cliente' : 'Observações do cliente'}
            </label>
            <textarea rows={3} className={inputCls + ' resize-none'} value={form.description} onChange={upd('description')}
              placeholder="Descrição relatada pelo cliente" />
          </div>
          {!isNew && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className={inputCls} value={form.status} onChange={upd('status')}>
                  <option value="PENDING_PAYMENT">Aguardando pagamento</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="COMPLETED">Realizado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes do atendimento</label>
                <RichTextEditor
                  value={form.attendanceNotes}
                  onChange={(html) => setForm(f => ({ ...f, attendanceNotes: html }))}
                />
              </div>
            </>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            {!isNew && (
              <button type="button" onClick={cancel}
                className="px-4 py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors">
                Cancelar compromisso
              </button>
            )}
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50 hover:bg-navy-800 transition-colors text-sm">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── View Semanal ──────────────────────────────────────────────────────────────
function WeekView({ weekStart, appointments, onSlotClick, onAppointmentClick }) {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })
  const byDay = days.map(d => appointments.filter(a => isSameDay(new Date(a.date), d)))

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className={`py-3 text-center border-l border-gray-100 ${isToday(d) ? 'bg-navy-50' : ''}`}>
            <div className="text-xs text-gray-400 font-medium uppercase">{format(d, 'EEE', { locale: ptBR })}</div>
            <div className={`text-lg font-bold mt-0.5 mx-auto w-9 h-9 flex items-center justify-center rounded-full
              ${isToday(d) ? 'bg-navy-900 text-white' : 'text-navy-900'}`}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        {HOURS.map(hour => (
          <div key={hour} className="grid border-b border-gray-50" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '64px' }}>
            <div className="text-xs text-gray-400 text-right pr-3 pt-1 font-medium">{hour}:00</div>
            {days.map((d, di) => {
              const appts = byDay[di].filter(a => new Date(a.date).getHours() === hour)
              return (
                <div key={di}
                  className={`border-l border-gray-100 p-1 relative cursor-pointer hover:bg-gray-50 transition-colors ${isToday(d) ? 'bg-navy-50/50' : ''}`}
                  onClick={() => onSlotClick(d, hour)}>
                  {appts.map(a => {
                    const s = getStyle(a)
                    return (
                      <div key={a.id} onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
                        className={`${s.bg} ${s.text} text-xs rounded-lg px-1.5 py-1 mb-1 cursor-pointer hover:opacity-80 transition-opacity truncate`}
                        title={a.attendanceNotes ? '📝 Com anotações' : ''}>
                        <span className="font-semibold">{format(new Date(a.date), 'HH:mm')}</span> {a.clientName}
                        {a.attendanceNotes && <span className="ml-1 opacity-70">·</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── View Lista ────────────────────────────────────────────────────────────────
function ListView({ appointments, onAppointmentClick, selected, onToggle }) {
  if (!appointments.length) return (
    <div className="bg-white rounded-2xl shadow-sm py-16 text-center">
      <div className="text-5xl mb-3">📅</div>
      <p className="text-gray-400 font-medium">Nenhum compromisso no período.</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {appointments.map((a) => {
        const s = getStyle(a)
        const isChecked = selected.has(a.id)
        return (
          <div key={a.id}
            className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer last:border-0"
            onClick={() => onAppointmentClick(a)}>
            <input type="checkbox" checked={isChecked} onChange={() => onToggle(a.id)}
              onClick={e => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 accent-navy-900 flex-shrink-0" />
            <div className="text-center flex-shrink-0 w-12">
              <div className="text-xs text-gray-400 font-medium">{format(new Date(a.date), 'EEE', { locale: ptBR })}</div>
              <div className="text-xl font-bold text-navy-900">{format(new Date(a.date), 'd')}</div>
              <div className="text-xs text-gray-400">{format(new Date(a.date), 'MMM', { locale: ptBR })}</div>
            </div>
            <div className={`w-1 h-12 rounded-full flex-shrink-0 ${s.bg}`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-900">{a.clientName}</p>
              <p className="text-sm text-gray-500">{a.specialty} · {format(new Date(a.date), 'HH:mm')} ({a.duration}min)
                {a.attendanceNotes && <span className="ml-2 text-xs text-gray-400">· 📝</span>}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${s.badge}`}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Appointments() {
  const [view, setView] = useState('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkError, setBulkError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const start = format(view === 'list' ? new Date() : weekStart, 'yyyy-MM-dd')
      const end = format(view === 'list' ? addMonths(new Date(), 1) : weekEnd, 'yyyy-MM-dd')
      const { data } = await api.get(`/appointments?start=${start}&end=${end}`)
      setAppointments(data)
    } catch { /* noop */ }
    setLoading(false)
  }, [weekStart, view])

  useEffect(() => { load() }, [load])

  // Filtro de status (client-side)
  const filtered = statusFilter
    ? appointments.filter(a => a.status === statusFilter)
    : appointments

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(filtered.map(a => a.id)))
  const clearSelect = () => setSelected(new Set())

  const bulkDelete = async () => {
    if (!window.confirm(`Excluir ${selected.size} compromisso(s)?`)) return
    setBulkError('')
    try {
      await api.delete('/appointments/bulk', { data: { ids: [...selected] } })
      setAppointments(prev => prev.filter(a => !selected.has(a.id)))
      clearSelect()
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Erro ao excluir compromissos')
    }
  }

  const bulkChangeStatus = async () => {
    if (!bulkStatus) return
    await Promise.all([...selected].map(id =>
      api.put(`/appointments/${id}`, { status: bulkStatus })
    ))
    setAppointments(prev => prev.map(a => selected.has(a.id) ? { ...a, status: bulkStatus } : a))
    clearSelect()
    setBulkStatus('')
  }

  const openNew = (date, hour) => {
    const time = `${String(hour).padStart(2, '0')}:00`
    setModal({ mode: 'new', date: format(date, 'yyyy-MM-dd'), time })
  }

  const saved = (appt) => {
    setAppointments(prev => {
      const idx = prev.findIndex(a => a.id === appt.id)
      return idx >= 0 ? prev.map(a => a.id === appt.id ? appt : a) : [...prev, appt]
    })
    setModal(null)
  }

  const cancelled = (id) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a))
    setModal(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Compromissos</h1>
          <p className="text-sm text-gray-500">
            {view === 'week'
              ? `${format(weekStart, "d 'de' MMM", { locale: ptBR })} — ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d 'de' MMM", { locale: ptBR })}`
              : 'Próximos 30 dias'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de status */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-navy-700">
            <option value="">Todos os status</option>
            <option value="PENDING_PAYMENT">Ag. Pagamento</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="COMPLETED">Realizado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          {/* View switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[{ v: 'week', l: 'Semana' }, { v: 'list', l: 'Lista' }].map(({ v, l }) => (
              <button key={v} onClick={() => { setView(v); clearSelect() }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${view === v ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => setModal({ mode: 'new', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00' })}
            className="px-4 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 transition-colors">
            + Novo
          </button>
        </div>
      </div>

      {/* Navegação semana */}
      {view === 'week' && (
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-navy-900 font-bold">‹</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-navy-900">Hoje</button>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-navy-900 font-bold">›</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm h-96 animate-pulse" />
      ) : view === 'week' ? (
        <WeekView
          weekStart={weekStart}
          appointments={filtered}
          onSlotClick={openNew}
          onAppointmentClick={(a) => setModal({ mode: 'edit', appointment: a })}
        />
      ) : (
        <ListView
          appointments={filtered}
          onAppointmentClick={(a) => setModal({ mode: 'edit', appointment: a })}
          selected={selected}
          onToggle={toggleSelect}
        />
      )}

      {/* Legenda */}
      <div className="mt-4 space-y-2">
        {[
          { label: 'Agendado manualmente', src: 'MANUAL' },
          { label: 'Agendado pelo cliente', src: 'SCHEDULER' },
        ].map(({ label, src }) => (
          <div key={src} className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
            {Object.values(SOURCE_STYLES[src]).map((v, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${v.bg}`} />
                <span className="text-xs text-gray-500">{v.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Barra de ações em lote */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-navy-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          {bulkError && <span className="text-xs text-red-400">{bulkError}</span>}
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <button onClick={selectAll} className="text-xs text-gray-300 hover:text-white underline">Todos</button>
          <div className="flex items-center gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              className="text-sm bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white focus:outline-none">
              <option value="">Alterar status...</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="COMPLETED">Realizado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
            {bulkStatus && (
              <button onClick={bulkChangeStatus}
                className="text-sm bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded-lg transition-colors">
                Aplicar
              </button>
            )}
          </div>
          <button onClick={bulkDelete}
            className="text-sm bg-red-500 hover:bg-red-400 px-3 py-1 rounded-lg transition-colors">
            Excluir
          </button>
          <button onClick={clearSelect} className="text-gray-300 hover:text-white text-lg">×</button>
        </div>
      )}

      {modal && (
        <AppointmentModal
          initial={modal.mode === 'edit' ? modal.appointment : { date: modal.date + 'T' + modal.time + ':00', duration: 60 }}
          onClose={() => setModal(null)}
          onSaved={saved}
          onCancelled={cancelled}
        />
      )}
    </div>
  )
}
