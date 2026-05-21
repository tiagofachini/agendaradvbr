import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, isBefore, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { publicApi } from '../lib/api'

const STRIPE_PK = 'pk_test_51TW3uDLBWejVmCs0Qzc7sr8lJubkvwUepiMVnkRAncmp1MurhvMugJzCayPvpLRjup7MkLE2MnHNN2zFN5sdcyzG00XsYGrusQ'
const stripePromise = loadStripe(STRIPE_PK)

const STEPS = ['Horário', 'Seus dados', 'Seu problema', 'Pagamento', 'Confirmação']

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function maskPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function buildGoogleCalUrl({ date, slot, duration, lawyerName, specialty, location }) {
  const start = new Date(`${format(date, 'yyyy-MM-dd')}T${slot}:00-03:00`)
  const end = new Date(start.getTime() + duration * 60_000)
  const fmt = (d) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Consulta com ${lawyerName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Área: ${specialty}${location ? '\nLocal: ' + location : ''}`,
    location: location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function downloadICS({ date, slot, duration, lawyerName, specialty, location }) {
  const start = new Date(`${format(date, 'yyyy-MM-dd')}T${slot}:00-03:00`)
  const end = new Date(start.getTime() + duration * 60_000)
  const fmt = (d) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const uid = `${Date.now()}@agendaradv`
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgendarAdv//PT',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Consulta com ${lawyerName}`,
    `DESCRIPTION:Área: ${specialty}`,
    location ? `LOCATION:${location}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([lines], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'consulta-juridica.ics'
  a.click()
  URL.revokeObjectURL(url)
}

function Calendar({ workDays, selectedDate, onSelect, currentMonth, onMonthChange, brand1, brand2 }) {
  const today = startOfDay(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startPad = getDay(days[0])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: brand1 }}>‹</button>
        <span className="font-semibold capitalize" style={{ color: brand1 }}>
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: brand1 }}>›</button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const isWorkDay = workDays.includes(getDay(day))
          const isPast = isBefore(day, today)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const disabled = !isWorkDay || isPast
          return (
            <button key={day.toISOString()} disabled={disabled} onClick={() => onSelect(day)}
              className={[
                'h-9 w-full rounded-lg text-sm font-medium transition-colors',
                disabled ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-gray-100',
                !disabled && !isSelected ? 'text-gray-800' : '',
              ].join(' ')}
              style={
                isSelected ? { backgroundColor: brand1, color: '#fff' }
                : isToday(day) && !isSelected ? { border: `1px solid ${brand2}`, color: brand1 }
                : {}
              }>
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StripePaymentForm({ onSuccess, onError, consultaValor, brand1 }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true); setErr('')
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })
      if (error) {
        setErr(error.message || 'Erro ao processar pagamento.')
        onError?.(error.message)
      } else {
        onSuccess()
      }
    } catch (e) {
      setErr(e?.message || 'Erro ao inicializar pagamento. Tente recarregar a página.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="text-red-500 text-sm">{err}</p>}
      <button type="submit" disabled={!stripe || paying}
        className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-50 transition-colors"
        style={{ backgroundColor: brand1 }}>
        {paying ? 'Processando...' : `Pagar ${consultaValor ?? ''} →`}
      </button>
    </form>
  )
}

export default function Scheduler() {
  const { slug } = useParams()
  const [info, setInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [specialtyManual, setSpecialtyManual] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState('')
  const [detectingSpecialty, setDetectingSpecialty] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [pendingAppt, setPendingAppt] = useState(null)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const recognitionRef = useRef(null)

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientWhatsapp: '',
    specialty: '', description: '',
  })

  const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    publicApi.get(`/scheduler/${slug}`)
      .then((r) => setInfo(r.data))
      .catch(() => setNotFound(true))
  }, [slug])

  useEffect(() => {
    if (specialtyManual) return
    if (!form.description || form.description.length < 50) return

    setDetectingSpecialty(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await publicApi.post(`/scheduler/${slug}/detect`, {
          description: form.description,
        })
        if (data.specialty) setForm(f => ({ ...f, specialty: data.specialty }))
      } catch { /* silencia */ }
      finally { setDetectingSpecialty(false) }
    }, 800)

    return () => { clearTimeout(timer); setDetectingSpecialty(false) }
  }, [form.description, specialtyManual, slug])

  const loadSlots = useCallback(async (date) => {
    setLoadingSlots(true)
    setSelectedSlot(null)
    try {
      const { data } = await publicApi.get(`/scheduler/${slug}/slots?date=${format(date, 'yyyy-MM-dd')}`)
      setSlots(data.slots)
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [slug])

  const handleDateSelect = (date) => {
    setSelectedDate(date)
    loadSlots(date)
  }

  const updateForm = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const startListening = async () => {
    if (isListening) {
      try { recognitionRef.current?.stop() } catch {}
      setIsListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    setMicError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setMicError('Permissão de microfone negada. Habilite nas configurações do navegador.')
      return
    }

    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join(' ')
      setForm(f => ({ ...f, description: f.description ? f.description + ' ' + transcript : transcript }))
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e) => {
      setIsListening(false)
      const msgs = {
        'not-allowed':  'Permissão de microfone negada. Habilite nas configurações do navegador.',
        'no-speech':    'Nenhuma fala detectada. Tente novamente.',
        'audio-capture':'Microfone não encontrado ou indisponível.',
        'network':      'Erro de rede ao processar o áudio.',
      }
      setMicError(msgs[e.error] ?? `Erro ao usar microfone: ${e.error}`)
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }

  const handleFreeBook = async () => {
    setBooking(true); setError('')
    try {
      const specialty = form.specialty || 'Consultoria Jurídica Geral'
      const { data } = await publicApi.post(`/scheduler/${slug}/book`, {
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        clientWhatsapp: form.clientWhatsapp,
        specialty,
        description: form.description,
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedSlot,
      })
      setResult({ ...data, free: true, specialty })
      setStep(4)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar. Verifique os dados e tente novamente.')
    } finally {
      setBooking(false)
    }
  }

  const handleGoToPayment = async () => {
    setCreatingIntent(true); setError('')
    try {
      const specialty = form.specialty || 'Consultoria Jurídica Geral'
      const { data } = await publicApi.post('/stripe-connect/checkout', {
        slug,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        clientWhatsapp: form.clientWhatsapp,
        specialty,
        description: form.description,
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedSlot,
      })
      setClientSecret(data.clientSecret)
      setPendingAppt({ appointmentId: data.appointmentId, amount: data.amount, meetingLink: data.meetingLink })
      setForm(f => ({ ...f, specialty }))
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setCreatingIntent(false)
    }
  }

  const handlePaymentSuccess = () => {
    setResult({ ...pendingAppt, paid: true })
    setStep(4)
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Agendador não encontrado</h1>
        <p className="text-gray-500">O link que você acessou não existe ou foi desativado.</p>
      </div>
    </div>
  )

  if (!info) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse text-navy-900 font-medium">Carregando agendador...</div>
    </div>
  )

  const brand1 = /^#[0-9a-fA-F]{6}$/.test(info.brandColor1) ? info.brandColor1 : '#1a1a2e'
  const brand2 = /^#[0-9a-fA-F]{6}$/.test(info.brandColor2) ? info.brandColor2 : '#f5c842'

  const baseHourlyRate = info.hourlyRate ? parseFloat(info.hourlyRate) : null
  const specialtyRates = info.specialtyRates ?? []
  const matchedRate = specialtyRates.find(r => r.specialty === form.specialty)
  const effectiveRate = matchedRate ? parseFloat(String(matchedRate.rate)) : baseHourlyRate
  const consultaValor = effectiveRate
    ? `R$ ${((effectiveRate / 60) * (info.slotDuration ?? 60)).toFixed(2).replace('.', ',')}`
    : null

  const showPaymentStep = info.hasStripe && !!baseHourlyRate

  const addressParts = [
    info.street && info.number ? `${info.street}, ${info.number}` : info.street,
    info.city && info.state ? `${info.city}/${info.state}` : info.city,
  ].filter(Boolean)
  const address = addressParts.join(' — ')

  const confirmationLocation = (result?.meetingLink || pendingAppt?.meetingLink) || address || null
  const confirmationSpecialty = result?.specialty || form.specialty || 'Consultoria Jurídica Geral'

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="px-6 py-8 text-center" style={{ backgroundColor: brand1 }}>
        {info.logoUrl && (
          <img src={info.logoUrl} alt="logo" className="h-16 w-16 mx-auto mb-4 rounded-full object-cover bg-white p-1 shadow-md ring-2 ring-white/20" />
        )}
        <h1 className="text-white text-2xl font-bold">{info.lawyerName}</h1>

        {info.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-3">
            {info.specialties.slice(0, 4).map(s => (
              <span key={s} className="bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full">{s}</span>
            ))}
            {info.specialties.length > 4 && (
              <span className="bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full">
                +{info.specialties.length - 4} áreas
              </span>
            )}
          </div>
        )}

        {addressParts.length > 0 && (
          <p className="text-gray-300 text-sm mt-2">📍 {address}</p>
        )}

        {info.highlightMessage && (
          <p className="text-brand-400 text-sm mt-2 max-w-xs mx-auto">{info.highlightMessage}</p>
        )}
        {showPaymentStep && (
          <p className="text-gray-300 text-sm mt-1">
            Consulta de {info.slotDuration} min — {consultaValor}
          </p>
        )}
      </div>

      <div className="bg-white border-b px-4 py-3 overflow-x-auto">
        <div className="flex items-center justify-center gap-0 min-w-max mx-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-1.5 ${i <= step ? '' : 'text-gray-300'}`}
                style={i <= step ? { color: brand1 } : {}}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={
                    i < step ? { backgroundColor: brand1, color: '#fff', border: 'none' }
                    : i === step ? { border: `2px solid ${brand1}`, color: brand1 }
                    : { border: '2px solid #e5e7eb', color: '#d1d5db' }
                  }>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block whitespace-nowrap">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 h-0.5 mx-1.5"
                  style={{ backgroundColor: i < step ? brand1 : '#e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">

        {step === 0 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <p className="font-semibold text-navy-900 mb-2">Como funciona?</p>
              <ol className="space-y-1.5 text-sm text-gray-600">
                <li className="flex gap-2"><span className="font-bold text-navy-900">1.</span> Escolha o dia e horário disponível</li>
                <li className="flex gap-2"><span className="font-bold text-navy-900">2.</span> Informe seus dados de contato</li>
                <li className="flex gap-2"><span className="font-bold text-navy-900">3.</span> Descreva brevemente o seu caso</li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy-900">4.</span>
                  {showPaymentStep
                    ? `Finalize o pagamento de ${consultaValor} para garantir o horário`
                    : 'Confirme o agendamento (pagamento acordado com o advogado)'}
                </li>
                <li className="flex gap-2"><span className="font-bold text-navy-900">5.</span> Receba a confirmação com todos os detalhes</li>
              </ol>
              {showPaymentStep && (
                <p className="mt-3 text-xs text-blue-700 font-medium">
                  O pagamento é processado com segurança via Stripe. Aceitamos cartão e PIX.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-bold text-navy-900 mb-5 text-lg">Escolha a data e o horário</h2>
              <Calendar workDays={info.workDays} selectedDate={selectedDate} onSelect={handleDateSelect}
                currentMonth={currentMonth} onMonthChange={setCurrentMonth} brand1={brand1} brand2={brand2} />
              {selectedDate && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Horários disponíveis — {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  {loadingSlots ? (
                    <div className="text-center text-sm text-gray-400 py-4">Carregando horários...</div>
                  ) : slots.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-4">Nenhum horário disponível nesta data.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <button key={slot} onClick={() => setSelectedSlot(slot)}
                          className="py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors"
                          style={selectedSlot === slot
                            ? { backgroundColor: brand1, borderColor: brand1, color: '#fff' }
                            : {}}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button disabled={!selectedDate || !selectedSlot} onClick={() => setStep(1)}
                className="mt-6 w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-40 transition-colors"
                style={{ backgroundColor: brand1 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Seus dados</h2>
            <p className="text-sm text-gray-500 mb-5">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedSlot}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input name="clientName" value={form.clientName} onChange={updateForm} required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="Seu nome completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input name="clientEmail" type="email" value={form.clientEmail} onChange={updateForm} required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="seu@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input name="clientWhatsapp" value={form.clientWhatsapp}
                  onChange={e => setForm(f => ({ ...f, clientWhatsapp: maskPhone(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">← Voltar</button>
              <button disabled={!form.clientName || !form.clientEmail} onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-40 transition-colors"
                style={{ backgroundColor: brand1 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Descreva seu caso</h2>
            <p className="text-sm text-gray-500 mb-5">
              Uma descrição breve ajuda o advogado a se preparar. A área do direito será identificada automaticamente.
            </p>
            <textarea name="description" value={form.description} onChange={updateForm} rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 resize-none"
              placeholder="Ex: Fui demitido sem justa causa e não recebi todas as verbas rescisórias. Trabalhei 3 anos na empresa..." />

            {detectingSpecialty && (
              <p className="mt-2 text-xs text-gray-400 animate-pulse">Identificando área jurídica...</p>
            )}
            {!detectingSpecialty && form.specialty && !specialtyManual && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>Área: <span className="font-semibold text-navy-700">{form.specialty}</span></span>
                <button type="button" onClick={() => setSpecialtyManual(true)}
                  className="underline hover:text-navy-900 transition-colors">alterar</button>
              </div>
            )}
            {specialtyManual && (
              <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                placeholder="Área do direito..." />
            )}

            {hasSpeechAPI && (
              <button type="button" onClick={startListening}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors
                  ${isListening ? 'border-red-400 text-red-500 bg-red-50 animate-pulse' : 'border-gray-200 text-gray-600 hover:border-navy-900'}`}>
                <span>{isListening ? '⏹ Parar gravação' : '🎤 Falar o problema'}</span>
              </button>
            )}
            {micError && <p className="mt-2 text-xs text-red-500">{micError}</p>}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">← Voltar</button>
              <button
                onClick={showPaymentStep ? handleGoToPayment : () => setStep(3)}
                disabled={creatingIntent || detectingSpecialty || !form.description}
                className="flex-1 py-3 rounded-xl font-bold disabled:opacity-50 transition-colors"
                style={{ backgroundColor: brand2, color: brand1 }}>
                {creatingIntent ? 'Aguarde...' : 'Continuar →'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          </div>
        )}

        {step === 3 && showPaymentStep && clientSecret && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Pagamento</h2>
            {consultaValor && (
              <p className="text-sm text-gray-500 mb-5">
                Valor da consulta: <span className="font-semibold text-navy-900">{consultaValor}</span>
              </p>
            )}
            <Elements stripe={stripePromise} options={{ clientSecret, locale: 'pt-BR' }}>
              <StripePaymentForm
                onSuccess={handlePaymentSuccess}
                onError={setError}
                consultaValor={consultaValor}
                brand1={brand1}
              />
            </Elements>
            <button onClick={() => { setStep(2); setClientSecret(null); setPendingAppt(null) }}
              className="mt-4 w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-medium text-sm">
              ← Voltar
            </button>
          </div>
        )}

        {step === 3 && !showPaymentStep && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Pagamento</h2>
            <p className="text-sm text-gray-500 mb-5">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedSlot} com {info.lawyerName}
            </p>

            {consultaValor && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Valor estimado da consulta</span>
                <span className="text-xl font-bold text-navy-900">{consultaValor}</span>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <p className="text-amber-800 text-sm font-medium">
                💬 O advogado realizará a cobrança diretamente após a consulta.
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Você receberá um email com os detalhes do agendamento.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">← Voltar</button>
              <button onClick={handleFreeBook} disabled={booking}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50 transition-colors"
                style={{ backgroundColor: brand1 }}>
                {booking ? 'Aguarde...' : 'Confirmar →'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">✅</div>
                {result.paid ? (
                  <>
                    <h2 className="text-xl font-bold text-navy-900">Pagamento confirmado!</h2>
                    <p className="text-gray-500 text-sm mt-1">Seu agendamento está garantido.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-navy-900">Agendamento confirmado!</h2>
                    <p className="text-gray-500 text-sm mt-1">Você receberá um email de confirmação em breve.</p>
                  </>
                )}
              </div>

              {result.paid ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center mb-5">
                  <p className="text-green-700 font-semibold text-sm">✓ Pagamento aprovado e horário garantido!</p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center mb-5">
                  <p className="text-green-700 font-semibold text-sm">✓ Agendamento registrado</p>
                  <p className="text-green-600 text-xs mt-1">Você e o advogado receberão um email com os detalhes.</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Data</span>
                  <span className="font-semibold text-navy-900 capitalize">
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Horário</span>
                  <span className="font-semibold text-navy-900">{selectedSlot}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Advogado</span>
                  <span className="font-semibold text-navy-900">{info.lawyerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Área</span>
                  <span className="font-semibold text-navy-900">{confirmationSpecialty}</span>
                </div>
                {(result.meetingLink || pendingAppt?.meetingLink) && (
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2.5 mt-1">
                    <span className="text-gray-500">Reunião online</span>
                    <a href={result.meetingLink || pendingAppt?.meetingLink} target="_blank" rel="noopener noreferrer"
                      className="font-semibold text-blue-600 hover:underline text-right max-w-[60%] break-all">
                      Abrir link →
                    </a>
                  </div>
                )}
                {!(result.meetingLink || pendingAppt?.meetingLink) && address && (
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2.5 mt-1">
                    <span className="text-gray-500">Local</span>
                    <span className="font-semibold text-navy-900 text-right max-w-[60%]">{address}</span>
                  </div>
                )}
                {consultaValor && result.paid && (
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2.5 mt-1">
                    <span className="text-gray-500">Valor pago</span>
                    <span className="font-bold text-navy-900">{consultaValor}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="font-semibold text-navy-900 mb-4 text-sm">Salvar na agenda</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <a
                    href={buildGoogleCalUrl({
                      date: selectedDate,
                      slot: selectedSlot,
                      duration: info.slotDuration ?? 60,
                      lawyerName: info.lawyerName,
                      specialty: confirmationSpecialty,
                      location: confirmationLocation,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm text-center hover:border-gray-400 transition-colors">
                    📅 Google Calendar
                  </a>
                  <button
                    onClick={() => downloadICS({
                      date: selectedDate,
                      slot: selectedSlot,
                      duration: info.slotDuration ?? 60,
                      lawyerName: info.lawyerName,
                      specialty: confirmationSpecialty,
                      location: confirmationLocation,
                    })}
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm hover:border-gray-400 transition-colors">
                    📥 Baixar .ics
                  </button>
                </div>
                {form.clientWhatsapp && (
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `📅 Lembrete: minha consulta jurídica com ${info.lawyerName}\n` +
                      `Data: ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às ${selectedSlot}\n` +
                      `Área: ${confirmationSpecialty}` +
                      (confirmationLocation ? `\nLocal/Link: ${confirmationLocation}` : '')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl font-medium text-sm text-center flex items-center justify-center gap-2 border-2 border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Salvar lembrete no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
