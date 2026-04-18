import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, isBefore, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import api from '../lib/api'
import { LEGAL_SPECIALTIES } from '../lib/specialties'

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STEPS = ['Horário', 'Seus dados', 'Problema', 'Pagamento']

// ── Calendário ────────────────────────────────────────────────────────────────
function Calendar({ workDays, selectedDate, onSelect, currentMonth, onMonthChange }) {
  const today = startOfDay(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startPad = getDay(days[0]) // padding para alinhar semana

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
            <button
              key={day.toISOString()}
              disabled={disabled}
              onClick={() => onSelect(day)}
              className={[
                'h-9 w-full rounded-lg text-sm font-medium transition-colors',
                disabled ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-navy-50',
                isSelected ? 'bg-navy-900 text-white hover:bg-navy-800' : '',
                isToday(day) && !isSelected ? 'border border-gold-500 text-navy-900' : '',
                !disabled && !isSelected ? 'text-gray-800' : '',
              ].join(' ')}
            >
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
  const [result, setResult] = useState(null) // { appointmentId, paymentUrl }
  const [error, setError] = useState('')
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [isListening, setIsListening] = useState(false)

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientWhatsapp: '',
    specialty: '', description: '',
  })

  // Carrega info do agendador
  useEffect(() => {
    api.get(`/scheduler/${slug}`)
      .then((r) => setInfo(r.data))
      .catch(() => setNotFound(true))
  }, [slug])

  // Carrega slots ao selecionar data
  const loadSlots = useCallback(async (date) => {
    setLoadingSlots(true)
    setSelectedSlot(null)
    try {
      const { data } = await api.get(`/scheduler/${slug}/slots?date=${format(date, 'yyyy-MM-dd')}`)
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

  // Speech-to-text
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false
    setIsListening(true)
    recognition.start()
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setForm((f) => ({ ...f, description: f.description ? f.description + ' ' + transcript : transcript }))
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
  }

  const handleBook = async () => {
    setBooking(true); setError('')
    try {
      const { data } = await api.post(`/scheduler/${slug}/book`, {
        ...form,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedSlot,
      })
      setResult(data)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar agendamento')
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

  const filteredSpecialties = LEGAL_SPECIALTIES.filter((s) =>
    s.toLowerCase().includes(specialtySearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-900 px-6 py-8 text-center">
        {info.logoUrl && <img src={info.logoUrl} alt="logo" className="h-12 mx-auto mb-3 rounded" />}
        <h1 className="text-white text-2xl font-bold">{info.lawyerName}</h1>
        {info.highlightMessage && (
          <p className="text-gold-400 text-sm mt-2 max-w-xs mx-auto">{info.highlightMessage}</p>
        )}
        {info.hourlyRate && (
          <p className="text-gray-300 text-sm mt-1">
            Consulta de {info.slotDuration} min — R$ {((info.hourlyRate / 60) * info.slotDuration).toFixed(2).replace('.', ',')}
          </p>
        )}
      </div>

      {/* Steps indicator */}
      {step < 3 && (
        <div className="bg-white border-b px-6 py-3">
          <div className="flex items-center justify-center gap-0 max-w-sm mx-auto">
            {STEPS.slice(0, 3).map((label, i) => (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-navy-900' : 'text-gray-300'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${i < step ? 'bg-navy-900 text-white' : i === step ? 'border-2 border-navy-900 text-navy-900' : 'border-2 border-gray-200 text-gray-300'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < 2 && <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-navy-900' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6">

        {/* ── Step 0: Data e horário ─────────────────────────── */}
        {step === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-5 text-lg">Escolha a data e o horário</h2>
            <Calendar
              workDays={info.workDays}
              selectedDate={selectedDate}
              onSelect={handleDateSelect}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />
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
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors
                          ${selectedSlot === slot
                            ? 'bg-navy-900 border-navy-900 text-white'
                            : 'border-gray-200 text-navy-900 hover:border-navy-900'
                          }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              disabled={!selectedDate || !selectedSlot}
              onClick={() => setStep(1)}
              className="mt-6 w-full py-3.5 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-40 hover:bg-navy-800 transition-colors"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ── Step 1: Dados do cliente ───────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Seus dados</h2>
            <p className="text-sm text-gray-500 mb-5">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedSlot}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input
                  name="clientName" value={form.clientName} onChange={updateForm} required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  name="clientEmail" type="email" value={form.clientEmail} onChange={updateForm} required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  name="clientWhatsapp" value={form.clientWhatsapp} onChange={updateForm}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área do direito *</label>
                <input
                  value={specialtySearch}
                  onChange={(e) => { setSpecialtySearch(e.target.value); setForm({ ...form, specialty: '' }) }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                  placeholder="Pesquise a área..."
                />
                {specialtySearch && !form.specialty && (
                  <div className="border border-gray-200 rounded-xl mt-1 max-h-40 overflow-y-auto shadow-sm">
                    {filteredSpecialties.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setForm({ ...form, specialty: s }); setSpecialtySearch(s) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {form.specialty && (
                  <div className="mt-2 px-3 py-1.5 bg-navy-900 text-white text-xs rounded-lg inline-block">
                    ✓ {form.specialty}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">
                ← Voltar
              </button>
              <button
                disabled={!form.clientName || !form.clientEmail || !form.specialty}
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-40 hover:bg-navy-800 transition-colors"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Descrição do problema ─────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-navy-900 mb-1 text-lg">Descreva seu problema</h2>
            <p className="text-sm text-gray-500 mb-5">Uma descrição breve ajuda o advogado a se preparar.</p>
            <textarea
              name="description" value={form.description} onChange={updateForm}
              rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 resize-none"
              placeholder="Ex: Preciso de orientação sobre uma rescisão de contrato de aluguel..."
            />
            {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
              <button
                type="button"
                onClick={startListening}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors
                  ${isListening ? 'border-red-500 text-red-500 bg-red-50' : 'border-gray-200 text-gray-600 hover:border-navy-900'}`}
              >
                <span>{isListening ? '⏹ Gravando...' : '🎤 Falar o problema'}</span>
              </button>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">
                ← Voltar
              </button>
              <button
                onClick={handleBook}
                disabled={booking}
                className="flex-1 py-3 rounded-xl bg-gold-500 text-navy-900 font-bold disabled:opacity-50 hover:bg-gold-400 transition-colors"
              >
                {booking ? 'Aguarde...' : 'Confirmar →'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          </div>
        )}

        {/* ── Step 3: Confirmação / Pagamento ───────────────── */}
        {step === 3 && result && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">{result.paymentUrl ? '💳' : '✅'}</div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">
              {result.paymentUrl ? 'Quase lá! Finalize o pagamento' : 'Agendamento confirmado!'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {result.paymentUrl
                ? 'Após o pagamento, seu agendamento será confirmado automaticamente. Você receberá uma confirmação por email.'
                : 'Você receberá uma confirmação por email em breve.'}
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data</span>
                <span className="font-medium text-navy-900">{format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Horário</span>
                <span className="font-medium text-navy-900">{selectedSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Advogado</span>
                <span className="font-medium text-navy-900">{info.lawyerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Especialidade</span>
                <span className="font-medium text-navy-900">{form.specialty}</span>
              </div>
            </div>
            {result.paymentUrl ? (
              <a
                href={result.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 rounded-xl bg-navy-900 text-white font-bold text-lg hover:bg-navy-800 transition-colors"
              >
                Pagar agora
              </a>
            ) : (
              <p className="text-green-600 font-medium">✓ Confirmado sem cobrança</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
