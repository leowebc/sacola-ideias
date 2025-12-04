import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import { registrarAcessoInicial } from './services/accessLogService'

function App() {
  useEffect(() => {
    // Registrar acesso inicial quando a aplicação carrega (apenas se logado)
    const token = localStorage.getItem('auth_token')
    if (token) {
      registrarAcessoInicial()
    }
  }, [])

  return (
    <Router>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<AuthCallback />} />
        
        {/* Rotas protegidas */}
        <Route 
          path="/app/*" 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } 
        />
        
        {/* Redirecionar raiz para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App

