// Utilitário para limpar dados antigos do localStorage
// Execute no console do navegador: limparLocalStorage()

export function limparLocalStorage() {
  // Limpar ideias antigas
  localStorage.removeItem('sacola_ideias')
  
  // Manter API key se existir
  const apiKey = localStorage.getItem('openai_api_key')
  
  // Limpar tudo temporariamente
  localStorage.clear()
  
  // Restaurar API key se existia
  if (apiKey) {
    localStorage.setItem('openai_api_key', apiKey)
  }
  
  console.log('✅ localStorage limpo! (API key foi preservada)')
  console.log('🔄 Recarregue a página para ver as mudanças')
  
  return true
}

// Disponibilizar globalmente para usar no console
if (typeof window !== 'undefined') {
  window.limparLocalStorage = limparLocalStorage
}

