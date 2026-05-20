import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import { LEGAL_SPECIALTIES } from '../lib/specialties'

const TABS = [
  { key: 'google',    label: '🔗 Google' },
  { key: 'profile',   label: '🏢 Perfil' },
  { key: 'scheduler', label: '📋 Agendador' },
  { key: 'calendar',  label: '📅 Agenda' },
  { key: 'financial', label: '💳 Financeiro' },
  { key: 'alerts',    label: '🔔 Alertas' },
]

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

function ProfileSection({ data, onSaved }) {
  const { lawyer, logout } = useAuth()
  const navigate = useNavigate()
  const a = data.account || {}
  const o = data.office || {}
  const [form, setForm] = useState({
    name: a.name || '', email: a.email || '', whatsapp: a.whatsapp || '',
    logoUrl: o.logoUrl || '', brandColor1: o.brandColor1 || '', brandColor2: o.brandColor2 || '',
    cep: o.cep || '', street: o.street || '', number: o.number || '',
    complement: o.complement || '', neighborhood: o.neighborhood || '',
    city: o.city || '', state: o.state || '',
    specialties: o.specialties || [],
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [specSearch, setSpecSearch] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const a = data.account || {}
    const o = data.office || {}
    setForm({
      name: a.name || '', email: a.email || '', whatsapp: a.whatsapp || '',
      logoUrl: o.logoUrl || '', brandColor1: o.brandColor1 || '', brandColor2: o.brandColor2 || '',
      cep: o.cep || '', street: o.street || '', number: o.number || '',
      complement: o.complement || '', neighborhood: o.neighborhood || '',
      city: o.city || '', state: o.state || '',
      specialties: o.specialties || [],
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
      await Promise.all([
        api.put('/settings/account', { name: form.name, email: form.email, whatsapp: form.whatsapp }),
        api.put('/settings/office', {
          logoUrl: form.logoUrl, brandColor1: form.brandColor1, brandColor2: form.brandColor2,
          cep: form.cep, street: form.street, number: form.number, complement: form.complement,
          neighborhood: form.neighborhood, city: form.city, state: form.state,
          specialties: form.specialties,
        }),
      ])
      setSaved(true); onSaved()
    } catch (err) {
      setError(errMsg(err))
    }
    setLoading(false)
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm(
      'Excluir permanentemente sua conta?\n\nTodos os seus dados, clientes, compromissos e configurações serão apagados. Esta ação não pode ser desfeita.'
    )) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await api.delete('/settings/account')
      logout()
      navigate('/')
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Erro ao excluir conta')
      setDeleteLoading(false)
    }
  }

  return (
    <>
    <Section title="Perfil do escritório" desc="Sua vitrine pública e dados internos." onSubmit={save} loading={loading} saved={saved} error={error}>

      {/* Identidade visual */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/40">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identidade visual</p>
        <Field label="Logo do escritório">
          <LogoUpload currentUrl={form.logoUrl} lawyerId={lawyer?.id} onChange={url => setForm(f => ({ ...f, logoUrl: url }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker label="Cor principal" value={form.brandColor1} onChange={v => setForm(f => ({ ...f, brandColor1: v }))} />
          <ColorPicker label="Cor de destaque" value={form.brandColor2} onChange={v => setForm(f => ({ ...f, brandColor2: v }))} />
        </div>
        <p className="text-xs text-gray-400">Estas cores e a logo aparecem na sua página pública de agendamento.</p>
      </div>

      {/* Endereço do escritório */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/40">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Endereço do escritório</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CEP">
            <div className="flex gap-2">
              <input className={inputCls} value={form.cep}
                onChange={e => setForm({ ...form, cep: e.target.value })}
                onBlur={lookupCep} placeholder="00000-000" />
              {cepLoading && <span className="text-xs text-gray-400 self-center">Buscando...</span>}
            </div>
          </Field>
          <Field label="Estado">
            <input className={inputCls} value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SP" />
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
        <p className="text-xs text-gray-400">O endereço é exibido no agendador apenas como local da consulta presencial — nunca como forma de contato direto.</p>
      </div>

      {/* Dados do responsável */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dados do responsável</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">uso interno</span>
        </div>
        <InfoBlock>
          <p>Email e WhatsApp são usados exclusivamente para login e alertas internos. <strong>Não são exibidos</strong> no agendador público — clientes só conseguem contato via agendamento.</p>
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
      </div>

      {/* Especialidades */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/40">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Especialidades</p>
        <Field label="Áreas de atuação (até 5)">
          <div className="flex items-center justify-between mb-2">
            <input className={inputCls + ' flex-1 mr-3'} placeholder="Buscar especialidade..."
              value={specSearch} onChange={e => setSpecSearch(e.target.value)} />
            <span className={`text-xs font-medium flex-shrink-0 ${form.specialties.length >= 5 ? 'text-red-500' : 'text-gray-400'}`}>
              {form.specialties.length}/5
            </span>
          </div>
          {form.specialties.length >= 5 && (
            <p className="text-xs text-red-500 mb-2">Limite atingido. Remova uma para adicionar outra.</p>
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
          <p className="text-xs text-gray-400 mt-2">Selecione apenas as especialidades que você realmente atende — aparecem no seu agendador público.</p>
        </Field>
      </div>

    </Section>

    <div className="bg-white rounded-2xl shadow-sm p-6 mb-5 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">Excluir conta</p>
          <p className="text-xs text-gray-300 mt-0.5">Remove permanentemente todos os seus dados da plataforma.</p>
        </div>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleteLoading}
          className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          {deleteLoading ? 'Excluindo...' : 'Excluir minha conta'}
        </button>
      </div>
      {deleteError && (
        <p className="mt-3 text-xs text-red-500">{deleteError}</p>
      )}
    </div>
    </>
  )
}

const GOOGLE_BENEFITS = [
  {
    icon: '🔑',
    title: 'Login unificado',
    desc: 'Entre no sistema com um clique usando sua conta Google. Sem senhas para criar ou lembrar — segurança máxima com a autenticação do Google.',
  },
  {
    icon: '📅',
    title: 'Google Agenda',
    desc: 'Todos os compromissos agendados pelo sistema aparecem automaticamente na sua Google Agenda. Nunca perca um horário.',
  },
  {
    icon: '🎥',
    title: 'Google Meet automático',
    desc: 'Um link de videochamada exclusivo é gerado para cada consulta online. Seu cliente recebe o link por email na confirmação.',
  },
]

function GoogleIntegrationSection({ data, onSaved, banner }) {
  const sc = data.scheduler || {}
  const isConnected = sc.googleCalendarConnected || false
  const [gcLoading, setGcLoading] = useState(false)

  const handleConnect = async () => {
    setGcLoading(true)
    try {
      const { data: res } = await api.post('/google-calendar/auth-url')
      if (res.url) window.location.href = res.url
    } catch {
      setGcLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Desconectar a integração com Google? Novos agendamentos não gerarão links Meet automáticos.')) return
    setGcLoading(true)
    try {
      await api.post('/google-calendar/disconnect')
      onSaved()
    } catch { /* noop */ }
    setGcLoading(false)
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 text-sm ${banner.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${banner.startsWith('✓') ? 'bg-green-500' : 'bg-red-500'}`} />
          <p className="font-medium">{banner}</p>
        </div>
      )}

      {/* Hero */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div>
            <h3 className="font-bold text-lg leading-tight">Integração com Google</h3>
            <p className="text-gray-400 text-sm">A configuração mais importante do sistema</p>
          </div>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed mt-3">
          Conectar sua conta Google transforma o AgendarAdv em uma ferramenta completa: login seguro, agenda sincronizada automaticamente e links de videochamada gerados para cada consulta online — tudo sem configuração adicional.
        </p>
      </div>

      {/* Benefícios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {GOOGLE_BENEFITS.map((b) => (
          <div key={b.title} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="text-3xl mb-3">{b.icon}</div>
            <h4 className="font-bold text-navy-900 text-sm mb-1.5">{b.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* Status e ação */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800 text-sm">Conta Google conectada e ativa</p>
                <p className="text-xs text-green-600 mt-0.5">Login, agenda e links Meet estão funcionando automaticamente.</p>
              </div>
            </div>
            <div className="space-y-2">
              {['Agendamentos sincronizados com Google Agenda', 'Links Google Meet gerados automaticamente', 'Login disponível via Google'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 font-bold flex-shrink-0">✓</span> {item}
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <button onClick={handleDisconnect} disabled={gcLoading}
                className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors">
                {gcLoading ? 'Desconectando...' : 'Desconectar conta Google'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="w-3 h-3 bg-amber-400 rounded-full flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">Conta Google não conectada — benefícios limitados</p>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Sem a integração, os agendamentos não aparecem na sua Google Agenda e não há links de videochamada automáticos. Conecte agora em menos de um minuto.
            </p>
            <button onClick={handleConnect} disabled={gcLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50">
              {gcLoading ? (
                <span>Redirecionando para o Google...</span>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Conectar com Google
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Detects Brazilian phone number patterns: (XX) XXXXX-XXXX, +55..., 8+ consecutive digits
const PHONE_RE = /(\+?55[\s-]?)?(\(?\d{2}\)?\s?)(\d{4,5}[-\s]?\d{4})|\d{8,}/g

function stripPhoneNumbers(text) {
  return text.replace(PHONE_RE, '').replace(/\s{2,}/g, ' ').trim()
}

function hasPhoneNumber(text) {
  return PHONE_RE.test(text)
}

function SchedulerSection({ data, onSaved, banner, onGoToGoogle }) {
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
  const [phoneStripped, setPhoneStripped] = useState(false)

  useEffect(() => {
    const sc = data.scheduler || {}
    setForm({
      schedulerSlug: sc.schedulerSlug || '',
      slotDuration: sc.slotDuration || 60,
      highlightMessage: sc.highlightMessage || '',
      customMeetingUrl: sc.customMeetingUrl || '',
    })
  }, [data])

  const handleHighlightChange = (e) => {
    PHONE_RE.lastIndex = 0
    const raw = e.target.value
    if (hasPhoneNumber(raw)) {
      PHONE_RE.lastIndex = 0
      setForm(f => ({ ...f, highlightMessage: stripPhoneNumbers(raw) }))
      setPhoneStripped(true)
    } else {
      setForm(f => ({ ...f, highlightMessage: raw }))
      setPhoneStripped(false)
    }
  }

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
      {banner && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 text-sm ${banner.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${banner.startsWith('✓') ? 'bg-green-500' : 'bg-blue-500'}`} />
          <p className="font-medium">{banner}</p>
        </div>
      )}
      <InfoBlock>
        <p className="font-semibold text-navy-900">O que é o endereço de agendamento?</p>
        <p>É o link exclusivo que você compartilha com seus clientes para que eles agendem uma consulta diretamente com você — sem intermediários, sem telefonemas. O cliente acessa, escolhe o horário disponível e confirma em poucos cliques.</p>
        <p>O endereço fica no formato <span className="font-semibold text-navy-900">agendar.adv.br/seu-nome</span>. Divulgue no Instagram, no WhatsApp, no cartão de visitas ou na assinatura do seu email.</p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-navy-700 border-t border-blue-100 pt-2 mt-1">
          <span>🔒</span> O agendador <strong>não exibe</strong> nenhum telefone, email ou WhatsApp do advogado. Clientes só conseguem contato ao completar o agendamento.
        </p>
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
          onChange={handleHighlightChange}
          placeholder="Ex: Primeira consulta com desconto!" />
        {phoneStripped && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <span>⚠</span> Números de telefone não são permitidos neste campo.
          </p>
        )}
      </Field>
      <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reunião online</p>
          {sc.googleCalendarConnected ? (
            <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">✓ Google Meet ativo</span>
          ) : (
            <button type="button" onClick={onGoToGoogle}
              className="text-xs font-medium text-navy-700 hover:underline">
              Configurar integração Google →
            </button>
          )}
        </div>
        {!sc.googleCalendarConnected && (
          <Field label="Link fixo de reunião (Google Meet, Zoom, Teams…)">
            <input className={inputCls} value={form.customMeetingUrl}
              onChange={e => setForm({ ...form, customMeetingUrl: e.target.value })}
              placeholder="https://meet.google.com/xxx-yyyy-zzz" />
            <p className="text-xs text-gray-400 mt-1.5">
              Usado quando não há endereço físico configurado. Conecte o Google para gerar links automáticos.
            </p>
          </Field>
        )}
      </div>
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

function FinancialSection({ data, banner }) {
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
      {banner && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 text-sm ${banner.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${banner.startsWith('✓') ? 'bg-green-500' : 'bg-blue-500'}`} />
          <p className="font-medium">{banner}</p>
        </div>
      )}
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
        <p>Ative as notificações para saber imediatamente quando um cliente agenda ou cancela uma consulta. Os alertas por email e WhatsApp são enviados para os dados cadastrados na aba <span className="font-semibold">Perfil</span>.</p>
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
  const [activeTab, setActiveTab] = useState('google')
  const [settingsData, setSettingsData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [stripeBanner, setStripeBanner] = useState('')
  const [calendarBanner, setCalendarBanner] = useState('')

  const load = () => {
    setLoadError('')
    api.get('/settings')
      .then(r => setSettingsData(r.data))
      .catch(err => setLoadError(errMsg(err)))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stripe = params.get('stripe')
    const calendar = params.get('calendar')
    const calendarReason = params.get('reason')
    const calendarDetail = params.get('detail')
    window.history.replaceState({}, '', '/settings')

    if (stripe === 'success') {
      setActiveTab('financial')
      setStripeBanner('Cadastro recebido! Sincronizando status da sua conta Stripe...')
      api.post('/stripe-connect/sync')
        .then(({ data }) => {
          if (data.stripeChargesEnabled) {
            setStripeBanner('✓ Conta Stripe conectada e ativa! Você já pode receber pagamentos.')
          } else {
            setStripeBanner('Cadastro enviado. A Stripe pode levar alguns minutos para verificar sua conta.')
          }
          load()
        })
        .catch(load)
    } else if (stripe === 'refresh') {
      setActiveTab('financial')
      setStripeBanner('O link de cadastro expirou. Clique em "Continuar cadastro" para tentar novamente.')
      load()
    } else if (calendar === 'success') {
      setActiveTab('google')
      setCalendarBanner('✓ Google Calendar conectado! Novos agendamentos gerarão links Google Meet automaticamente.')
      load()
    } else if (calendar === 'error') {
      setActiveTab('google')
      const reasonMsg = calendarReason ? ` [${calendarReason}${calendarDetail ? ': ' + calendarDetail : ''}]` : ''
      setCalendarBanner(`Erro ao conectar Google Calendar.${reasonMsg} Tente desconectar e reconectar.`)
      load()
    } else {
      load()
    }
  }, [])

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
        {TABS.map(({ key, label }) => {
          const isGoogle = key === 'google'
          const googleNotConnected = isGoogle && !(settingsData?.scheduler?.googleCalendarConnected)
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap relative
                ${activeTab === key ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
              {googleNotConnected && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'google'    && <GoogleIntegrationSection data={settingsData} onSaved={load} banner={calendarBanner} />}
      {activeTab === 'profile'   && <ProfileSection    data={settingsData} onSaved={load} />}
      {activeTab === 'scheduler' && <SchedulerSection  data={settingsData} onSaved={load} banner={calendarBanner} onGoToGoogle={() => setActiveTab('google')} />}
      {activeTab === 'calendar'  && <CalendarSection   data={settingsData} onSaved={load} />}
      {activeTab === 'financial' && <FinancialSection  data={settingsData} banner={stripeBanner} />}
      {activeTab === 'alerts'    && <AlertsSection     data={settingsData} onSaved={load} />}
    </div>
  )
}
