import { useState, useEffect } from 'react'
import api from '../lib/api'
import { LEGAL_SPECIALTIES } from '../lib/specialties'

const TABS = [
  { key: 'account',   label: '👤 Conta' },
  { key: 'office',    label: '🏢 Escritório' },
  { key: 'scheduler', label: '🔗 Agendador' },
  { key: 'calendar',  label: '📅 Agenda' },
  { key: 'financial', label: '💳 Financeiro' },
  { key: 'alerts',    label: '🔔 Alertas' },
]

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function SaveBtn({ loading, saved }) {
  return (
    <button type="submit" disabled={loading}
      className="px-6 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm disabled:opacity-50 hover:bg-navy-800 transition-colors">
      {loading ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
    </button>
  )
}

function Section({ title, desc, children, onSubmit, loading, saved }) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-sm p-6 mb-5">
      <div className="mb-5">
        <h3 className="font-bold text-navy-900 text-lg">{title}</h3>
        {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      <div className="mt-5 flex justify-end">
        <SaveBtn loading={loading} saved={saved} />
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

// ── Conta ─────────────────────────────────────────────────────────────────────
function AccountSection({ data, onSaved }) {
  const [form, setForm] = useState({ name: data.name || '', email: data.email || '', whatsapp: data.whatsapp || '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false)
    await api.put('/settings/account', form).then(() => { setSaved(true); onSaved() }).catch(console.error)
    setLoading(false)
  }

  return (
    <Section title="Configurações da conta" onSubmit={save} loading={loading} saved={saved}>
      <Field label="Nome completo"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Email de trabalho"><input className={inputCls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="WhatsApp"><input className={inputCls} value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></Field>
    </Section>
  )
}

// ── Escritório ────────────────────────────────────────────────────────────────
function OfficeSection({ data }) {
  const s = data.settings || {}
  const [form, setForm] = useState({
    cep: s.cep || '', street: s.street || '', number: s.number || '',
    complement: s.complement || '', neighborhood: s.neighborhood || '',
    city: s.city || '', state: s.state || '', logoUrl: s.logoUrl || '',
    specialties: s.specialties || [],
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [specSearch, setSpecSearch] = useState('')

  const lookupCep = async () => {
    if (form.cep.replace(/\D/g, '').length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${form.cep.replace(/\D/g, '')}/json/`)
      const d = await r.json()
      if (!d.erro) setForm(f => ({ ...f, street: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf }))
    } catch { /* noop */ }
    setCepLoading(false)
  }

  const toggleSpecialty = (s) => {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s],
    }))
  }

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false)
    await api.put('/settings/office', form).then(() => setSaved(true)).catch(console.error)
    setLoading(false)
  }

  return (
    <Section title="Configurações do escritório" onSubmit={save} loading={loading} saved={saved}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="CEP">
          <div className="flex gap-2">
            <input className={inputCls} value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} onBlur={lookupCep} placeholder="00000-000" />
            {cepLoading && <span className="text-xs text-gray-400 self-center">Buscando...</span>}
          </div>
        </Field>
        <Field label="Estado"><input className={inputCls} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SP" /></Field>
      </div>
      <Field label="Logradouro"><input className={inputCls} value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número"><input className={inputCls} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></Field>
        <Field label="Complemento"><input className={inputCls} value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bairro"><input className={inputCls} value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} /></Field>
        <Field label="Cidade"><input className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
      </div>
      <Field label="URL da logomarca (ou faça upload abaixo)">
        <input className={inputCls} value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
      </Field>
      {form.logoUrl && <img src={form.logoUrl} alt="logo preview" className="h-16 mt-1 rounded-lg object-contain border border-gray-100" />}
      <Field label="Especialidades do escritório">
        <input className={inputCls + ' mb-2'} placeholder="Buscar especialidade..." value={specSearch} onChange={e => setSpecSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {LEGAL_SPECIALTIES.filter(s => s.toLowerCase().includes(specSearch.toLowerCase())).map(s => (
            <button type="button" key={s} onClick={() => toggleSpecialty(s)}
              className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-colors
                ${form.specialties.includes(s) ? 'bg-navy-900 border-navy-900 text-white' : 'border-gray-200 text-gray-600 hover:border-navy-900'}`}>
              {s}
            </button>
          ))}
        </div>
      </Field>
    </Section>
  )
}

// ── Agendador ─────────────────────────────────────────────────────────────────
function SchedulerSection({ data }) {
  const s = data.settings || {}
  const [form, setForm] = useState({ schedulerSlug: s.schedulerSlug || '', slotDuration: s.slotDuration || 60, highlightMessage: s.highlightMessage || '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    await api.put('/settings/scheduler', form)
      .then(() => setSaved(true))
      .catch(err => setError(err.response?.data?.error || 'Erro ao salvar'))
    setLoading(false)
  }

  return (
    <Section title="Configurações do agendador" desc="Configure seu link público de agendamento." onSubmit={save} loading={loading} saved={saved}>
      <Field label="URL personalizada">
        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-navy-700">
          <span className="px-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-300 py-2.5 whitespace-nowrap">agendar.adv.br/agendar/</span>
          <input className="flex-1 px-3 py-2.5 text-sm focus:outline-none" value={form.schedulerSlug}
            onChange={e => setForm({ ...form, schedulerSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="seu-nome" />
        </div>
      </Field>
      <Field label="Duração dos slots">
        <select className={inputCls} value={form.slotDuration} onChange={e => setForm({ ...form, slotDuration: Number(e.target.value) })}>
          <option value={30}>30 minutos</option>
          <option value={60}>60 minutos</option>
          <option value={120}>120 minutos</option>
        </select>
      </Field>
      <Field label="Mensagem de destaque (opcional)">
        <input className={inputCls} value={form.highlightMessage} onChange={e => setForm({ ...form, highlightMessage: e.target.value })} placeholder="Ex: Primeira consulta com desconto!" />
      </Field>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </Section>
  )
}

// ── Agenda ────────────────────────────────────────────────────────────────────
function CalendarSection({ data }) {
  const s = data.settings || {}
  const [form, setForm] = useState({
    workDays: s.workDays || [1, 2, 3, 4, 5],
    workStartTime: s.workStartTime || '09:00',
    workEndTime: s.workEndTime || '18:00',
    hourlyRate: s.hourlyRate || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleDay = (d) => setForm(f => ({ ...f, workDays: f.workDays.includes(d) ? f.workDays.filter(x => x !== d) : [...f.workDays, d].sort() }))

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false)
    await api.put('/settings/calendar', form).then(() => setSaved(true)).catch(console.error)
    setLoading(false)
  }

  return (
    <Section title="Configurações da agenda" onSubmit={save} loading={loading} saved={saved}>
      <Field label="Dias de trabalho">
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d, i) => (
            <button type="button" key={d} onClick={() => toggleDay(i)}
              className={`w-12 h-12 rounded-xl text-sm font-semibold border-2 transition-colors
                ${form.workDays.includes(i) ? 'bg-navy-900 border-navy-900 text-white' : 'border-gray-200 text-gray-500 hover:border-navy-900'}`}>
              {d}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Horário de início">
          <input type="time" className={inputCls} value={form.workStartTime} onChange={e => setForm({ ...form, workStartTime: e.target.value })} />
        </Field>
        <Field label="Horário de término">
          <input type="time" className={inputCls} value={form.workEndTime} onChange={e => setForm({ ...form, workEndTime: e.target.value })} />
        </Field>
      </div>
      <Field label="Valor da consulta por hora (R$)">
        <input type="number" className={inputCls} value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} placeholder="Ex: 300" min="0" step="0.01" />
      </Field>
    </Section>
  )
}

// ── Financeiro ────────────────────────────────────────────────────────────────
function FinancialSection({ data }) {
  const s = data.settings || {}
  const [key, setKey] = useState(s.asaasApiKey ? '••••••••' + s.asaasApiKey.slice(-4) : '')
  const [realKey, setRealKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false)
    await api.put('/settings/financial', { asaasApiKey: realKey || undefined }).then(() => setSaved(true)).catch(console.error)
    setLoading(false)
  }

  return (
    <Section title="Configurações financeiras" desc="Conecte sua conta Asaas para receber pagamentos." onSubmit={save} loading={loading} saved={saved}>
      <Field label="API Key do Asaas">
        <input className={inputCls} type="password" value={realKey || key}
          onChange={e => { setRealKey(e.target.value); setKey(e.target.value) }}
          placeholder="$aact_..." />
      </Field>
      <p className="text-xs text-gray-400">Encontre sua API Key em Asaas → Configurações → Integrações.</p>
    </Section>
  )
}

// ── Alertas ───────────────────────────────────────────────────────────────────
function AlertsSection({ data }) {
  const s = data.settings || {}
  const [form, setForm] = useState({
    newBookingByEmail: s.newBookingByEmail ?? true,
    newBookingByWhatsapp: s.newBookingByWhatsapp ?? false,
    cancellationByEmail: s.cancellationByEmail ?? true,
    cancellationByWhatsapp: s.cancellationByWhatsapp ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false)
    await api.put('/settings/alerts', form).then(() => setSaved(true)).catch(console.error)
    setLoading(false)
  }

  const Toggle = ({ field, label }) => (
    <label className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div onClick={() => setForm(f => ({ ...f, [field]: !f[field] }))}
        className={`w-11 h-6 rounded-full transition-colors relative ${form[field] ? 'bg-navy-900' : 'bg-gray-200'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form[field] ? 'left-6' : 'left-1'}`} />
      </div>
    </label>
  )

  return (
    <Section title="Configurações de alertas" desc="Receba avisos dos seus agendamentos." onSubmit={save} loading={loading} saved={saved}>
      <div className="bg-gray-50 rounded-xl px-4">
        <Toggle field="newBookingByEmail"      label="Novo agendamento por email" />
        <Toggle field="newBookingByWhatsapp"   label="Novo agendamento por WhatsApp" />
        <Toggle field="cancellationByEmail"    label="Cancelamento por email" />
        <Toggle field="cancellationByWhatsapp" label="Cancelamento por WhatsApp" />
      </div>
    </Section>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('account')
  const [settingsData, setSettingsData] = useState(null)

  const load = () => api.get('/settings').then(r => setSettingsData(r.data)).catch(console.error)
  useEffect(() => { load() }, [])

  if (!settingsData) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="animate-pulse text-gray-400">Carregando configurações...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-900">Configurações</h1>
        <p className="text-sm text-gray-500">Personalize seu escritório e agendador</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === key ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Seções */}
      {activeTab === 'account'   && <AccountSection   data={settingsData} onSaved={load} />}
      {activeTab === 'office'    && <OfficeSection     data={settingsData} />}
      {activeTab === 'scheduler' && <SchedulerSection  data={settingsData} />}
      {activeTab === 'calendar'  && <CalendarSection   data={settingsData} />}
      {activeTab === 'financial' && <FinancialSection  data={settingsData} />}
      {activeTab === 'alerts'    && <AlertsSection     data={settingsData} />}
    </div>
  )
}
