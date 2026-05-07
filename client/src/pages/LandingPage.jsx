import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const PROBLEMS = [
  'Agenda bagunçada e compromissos esquecidos',
  'Clientes te chamando no WhatsApp a qualquer hora',
  'Dificuldade de saber quanto vai receber no mês',
  'Histórico de atendimentos espalhado em papéis e planilhas',
  'Ferramentas caras que não se encaixam na advocacia',
  'Sem visão clara da rentabilidade do escritório',
]

const BENEFITS = [
  { icon: '📅', title: 'Agenda Organizada', desc: 'Visualize todos os seus compromissos como no Google Calendar, com status e alertas.' },
  { icon: '💰', title: 'Mais Faturamento', desc: 'Receba pagamentos antecipados pelas consultas direto no app, sem intermediários.' },
  { icon: '📊', title: 'Visão de Gestão', desc: 'Dashboard com recebíveis, novos clientes e compromissos do dia — tudo em um painel.' },
  { icon: '👥', title: 'Histórico de Clientes', desc: 'Cada cliente com seu histórico de atendimentos, demandas e status financeiro.' },
  { icon: '🔗', title: 'Link de Agendamento', desc: 'Seu cliente agenda e paga sozinho pela sua URL personalizada, sem te ligar.' },
  { icon: '📱', title: 'Você no Controle pelo WhatsApp', desc: 'Receba alertas de novos agendamentos e cancelamentos — sem o cliente precisar te chamar.' },
]

const FEATURES = [
  { icon: '🗓️', title: 'Agenda Inteligente', desc: 'Sincronize com Google Calendar ou use a agenda nativa. Defina dias e horários disponíveis para agendamento.' },
  { icon: '🔗', title: 'Agendador Público', desc: 'Página mobile com sua identidade. O cliente escolhe o horário, descreve o problema e paga — tudo online.' },
  { icon: '👤', title: 'Módulo de Clientes', desc: 'Cadastro completo com histórico de atendimentos, demandas ativas e status financeiro de cada cliente.' },
  { icon: '💳', title: 'Módulo Financeiro', desc: 'Integração com Asaas: gerencie cobranças, veja saldo, recebidos e a receber com gráfico de evolução.' },
  { icon: '📈', title: 'Dashboard de Gestão', desc: 'Compromissos de hoje e amanhã, countdown pro próximo cliente, recebíveis e indicadores do período.' },
  { icon: '⚙️', title: 'Configurações Completas', desc: 'Personalize seu escritório, especialidades, horários, integração com Google e muito mais.' },
]

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

export default function LandingPage() {
  const navigate = useNavigate()
  const { lawyer } = useAuth()
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', password: '' })

  useEffect(() => { if (lawyer) navigate('/dashboard') }, [lawyer, navigate])

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, whatsapp: form.whatsapp } },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) setError('Credenciais inválidas')
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://agendar.adv.br' },
    })
  }

  const openModal = (type) => {
    setModal(type); setError('')
    setForm({ name: '', email: '', whatsapp: '', password: '' })
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-navy-900 shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AgendarAdv" className="h-9 w-9 object-contain" />
            <span className="text-white font-bold text-xl tracking-tight">
              Agendar<span className="text-brand-500">Adv</span>
            </span>
          </div>
          <button
            onClick={() => openModal('login')}
            className="px-5 py-2 rounded-lg border border-brand-500 text-brand-400 text-sm font-medium hover:bg-brand-500 hover:text-white transition-colors"
          >
            Entrar
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-navy-900 pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-brand-500/20 text-brand-400 text-sm font-medium">
            100% gratuito — sem cartão, sem prazo, sem pegadinha
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Mais consultas.<br />
            <span className="text-brand-400">Menos caos.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            Centralize agenda, clientes, cobranças e histórico em uma só ferramenta.
            Seu cliente agenda e paga sozinho — você só aparece na consulta.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => openModal('register')}
              className="px-8 py-4 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-400 transition-colors shadow-lg"
            >
              Começar Grátis
            </button>
            <button
              onClick={() => openModal('login')}
              className="px-8 py-4 rounded-xl border-2 border-white/20 text-white font-semibold text-lg hover:border-white/50 transition-colors"
            >
              Já tenho conta
            </button>
          </div>
          <p className="mt-6 text-sm text-gray-500">Sem cartão de crédito. Sem contrato. Comece em segundos.</p>
        </div>
      </section>

      {/* Problemas */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Reconhece algum desses problemas?</h2>
          <p className="text-center text-gray-500 mb-12">Se sim, você está no lugar certo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROBLEMS.map((p) => (
              <div key={p} className="bg-white rounded-xl p-5 flex items-start gap-3 shadow-sm border border-gray-100">
                <span className="text-2xl mt-0.5">😔</span>
                <p className="text-gray-700 text-sm leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Com o AgendarAdv, tudo muda</h2>
          <p className="text-center text-gray-500 mb-12">Uma ferramenta. Tudo resolvido.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-navy-900 rounded-2xl p-6 text-white">
                <div className="text-4xl mb-4">{b.icon}</div>
                <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Tudo que seu escritório precisa</h2>
          <p className="text-center text-gray-500 mb-12">Sem precisar de 5 ferramentas diferentes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-navy-800 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Grátis de verdade. Sem asterisco.</h2>
          <p className="text-center text-gray-500 mb-12 text-lg">
            Comece sem pagar nada. Faça upgrade quando precisar de mais.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Plano Gratuito */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold uppercase tracking-wide mb-4">Gratuito</span>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold text-navy-900">R$ 0</span>
                  <span className="text-gray-400 text-sm mb-2">/mês</span>
                </div>
                <p className="text-gray-500 text-sm">Para começar e organizar sua rotina.</p>
              </div>

              <ul className="space-y-3 text-sm flex-1 mb-8">
                {[
                  ['✓', 'Agenda e controle de compromissos', true],
                  ['✓', 'Cadastro de clientes com histórico', true],
                  ['✓', 'Agendador público personalizado', true],
                  ['✓', 'Dashboard e módulo financeiro', true],
                  ['✓', 'Integração com Asaas (cobranças)', true],
                  ['~', 'Até 30 consultas/mês', false],
                  ['~', 'Pode exibir anúncios na plataforma', false],
                  ['✗', 'Integração com Google Agenda ou Outlook', false],
                  ['✗', 'Videochamada via Meet ou Teams', false],
                  ['✗', 'Transcrição da reunião por IA', false],
                  ['✗', 'Confirmação prévia com cliente via WhatsApp', false],
                ].map(([icon, text, ok]) => (
                  <li key={text} className={`flex items-start gap-2.5 ${ok ? 'text-gray-700' : icon === '~' ? 'text-amber-600' : 'text-gray-400'}`}>
                    <span className={`mt-0.5 font-bold flex-shrink-0 ${ok ? 'text-green-500' : icon === '~' ? 'text-amber-500' : 'text-gray-300'}`}>{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openModal('register')}
                className="w-full py-3 rounded-xl border-2 border-navy-900 text-navy-900 font-bold hover:bg-navy-900 hover:text-white transition-colors"
              >
                Criar conta grátis
              </button>
            </div>

            {/* Plano Pro */}
            <div className="bg-navy-900 rounded-2xl border-2 border-brand-500 p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">RECOMENDADO</div>
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-brand-400 text-xs font-semibold uppercase tracking-wide mb-4">Pro</span>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold text-white">R$ 29,90</span>
                  <span className="text-gray-400 text-sm mb-2">/mês</span>
                </div>
                <p className="text-gray-400 text-sm">Para advogados que querem crescer com eficiência.</p>
              </div>

              <ul className="space-y-3 text-sm flex-1 mb-8">
                {[
                  'Tudo do plano gratuito',
                  'Consultas ilimitadas',
                  'Sem anúncios',
                  'Integração com Google Agenda e Outlook',
                  'Videochamada integrada via Meet ou Teams',
                  'Transcrição automática da reunião por IA',
                  'Confirmação prévia com cliente via WhatsApp',
                ].map((text, i) => (
                  <li key={text} className="flex items-start gap-2.5 text-gray-200">
                    <span className={`mt-0.5 font-bold flex-shrink-0 ${i === 0 ? 'text-gray-400' : 'text-brand-400'}`}>✓</span>
                    {text}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openModal('register')}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold hover:bg-brand-400 transition-colors"
              >
                Começar com o Pro
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-white/10 pt-10 pb-8 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Parceiros */}
          <div className="text-center mb-8">
            <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-4">Conheça também</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://penhora.app.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-3 transition-colors group"
              >
                <span className="text-xl">⚖️</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm group-hover:text-brand-400 transition-colors">penhora.app.br</p>
                  <p className="text-gray-500 text-xs">Pesquisa de penhora online</p>
                </div>
              </a>
              <a
                href="https://sumulando.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-3 transition-colors group"
              >
                <span className="text-xl">📚</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm group-hover:text-brand-400 transition-colors">sumulando.com.br</p>
                  <p className="text-gray-500 text-xs">Súmulas e jurisprudência</p>
                </div>
              </a>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} AgendarAdv — Feito para advogados brasileiros</span>
            <div className="flex gap-4">
              <Link to="/termos" className="hover:text-gray-300 transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-gray-300 transition-colors">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-navy-900 px-8 py-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                  <span className="text-white font-bold text-xl">
                    Agendar<span className="text-brand-400">Adv</span>
                  </span>
                </div>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
              </div>
              <p className="text-gray-300 text-sm">
                {modal === 'register' ? 'Crie sua conta grátis em segundos' : 'Bem-vindo de volta'}
              </p>
            </div>

            <div className="p-8">
              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {modal === 'register' ? 'Cadastrar com Google' : 'Entrar com Google'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={modal === 'register' ? handleRegister : handleLogin} className="space-y-4">
                {modal === 'register' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                      <input name="name" value={form.name} onChange={update} required placeholder="Dr. João Silva" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                      <input name="whatsapp" value={form.whatsapp} onChange={update} placeholder="(11) 99999-9999" className={inputCls} />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" value={form.email} onChange={update} required placeholder="joao@escritorio.adv.br" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input name="password" type="password" value={form.password} onChange={update} required placeholder="Mínimo 6 caracteres" className={inputCls} />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Aguarde...' : modal === 'register' ? 'Criar conta' : 'Entrar'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                {modal === 'register' ? (
                  <>Já tem conta?{' '}
                    <button onClick={() => openModal('login')} className="text-navy-700 font-medium hover:underline">Entrar</button>
                  </>
                ) : (
                  <>Ainda não tem conta?{' '}
                    <button onClick={() => openModal('register')} className="text-navy-700 font-medium hover:underline">Criar grátis</button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
