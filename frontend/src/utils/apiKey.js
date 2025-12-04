// Utilitário para gerenciar a API Key da OpenAI
// Verifica primeiro variável de ambiente, depois localStorage

export function getApiKey() {
  // 1. Tentar pegar da variável de ambiente (Vite usa import.meta.env)
  const envKey = import.meta.env.VITE_OPENAI_API_KEY
  if (envKey && envKey.trim()) {
    return envKey.trim()
  }
  
  // 2. Tentar pegar do localStorage
  const localKey = localStorage.getItem('openai_api_key')
  if (localKey && localKey.trim()) {
    return localKey.trim()
  }
  
  return null
}

export function setApiKey(key) {
  localStorage.setItem('openai_api_key', key)
}

export function removeApiKey() {
  localStorage.removeItem('openai_api_key')
}

export function hasApiKey() {
  return getApiKey() !== null
}

