import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, isBefore, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { publicApi } from '../lib/api'
import { LEGAL_SPECIALTIES } from '../lib/specialties'

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STEPS = ['Horário', 'Dados', 'Problema']

function maskPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ── Calendário ────────────────────────────────────────────────────────────────
function Calendar({ workDays, selectedDate, onSelect, currentMonth, onMonthChange }) {
  const today = startOfDay(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startPad = getDay(days[0])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-navy-900">‹</button>
        <span className="font-semibold text-navy-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-navy-900">›</button>
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
                disabled ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-navy-50',
                isSelected ? 'bg-navy-900 text-white hover:bg-navy-800' : '',
                isToday(day) && !isSelected ? 'border border-brand-500 text-navy-900' : '',
                !disabled && !isSelected ? 'text-gray-800' : '',
              ].join(' ')}>
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
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
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [specialtyManual, setSpecialtyManual] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState('')
  const [detectingSpecialty, setDetectingSpecialty] = useState(false)
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
      } catch { /* silencia — usuário pode selecionar manualmente */ }
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

  const startListening = () => {
    if (isListening) {
      try { recognitionRef.current?.stop() } catch {}
      setIsListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    setMicError('')
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

  const handleBook = async () => {
    const specialty = form.specialty || 'Consultoria Jurídica Geral'
    setBooking(true); setError('')
    try {
      const { data } = await publicApi.post(`/scheduler/${slug}/book`, {
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        clientWhatsapp: form.clientWhatsapp,
        specialty,
        description: form.description,
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedSlot,
      })
      setForm(f => ({ ...f, specialty }))
      setResult(data)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar agendamento. Tente novamente.')
    } finally {
      setBooking(false)
    }
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

  const consultaValor = info.hourlyRate
    ? `R$ ${((parseFloat(info.hourlyRate) / 60) * (info.slotDuration ?? 60)).toFixed(2).replace('.', ',')}`
    : null

  const addressParts = [
    info.street && info.number ? `${info.street}, ${info.number}` : info.street,
    info.city && info.state ? `${info.city}/${info.state}` : info.city,
  ].filter(Boolean)
  const address = addressParts.join(' — ')

  const filteredSpecialties = LEGAL_SPECIALTIES.filter((s) =>
    s.toLowerCase().includes(specialtySearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-navy-900 px-6 py-8 text-center">
        {info.logoUrl && (
          <img src={info.logoUrl} alt="logo" className="h-16 mx-auto mb-4 rounded-xl object-contain bg-white/10 p-1" />
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
        {consultaValor && (
          <p className="text-gray-300 text-sm mt-1">
            Consulta de {info.slotDuration} min — {consultaValor}
          </p>
        )}
      </div>

      {/* ── Steps indicator ── */}
      {step < 3 && (
        <div className="bg-white border-b px-6 py-3">
          <div className="flex items-center justify-center gap-0 max-w-sm mx-auto">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-navy-900' : 'text-gray-300'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${i < step ? 'bg-navy-900 text-white' : i === step ? 'border-2 border-navy-900 text-navy-900' : 'border-2 border-gray-200 text-gray-300'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-navy-900' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6">

        {/* ── Step 0 ── */}
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
                  {info.hasAsaas && consultaValor
                    ? `Finalize o pagamento de ${consultaValor} para confirmar a consulta`
                    : 'Confirme o agendamento'}
                </li>
              </ol>
              {info.hasAsaas && consultaValor && (
                <p className="mt-3 text-xs text-blue-700 font-medium">
                  O pagamento é necessário para garantir o seu horário.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-bold text-navy-900 mb-5 text-lg">Escolha a data e o horário</h2>
              <Calendar workDays={info.workDays} selectedDate={selectedDate} onSelect={handleDateSelect}
                currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
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
                          className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors
                            ${selectedSlot === slot ? 'bg-navy-900 border-navy-900 text-white' : 'border-gray-200 text-navy-900 hover:border-navy-900'}`}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button disabled={!selectedDate || !selectedSlot} onClick={() => setStep(1)}
                className="mt-6 w-full py-3.5 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-40 hover:bg-navy-800 transition-colors">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1 ── */}
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
                className="flex-1 py-3 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-40 hover:bg-navy-800 transition-colors">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Descreva seu caso</h2>
            <p className="text-sm text-gray-500 mb-5">
              Uma descrição breve ajuda o advogado a se preparar. A área do direito será identificada automaticamente.
            </p>
            <textarea name="description" value={form.description} onChange={updateForm} rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 resize-none"
              placeholder="Ex: Fui demitido sem justa causa e não recebi todas as verbas rescisórias. Trabalhei 3 anos na empresa..." />

            {hasSpeechAPI && (
              <button type="button" onClick={startListening}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors
                  ${isListening ? 'border-red-400 text-red-500 bg-red-50 animate-pulse' : 'border-gray-200 text-gray-600 hover:border-navy-900'}`}>
                <span>{isListening ? '⏹ Parar gravação' : '🎤 Falar o problema'}</span>
              </button>
            )}
            {micError && <p className="mt-2 text-xs text-red-500">{micError}</p>}

            {detectingSpecialty && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-500 animate-pulse">Identificando área jurídica...</p>
              </div>
            )}

            {!detectingSpecialty && form.specialty && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Área identificada:</p>
                  <p className="text-sm font-semibold text-navy-900">{form.specialty}</p>
                </div>
                <button onClick={() => { setForm(f => ({ ...f, specialty: '' })); setSpecialtyManual(true) }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-3">Alterar</button>
              </div>
            )}

            {!detectingSpecialty && !form.specialty && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1.5">Selecione a área manualmente:</p>
                <input value={specialtySearch}
                  onChange={(e) => { setSpecialtySearch(e.target.value); setForm(f => ({ ...f, specialty: '' })) }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="Pesquise a área do direito..." />
                {specialtySearch && (
                  <div className="border border-gray-200 rounded-xl mt-1 max-h-40 overflow-y-auto shadow-sm">
                    {filteredSpecialties.map((s) => (
                      <button key={s} onClick={() => { setForm(f => ({ ...f, specialty: s })); setSpecialtySearch(s); setSpecialtyManual(true) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">← Voltar</button>
              <button onClick={handleBook} disabled={booking || (!form.description && !form.specialty)}
                className="flex-1 py-3 rounded-xl bg-brand-500 text-navy-900 font-bold disabled:opacity-50 hover:bg-brand-400 transition-colors">
                {booking ? 'Aguarde...' : 'Confirmar →'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && result && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{result.paymentUrl ? '💳' : '✅'}</div>
              <h2 className="text-xl font-bold text-navy-900">
                {result.paymentUrl ? 'Quase lá! Finalize o pagamento' : 'Agendamento confirmado!'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {result.paymentUrl
                  ? 'Realize o pagamento abaixo para garantir seu horário.'
                  : 'Você receberá um email de confirmação em breve.'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 mb-6">
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
                <span className="font-semibold text-navy-900">{form.specialty}</span>
              </div>
              {address && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Local</span>
                  <span className="font-semibold text-navy-900 text-right max-w-[60%]">{address}</span>
                </div>
              )}
              {consultaValor && (
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2.5 mt-1">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-bold text-navy-900">{consultaValor}</span>
                </div>
              )}
            </div>

            {result.paymentUrl ? (
              <a href={result.paymentUrl} target="_blank" rel="noopener noreferrer"
                className="block w-full py-4 rounded-xl bg-navy-900 text-white font-bold text-center text-lg hover:bg-navy-800 transition-colors">
                Pagar agora →
              </a>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                <p className="text-green-700 font-semibold text-sm">✓ Agendamento confirmado sem cobrança neste momento</p>
                <p className="text-green-600 text-xs mt-1">Você e o advogado receberão um email com os detalhes.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
