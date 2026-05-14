import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
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

function maskPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'Erro ao salvar. Tente novamente.'
}

function SaveBtn({ loading, saved }) {
  return (
    <button type="submit" disabled={loading}
      className="px-6 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm disabled:opacity-50 hover:bg-navy-800 transition-colors">
      {loading ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
    </button>
  )
}

function Section({ title, desc, children, onSubmit, loading, saved, error }) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-sm p-6 mb-5">
      <div className="mb-5">
        <h3 className="font-bold text-navy-900 text-lg">{title}</h3>
        {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
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

function InfoBlock({ children }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5 text-sm leading-relaxed text-gray-600">
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

function LogoUpload({ currentUrl, lawyerId, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [err, setErr] = useState('')

  const removeAll = async () => {
    const { data: files } = await supabase.storage.from('logos').list(lawyerId)
    if (files?.length) {
      await supabase.storage.from('logos').remove(files.map(f => `${lawyerId}/${f.name}`))
    }
  }

  const handleRemove = async () => {
    setRemoving(true); setErr('')
    try {
      await removeAll()
      onChange('')
    } catch (e) {
      setErr(e.message || 'Erro ao remover imagem.')
    }
    setRemoving(false)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErr('Arquivo maior que 5MB'); return }
    if (!file.type.startsWith('image/')) { setErr('Envie um arquivo de imagem (PNG, JPG ou SVG)'); return }
    setUploading(true); setErr('')
    try { await removeAll() } catch { /* ignora */ }
    const path = `${lawyerId}/logo`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { setErr(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    onChange(`${publicUrl}?t=${Date.now()}`)
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      {currentUrl && (
        <div className="flex items-start gap-3">
          <img src={currentUrl} alt="Logo" className="h-20 rounded-xl object-contain border border-gray-100 bg-gray-50 p-2" />
          <button type="button" onClick={handleRemove} disabled={removing}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors mt-1">
            {removing ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      )}
      <label className="block border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-navy-700 transition-colors">
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        {uploading ? (
          <p className="text-sm text-gray-400 animate-pulse">Enviando...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-600">
              {currentUrl ? 'Clique para trocar a logo' : 'Clique para enviar a logo do escritório'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG ou SVG — máximo 5MB. Clique em Salvar após o upload.</p>
          </>
        )}
      </label>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </div>
  )
}

function ColorPicker({ label, value, onChange }) {
  const pickerVal = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={pickerVal} onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0" />
        <input className={inputCls} value={value} onChange={e => onChange(e.target.value)}
          placeholder="#1a1a2e" maxLength={7} />
      </div>
    </div>
  )
}

function AccountSection({ data, onSaved }) {
  const a = data.account || {}
  const [form, setForm] = useState({ name: a.name || '', email: a.email || '', whatsapp: a.whatsapp || '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const a = data.account || {}
    setForm({ name: a.name || '', email: a.email || '', whatsapp: a.whatsapp || '' })
  }, [data])

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    try {
      await api.put('/settings/account', form)
      setSaved(true); onSaved()
    } catch (err) {
      setError(errMsg(err))
    }
    setLoading(false)
  }

  return (
    <Section title="Dados da conta" onSubmit={save} loading={loading} saved={saved} error={error}>
      <InfoBlock>
        <p className="font-semibold text-navy-900">Seus dados de identificação</p>
        <p>Seu nome aparece na página pública de agendamento, para que os clientes saibam com quem estão marcando consulta. O email é usado para login e notificações. O WhatsApp pode ser utilizado para alertas instantâneos quando um agendamento for feito ou cancelado.</p>
      </InfoBlock>
      <Field label="Nome completo">
        <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Email de trabalho">
        <input className={inputCls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="WhatsApp / Celular">
        <input className={inputCls} value={form.whatsapp}
          onChange={e => setForm({ ...form, whatsapp: maskPhone(e.target.value) })}
          placeholder="(11) 99999-9999" maxLength={15} inputMode="numeric" />
      </Field>
    </Section>
  )
}

function OfficeSection({ data, onSaved }) {
  const { lawyer } = useAuth()
  const o = data.office || {}
  const [form, setForm] = useState({
    cep: o.cep || '', street: o.street || '', number: o.number || '',
    complement: o.complement || '', neighborhood: o.neighborhood || '',
    city: o.city || '', state: o.state || '', logoUrl: o.logoUrl || '',
    specialties: o.specialties || [],
    brandColor1: o.brandColor1 || '', brandColor2: o.brandColor2 || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [specSearch, setSpecSearch] = useState('')

  useEffect(() => {
    const o = data.office || {}
    setForm({
      cep: o.cep || '', street: o.street || '', number: o.number || '',
      complement: o.complement || '', neighborhood: o.neighborhood || '',
      city: o.city || '', state: o.state || '', logoUrl: o.logoUrl || '',
      specialties: o.specialties || [],
      brandColor1: o.brandColor1 || '', brandColor2: o.brandColor2 || '',
    })
  }, [data])

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

  const toggleSpecialty = (s) =>
    setForm(f => {
      if (f.specialties.includes(s)) return { ...f, specialties: f.specialties.filter(x => x !== s) }
      if (f.specialties.length >= 5) return f
      return { ...f, specialties: [...f.specialties, s] }
    })

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    try {
      await api.put('/settings/office', form)
      setSaved(true); onSaved()
    } catch (err) {
      setError(errMsg(err))
    }
    setLoading(false)
  }

  return (
    <Section title="Dados do escritório" onSubmit={save} loading={loading} saved={saved} error={error}>
      <InfoBlock>
        <p className="font-semibold text-navy-900">Sua vitrine profissional</p>
        <p>Estas informações aparecem na sua página pública de agendamento. Uma logo bem cuidada e as especialidades corretas aumentam a confiança do cliente antes mesmo do primeiro contato. O endereço completo demonstra profissionalismo e facilita que o cliente saiba onde ficará a consulta presencial.</p>
        <p className="text-xs text-blue-600 font-medium">Dica: selecione apenas as especialidades que você realmente atende — isso ajuda o cliente a confirmar que você é o advogado certo para o caso dele.</p>
      </InfoBlock>
      <Field label="Logo do escritório">
        <LogoUpload currentUrl={form.logoUrl} lawyerId={lawyer?.id} onChange={url => setForm(f => ({ ...f, logoUrl: url }))} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="CEP">
          <div className="flex gap-2">
            <input className={inputCls} value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} onBlur={lookupCep} placeholder="00000-000" />
            {cepLoading && <span className="text-xs text-gray-400 self-center">Buscando...</span>}
          </div>
        </Field>
        <Field label="Estado">
          <input className={inputCls} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SP" />
        </Field>
      </div>
      <Field label="Logradouro">
        <input className={inputCls} value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número">
          <input className={inputCls} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
        </Field>
        <Field label="Complemento">
          <input className={inputCls} value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bairro">
          <input className={inputCls} value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
        </Field>
        <Field label="Cidade">
          <input className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        </Field>
      </div>
      <Field label="Especialidades do escritório">
        <div className="flex items-center justify-between mb-2">
          <input className={inputCls + ' flex-1 mr-3'} placeholder="Buscar especialidade..." value={specSearch} onChange={e => setSpecSearch(e.target.value)} />
          <span className={`text-xs font-medium flex-shrink-0 ${form.specialties.length >= 5 ? 'text-red-500' : 'text-gray-400'}`}>
            {form.specialties.length}/5
          </span>
        </div>
        {form.specialties.length >= 5 && (
          <p className="text-xs text-red-500 mb-2">Limite de 5 especialidades atingido. Remova uma para adicionar outra.</p>
        )}
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {LEGAL_SPECIALTIES.filter(s => s.toLowerCase().includes(specSearch.toLowerCase())).map(s => {
            const selected = form.specialties.includes(s)
            const disabled = !selected && form.specialties.length >= 5
            return (
              <button type="button" key={s} onClick={() => toggleSpecialty(s)} disabled={disabled}
                className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-colors
                  ${selected ? 'bg-navy-900 border-navy-900 text-white' : disabled ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:border-navy-900'}`}>
                {s}
              </button>
            )
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <ColorPicker label="Cor principal"
          value={form.brandColor1}
          onChange={v => setForm(f => ({ ...f, brandColor1: v }))} />
        <ColorPicker label="Cor de destaque"
          value={form.brandColor2}
          onChange={v => setForm(f => ({ ...f, brandColor2: v }))} />
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Estas cores personalizam os botões e elementos da sua página de agendamento.
      </p>
    </Section>
  )
}

function SchedulerSection({ data, onSaved }) {
  const sc = data.scheduler || {}
  const [form, setForm] = useState({
    schedulerSlug: sc.schedulerSlug || '',
    slotDuration: sc.slotDuration || 60,
    highlightMessage: sc.highlightMessage || '',
    customMeetingUrl: sc.customMeetingUrl || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sc = data.scheduler || {}
    setForm({
      schedulerSlug: sc.schedulerSlug || '',
      slotDuration: sc.slotDuration || 60,
      highlightMessage: sc.highlightMessage || '',
      customMeetingUrl: sc.customMeetingUrl || '',
    })
  }, [data])

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    try {
      await api.put('/settings/scheduler', form)
      setSaved(true); onSaved()
    } catch (err) {
      setError(err.response?.data?.error || errMsg(err))
    }
    setLoading(false)
  }

  return (
    <Section title="Configurações do agendador" desc="Configure seu link público de agendamento." onSubmit={save} loading={loading} saved={saved} error={error}>
      <InfoBlock>
        <p className="font-semibold text-navy-900">O que é o endereço de agendamento?</p>
        <p>É o link exclusivo que você compartilha com seus clientes para que eles agendem uma consulta diretamente com você — sem intermediários, sem telefonemas. O cliente acessa, escolhe o horário disponível e confirma o agendamento em poucos cliques.</p>
        <p>O endereço fica no formato <span className="font-semibold text-navy-900">agendar.adv.br/seu-nome</span>. Você pode divulgá-lo no Instagram, no WhatsApp, no cartão de visitas ou na assinatura do seu email.</p>
      </InfoBlock>
      <Field label="Endereço personalizado">
        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-navy-700">
          <span className="px-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-300 py-2.5 whitespace-nowrap">agendar.adv.br/</span>
          <input className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
            value={form.schedulerSlug}
            onChange={e => setForm({ ...form, schedulerSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder="seu-nome" />
          {form.schedulerSlug && (
            <a href={`https://agendar.adv.br/${form.schedulerSlug}`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2.5 text-sm text-navy-700 font-semibold border-l border-gray-300 hover:bg-navy-50 transition-colors whitespace-nowrap">
              Testar →
            </a>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Use letras minúsculas, números e hífens. O endereço é único — se já estiver em uso você receberá um aviso.</p>
      </Field>
      <Field label="Duração de cada consulta">
        <select className={inputCls} value={form.slotDuration} onChange={e => setForm({ ...form, slotDuration: Number(e.target.value) })}>
          <option value={30}>30 minutos</option>
          <option value={60}>60 minutos</option>
          <option value={120}>2 horas</option>
        </select>
      </Field>
      <Field label="Mensagem de destaque (opcional)">
        <input className={inputCls} value={form.highlightMessage}
          onChange={e => setForm({ ...form, highlightMessage: e.target.value })}
          placeholder="Ex: Primeira consulta com desconto!" />
      </Field>
      <Field label="Link de reunião padrão (Google Meet, Zoom, Teams…)">
        <input className={inputCls} value={form.customMeetingUrl}
          onChange={e => setForm({ ...form, customMeetingUrl: e.target.value })}
          placeholder="https://meet.google.com/xxx-yyyy-zzz" />
        <p className="text-xs text-gray-400 mt-1.5">
          Usado quando não há endereço físico configurado. Deixe em branco para gerar link automático (Jitsi).
        </p>
      </Field>
    </Section>
  )
}

function CalendarSection({ data, onSaved }) {
  const c = data.calendar || {}
  const [form, setForm] = useState({
    workDays: c.workDays || [1, 2, 3, 4, 5],
    workStartTime: c.workStartTime || '09:00',
    workEndTime: c.workEndTime || '18:00',
    hourlyRate: c.hourlyRate || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const c = data.calendar || {}
    setForm({
      workDays: c.workDays || [1, 2, 3, 4, 5],
      workStartTime: c.workStartTime || '09:00',
      workEndTime: c.workEndTime || '18:00',
      hourlyRate: c.hourlyRate || '',
    })
  }, [data])

  const toggleDay = (d) =>
    setForm(f => ({
      ...f,
      workDays: f.workDays.includes(d) ? f.workDays.filter(x => x !== d) : [...f.workDays, d].sort(),
    }))

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    try {
      await api.put('/settings/calendar', form)
      setSaved(true); onSaved()
    } catch (err) {
      setError(errMsg(err))
    }
    setLoading(false)
  }

  return (
    <Section title="Configurações da agenda" onSubmit={save} loading={loading} saved={saved} error={error}>
      <InfoBlock>
        <p className="font-semibold text-navy-900">Defina sua disponibilidade</p>
        <p>Estes são os horários e dias que seus clientes verão disponíveis para agendar. Fora dessa janela, nenhum horário será oferecido.</p>
        <p>O <span className="font-semibold">valor da consulta por hora</span> é usado pelo sistema para calcular automaticamente o valor cobrado ao cliente via Stripe. Se não quiser cobrança automática, deixe o campo em branco.</p>
      </InfoBlock>
      <Field label="Dias de trabalho">
        <div className="flex gap-2 flex-wrap">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, i) => (
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
      <Field label="Valor da consulta (R$/hora)">
        <input type="number" className={inputCls} value={form.hourlyRate}
          onChange={e => setForm({ ...form, hourlyRate: e.target.value })}
          placeholder="Ex: 300" min="0" step="0.01" />
      </Field>
    </Section>
  )
}

function FinancialSection({ data }) {
  const f = data.financial || {}
  const [onboarding, setOnboarding] = useState(false)
  const [error, setError] = useState('')

  const startOnboarding = async () => {
    setOnboarding(true); setError('')
    try {
      const { data: res } = await api.post('/stripe-connect/onboard')
      if (res.url) window.location.href = res.url
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar conexão com Stripe.')
    } finally {
      setOnboarding(false)
    }
  }

  const isConnected = f.stripeChargesEnabled
  const isPending = f.stripeAccountId && !f.stripeChargesEnabled

  return (
    <div className="space-y-5">
      <div className="bg-navy-900 rounded-2xl p-6 text-white">
        <h3 className="font-bold text-lg mb-4">Como funciona o recebimento?</h3>
        <div className="space-y-4">
          {[
            ['1', 'Seu cliente acessa seu link, escolhe o horário e paga diretamente na página — sem sair da aplicação.'],
            ['2', 'Usamos o Stripe, a maior plataforma de pagamentos do mundo. Aceitamos cartão de crédito, débito e PIX.'],
            ['3', 'O dinheiro cai direto na sua conta bancária cadastrada no Stripe. O AgendarAdv retém apenas 0,05% como taxa de plataforma.'],
          ].map(([n, text]) => (
            <div key={n} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center text-sm font-bold text-navy-900">{n}</span>
              <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-navy-900 text-lg">Conta Stripe Connect</h3>

        {isConnected && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
            <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm">Conta conectada e ativa</p>
              <p className="text-xs text-green-600 mt-0.5">Você já pode receber pagamentos pela plataforma.</p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
            <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800 text-sm">Verificação pendente</p>
              <p className="text-xs text-yellow-700 mt-0.5">Complete o cadastro no Stripe para começar a receber.</p>
            </div>
          </div>
        )}

        {!f.stripeAccountId && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="w-3 h-3 bg-gray-300 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-700 text-sm">Conta não conectada</p>
              <p className="text-xs text-gray-500 mt-0.5">Conecte sua conta Stripe para aceitar pagamentos.</p>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!isConnected && (
          <button onClick={startOnboarding} disabled={onboarding}
            className="w-full py-3 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 transition-colors disabled:opacity-50">
            {onboarding ? 'Redirecionando...' : isPending ? 'Continuar cadastro no Stripe →' : 'Conectar conta Stripe →'}
          </button>
        )}

        {isConnected && (
          <p className="text-xs text-gray-400 text-center">
            Para gerenciar saques e dados bancários, acesse o painel Stripe na aba Financeiro.
          </p>
        )}
      </div>
    </div>
  )
}

function AlertsSection({ data, onSaved }) {
  const al = data.alerts || {}
  const [form, setForm] = useState({
    newBookingByEmail: al.newBookingByEmail ?? true,
    newBookingByWhatsapp: al.newBookingByWhatsapp ?? false,
    cancellationByEmail: al.cancellationByEmail ?? true,
    cancellationByWhatsapp: al.cancellationByWhatsapp ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const al = data.alerts || {}
    setForm({
      newBookingByEmail: al.newBookingByEmail ?? true,
      newBookingByWhatsapp: al.newBookingByWhatsapp ?? false,
      cancellationByEmail: al.cancellationByEmail ?? true,
      cancellationByWhatsapp: al.cancellationByWhatsapp ?? false,
    })
  }, [data])

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setSaved(false); setError('')
    try {
      await api.put('/settings/alerts', form)
      setSaved(true); onSaved()
    } catch (err) {
      setError(errMsg(err))
    }
    setLoading(false)
  }

  const Toggle = ({ field, label }) => (
    <label className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div onClick={() => setForm(f => ({ ...f, [field]: !f[field] }))}
        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${form[field] ? 'bg-navy-900' : 'bg-gray-200'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form[field] ? 'left-6' : 'left-1'}`} />
      </div>
    </label>
  )

  return (
    <Section title="Alertas de agendamento" desc="Receba avisos dos seus agendamentos." onSubmit={save} loading={loading} saved={saved} error={error}>
      <InfoBlock>
        <p className="font-semibold text-navy-900">Fique por dentro em tempo real</p>
        <p>Ative as notificações para saber imediatamente quando um cliente agenda ou cancela uma consulta. Os alertas por email são enviados para o endereço cadastrado na aba <span className="font-semibold">Conta</span>. Os alertas por WhatsApp são enviados para o número cadastrado na mesma aba.</p>
      </InfoBlock>
      <div className="bg-gray-50 rounded-xl px-4">
        <Toggle field="newBookingByEmail"      label="Novo agendamento por email" />
        <Toggle field="newBookingByWhatsapp"   label="Novo agendamento por WhatsApp" />
        <Toggle field="cancellationByEmail"    label="Cancelamento por email" />
        <Toggle field="cancellationByWhatsapp" label="Cancelamento por WhatsApp" />
      </div>
    </Section>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account')
  const [settingsData, setSettingsData] = useState(null)
  const [loadError, setLoadError] = useState('')

  const load = () => {
    setLoadError('')
    api.get('/settings')
      .then(r => setSettingsData(r.data))
      .catch(err => setLoadError(errMsg(err)))
  }

  useEffect(() => { load() }, [])

  if (loadError) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-96 gap-4">
      <p className="text-red-600 font-medium">{loadError}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-navy-900 text-white text-sm">Tentar novamente</button>
    </div>
  )

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

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === key ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'account'   && <AccountSection   data={settingsData} onSaved={load} />}
      {activeTab === 'office'    && <OfficeSection     data={settingsData} onSaved={load} />}
      {activeTab === 'scheduler' && <SchedulerSection  data={settingsData} onSaved={load} />}
      {activeTab === 'calendar'  && <CalendarSection   data={settingsData} onSaved={load} />}
      {activeTab === 'financial' && <FinancialSection  data={settingsData} />}
      {activeTab === 'alerts'    && <AlertsSection     data={settingsData} onSaved={load} />}
    </div>
  )
}
