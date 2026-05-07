import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'

import LandingPage from './pages/LandingPage'
import Scheduler from './pages/Scheduler'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Clients from './pages/Clients'
import Finance from './pages/Finance'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/clients"      element={<Clients />} />
            <Route path="/finance"      element={<Finance />} />
            <Route path="/settings"     element={<Settings />} />
          </Route>
          <Route path="/:slug" element={<Scheduler />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
