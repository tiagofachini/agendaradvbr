import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',    icon: '📊', label: 'Dashboard' },
  { to: '/appointments', icon: '📅', label: 'Compromissos' },
  { to: '/clients',      icon: '👥', label: 'Clientes' },
  { to: '/finance',      icon: '💰', label: 'Financeiro' },
  { to: '/settings',     icon: '⚙️', label: 'Configurações' },
]

export default function AppLayout() {
  const { lawyer, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-navy-900 w-64">
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.svg" alt="AgendarAdv" className="h-8 w-8 object-contain flex-shrink-0" />
        <span className="text-white font-bold text-xl tracking-tight">
          Agendar<span className="text-brand-500">Adv</span>
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
              ${isActive
                ? 'bg-brand-500 text-white'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-2">
          {lawyer?.avatarUrl
            ? <img src={lawyer.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
            : <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                {lawyer?.name?.[0]?.toUpperCase()}
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{lawyer?.name}</p>
            <p className="text-gray-400 text-xs truncate">{lawyer?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-sm transition-colors"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-64 flex-shrink-0">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="md:hidden flex items-center gap-3 bg-navy-900 px-4 py-3.5">
          <button onClick={() => setSidebarOpen(true)} className="text-white text-xl">☰</button>
          <img src="/logo.svg" alt="" className="h-7 w-7 object-contain" />
          <span className="text-white font-bold">Agendar<span className="text-brand-500">Adv</span></span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
