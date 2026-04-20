import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

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

export default function LandingPage() {
  const navigate = useNavigate()
  const { lawyer, login } = useAuth()
  const [modal, setModal] = useState(null) // 'login' | 'register'
  const [tab, setTab] = useState('email') // 'email' | 'google'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', password: '' })

  useEffect(() => {
    if (lawyer) navigate('/dashboard')
  }, [lawyer, navigate])

  const updateForm = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      login(data.token, data.lawyer)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar')
    } finally { setLoading(false) }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password })
      login(data.token, data.lawyer)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciais inválidas')
    } finally { setLoading(false) }
  }

  const handleGoogle = async ({ credential }) => {
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/google', { credential })
      login(data.token, data.lawyer)
      navigate('/dashboard')
    } catch {
      setError('Erro ao autenticar com Google')
    } finally { setLoading(false) }
  }

  const openModal = (type) => {
    setModal(type); setError(''); setTab('email')
    setForm({ name: '', email: '', whatsapp: '', password: '' })
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-navy-900 shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="AgendarAdv" className="h-9 w-9 object-contain" />
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

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-navy-900 pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-brand-500/20 text-brand-400 text-sm font-medium">
            Grátis para advogados que cobram pelo app
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
              className="px-8 py-4 rounded-xl bg-brand-500 text-navy-900 font-bold text-lg hover:bg-brand-400 transition-colors shadow-lg"
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
          <p className="mt-6 text-sm text-gray-500">Sem cartão de crédito. Sem contrato. Sem complicação.</p>
        </div>
      </section>

      {/* ── Problemas ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">
            Reconhece algum desses problemas?
          </h2>
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

      {/* ── Benefícios ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">
            Com o AgendarAdv, tudo muda
          </h2>
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

      {/* ── Funcionalidades ────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">
            Tudo que seu escritório precisa
          </h2>
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

      {/* ── Preço ──────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-navy-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Simples assim: <span className="text-brand-400">use e não pague nada</span>
          </h2>
          <p className="text-gray-300 mb-10 text-lg">
            O AgendarAdv é gratuito para advogados que realizam cobranças pelo aplicativo.
            Só pagam R$&nbsp;29,90/mês aqueles que ficarem mais de 30 dias sem cobrar pelo app.
          </p>
          <div className="bg-white/10 rounded-2xl p-8 border border-white/20 max-w-sm mx-auto">
            <div className="text-5xl font-extrabold text-white mb-1">R$ 0</div>
            <div className="text-brand-400 font-medium mb-6">para sempre, ao usar cobranças</div>
            <ul className="text-gray-200 text-sm space-y-3 text-left mb-8">
              {['Agenda ilimitada', 'Clientes ilimitados', 'Agendador público personalizado', 'Dashboard e relatórios', 'Integração com Asaas', 'Alertas por WhatsApp e email'].map(i => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-brand-400">✓</span> {i}
                </li>
              ))}
            </ul>
            <button
              onClick={() => openModal('register')}
              className="w-full py-3 rounded-xl bg-brand-500 text-navy-900 font-bold hover:bg-brand-400 transition-colors"
            >
              Criar conta grátis
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-navy-900 border-t border-white/10 py-8 px-6 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} AgendarAdv — Feito para advogados brasileiros
      </footer>

      {/* ── Modal ──────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-navy-900 px-8 py-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <img src="/logo.svg" alt="" className="h-8 w-8 object-contain" />
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

            {/* Body */}
            <div className="p-8">
              {/* Tab switcher */}
              <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
                <button
                  onClick={() => setTab('email')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'email' ? 'bg-white shadow text-navy-900' : 'text-gray-500'}`}
                >
                  Email e senha
                </button>
                <button
                  onClick={() => setTab('google')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'google' ? 'bg-white shadow text-navy-900' : 'text-gray-500'}`}
                >
                  Entrar com Google
                </button>
              </div>

              {tab === 'google' ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-gray-500 text-center">
                    {modal === 'register'
                      ? 'Use sua conta Google para criar sua conta instantaneamente.'
                      : 'Acesse sua conta com um clique.'}
                  </p>
                  <GoogleLogin
                    onSuccess={handleGoogle}
                    onError={() => setError('Erro ao autenticar com Google')}
                    width="100%"
                    text={modal === 'register' ? 'signup_with' : 'signin_with'}
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
              ) : (
                <form onSubmit={modal === 'register' ? handleRegister : handleLogin} className="space-y-4">
                  {modal === 'register' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                      <input
                        name="name" value={form.name} onChange={updateForm} required
                        placeholder="Dr. João Silva"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de trabalho</label>
                    <input
                      name="email" type="email" value={form.email} onChange={updateForm} required
                      placeholder="joao@escritorio.adv.br"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                    />
                  </div>
                  {modal === 'register' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                      <input
                        name="whatsapp" value={form.whatsapp} onChange={updateForm}
                        placeholder="(11) 99999-9999"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input
                      name="password" type="password" value={form.password} onChange={updateForm} required
                      placeholder="Mínimo 8 caracteres"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button
                    type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Aguarde...' : modal === 'register' ? 'Criar conta' : 'Entrar'}
                  </button>
                </form>
              )}

              {/* Switch modal */}
              <p className="text-center text-sm text-gray-500 mt-6">
                {modal === 'register' ? (
                  <>Já tem conta?{' '}
                    <button onClick={() => openModal('login')} className="text-navy-700 font-medium hover:underline">
                      Entrar
                    </button>
                  </>
                ) : (
                  <>Ainda não tem conta?{' '}
                    <button onClick={() => openModal('register')} className="text-navy-700 font-medium hover:underline">
                      Criar grátis
                    </button>
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
