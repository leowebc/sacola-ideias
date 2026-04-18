// Utilitário para limpar dados antigos do localStorage
// Execute no console do navegador: limparLocalStorage()

export function limparLocalStorage() {
  // Limpar tudo temporariamente
  localStorage.clear()

  console.log('✅ localStorage limpo!')
  console.log('🔄 Recarregue a página para ver as mudanças')
  
  return true
}

// Disponibilizar globalmente para usar no console
if (typeof window !== 'undefined') {
  window.limparLocalStorage = limparLocalStorage
}

