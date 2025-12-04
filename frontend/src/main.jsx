import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n/config' // Inicializar i18n

// Log da URL da API para debug
if (typeof window !== 'undefined') {
  console.log('🔧 API_URL configurada:', window.API_URL || 'Não definida (usando fallback)')
  console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL || 'Não definida')
}

// Tratamento de erros globais
window.addEventListener('error', (event) => {
  console.error('❌ Erro global capturado:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rejeitada não tratada:', event.reason)
})

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (error) {
  console.error('❌ Erro ao renderizar a aplicação:', error)
  // Mostrar erro na tela se houver problema
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; font-family: Arial; color: red;">
      <h1>Erro ao carregar a aplicação</h1>
      <p>${error.message}</p>
      <p>Verifique o console do navegador para mais detalhes.</p>
    </div>
  `
}

