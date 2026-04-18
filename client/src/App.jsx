import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Páginas públicas
import LandingPage from './pages/LandingPage'

// Páginas protegidas (implementadas nos próximos passos)
import Dashboard from './pages/Dashboard'

// Página pública do agendador
import Scheduler from './pages/Scheduler'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Pública */}
            <Route path="/" element={<LandingPage />} />

            {/* Agendador público */}
            <Route path="/agendar/:slug" element={<Scheduler />} />

            {/* Protegidas */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
