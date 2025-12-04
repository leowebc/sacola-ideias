/**
 * Serviço para registrar logs de acesso com localização
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002/api'

/**
 * Obter localização do usuário via API de geolocalização
 * @returns {Promise<Object>} Dados de localização
 */
async function obterLocalizacao() {
  try {
    // Tentar obter localização via API (ipapi.co, ip-api.com, etc)
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    
    return {
      pais: data.country_code || null,
      cidade: data.city || null,
      regiao: data.region || null,
      timezone: data.timezone || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      ip: data.ip || null
    }
  } catch (error) {
    console.log('Erro ao obter localização:', error)
    // Fallback: tentar outra API
    try {
      const response = await fetch('https://ip-api.com/json/')
      const data = await response.json()
      
      return {
        pais: data.countryCode || null,
        cidade: data.city || null,
        regiao: data.regionName || null,
        timezone: data.timezone || null,
        latitude: data.lat || null,
        longitude: data.lon || null,
        ip: data.query || null
      }
    } catch (error2) {
      console.log('Erro ao obter localização (fallback):', error2)
      return {
        pais: null,
        cidade: null,
        regiao: null,
        timezone: null,
        latitude: null,
        longitude: null,
        ip: null
      }
    }
  }
}

/**
 * Registrar acesso no backend
 * @param {string} endpoint - Endpoint acessado
 * @param {string} metodo - Método HTTP (GET, POST, etc)
 * @param {number} statusCode - Código de status da resposta
 * @param {number} tempoResposta - Tempo de resposta em ms
 */
export async function registrarAcesso(endpoint, metodo = 'GET', statusCode = 200, tempoResposta = 0) {
  try {
    // Obter dados de localização
    const localizacao = await obterLocalizacao()
    
    // Obter user agent
    const userAgent = navigator.userAgent
    
    // Obter token de autenticação (se existir)
    const token = localStorage.getItem('auth_token') || null
    const usuarioId = token ? JSON.parse(atob(token.split('.')[1])).user_id : null
    
    // Preparar dados do acesso
    const dadosAcesso = {
      usuario_id: usuarioId,
      ip_address: localizacao.ip,
      user_agent: userAgent,
      pais: localizacao.pais,
      cidade: localizacao.cidade,
      regiao: localizacao.regiao,
      timezone: localizacao.timezone,
      latitude: localizacao.latitude ? parseFloat(localizacao.latitude) : null,
      longitude: localizacao.longitude ? parseFloat(localizacao.longitude) : null,
      endpoint: endpoint,
      metodo_http: metodo,
      status_code: statusCode,
      tempo_resposta_ms: tempoResposta
    }
    
    // Enviar para o backend (não aguardar resposta para não bloquear)
    fetch(`${API_URL}/acessos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(dadosAcesso)
    }).catch(error => {
      // Ignorar erros silenciosamente (não deve afetar a experiência do usuário)
      console.log('Erro ao registrar acesso (ignorado):', error)
    })
    
  } catch (error) {
    // Ignorar erros silenciosamente
    console.log('Erro ao registrar acesso:', error)
  }
}

/**
 * Registrar acesso quando a página é carregada
 */
export function registrarAcessoInicial() {
  const inicioTempo = performance.now()
  
  // Registrar acesso após carregar a página
  setTimeout(() => {
    const tempoResposta = Math.round(performance.now() - inicioTempo)
    registrarAcesso(window.location.pathname, 'GET', 200, tempoResposta)
  }, 100)
}

