/**
 * Utilitário para diagnosticar problemas de sincronização com o banco de dados
 */

export async function diagnosticarBanco() {
  console.log('🔍 ===== DIAGNÓSTICO DO BANCO DE DADOS =====')
  
  const API_BASE_URL = (typeof window !== 'undefined' && window.API_URL) 
    ? window.API_URL 
    : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')
  
  console.log('📍 URL da API:', API_BASE_URL)
  console.log('📍 window.API_URL:', window.API_URL || 'não definido')
  console.log('📍 VITE_API_URL:', import.meta.env.VITE_API_URL || 'não definido')
  
  // Verificar localStorage
  const localStorageIdeias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
  console.log('💾 localStorage "sacola_ideias":', localStorageIdeias.length, 'itens')
  if (localStorageIdeias.length > 0) {
    console.log('💾 Primeiros IDs no localStorage:', localStorageIdeias.slice(0, 5).map(i => i.id))
  }
  
  // Verificar token
  const token = localStorage.getItem('auth_token')
  console.log('🔐 Token de autenticação:', token ? 'presente (' + token.substring(0, 20) + '...)' : 'AUSENTE')
  
  // Buscar do banco
  try {
    const { buscarTodasIdeias } = await import('../services/dbService')
    const ideias = await buscarTodasIdeias()
    
    console.log('✅ Busca do banco bem-sucedida:', ideias.length, 'ideias')
    
    if (ideias.length > 0) {
      const ids = ideias.map(i => i.id).filter(Boolean)
      console.log('📋 IDs no banco:', ids.slice(0, 10))
      
      // Verificar se há IDs que são timestamps
      const timestamps = ids.filter(id => typeof id === 'number' && id > 1000000000000)
      if (timestamps.length > 0) {
        console.warn('⚠️ PROBLEMA DETECTADO:', timestamps.length, 'IDs são timestamps (não são IDs do banco)!')
        console.warn('⚠️ Isso indica que o backend pode estar retornando IDs temporários.')
      }
      
      // Verificar estrutura das ideias
      const exemplo = ideias[0]
      console.log('📋 Estrutura de exemplo:', {
        id: exemplo.id,
        tipoId: typeof exemplo.id,
        titulo: exemplo.titulo?.substring(0, 30),
        temData: !!exemplo.data,
        temTag: !!exemplo.tag,
        temIdeia: !!exemplo.ideia
      })
    }
    
    // Comparar com localStorage
    if (localStorageIdeias.length > 0) {
      const idsLocalStorage = localStorageIdeias.map(i => i.id)
      const idsBanco = ideias.map(i => i.id)
      const apenasLocalStorage = idsLocalStorage.filter(id => !idsBanco.includes(id))
      const apenasBanco = idsBanco.filter(id => !idsLocalStorage.includes(id))
      
      if (apenasLocalStorage.length > 0) {
        console.warn('⚠️ IDs apenas no localStorage (não no banco):', apenasLocalStorage)
      }
      if (apenasBanco.length > 0) {
        console.log('ℹ️ IDs apenas no banco (não no localStorage):', apenasBanco)
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao buscar do banco:', error)
  }
  
  console.log('🔍 ===== FIM DO DIAGNÓSTICO =====')
}

// Função para testar salvamento
export async function testarSalvamento(titulo = 'Teste de Diagnóstico', ideia = 'Esta é uma ideia de teste para diagnóstico') {
  console.log('🧪 ===== TESTE DE SALVAMENTO =====')
  
  try {
    const { salvarIdeia } = await import('../services/dbService')
    
    const ideiaTeste = {
      id: Date.now(),
      titulo,
      tag: 'teste',
      ideia,
      data: new Date().toISOString()
    }
    
    console.log('📝 Tentando salvar:', ideiaTeste)
    const resultado = await salvarIdeia(ideiaTeste)
    console.log('✅ Resposta do backend:', resultado)
    
    // Aguardar um pouco e buscar novamente
    console.log('⏳ Aguardando 2 segundos...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const { buscarTodasIdeias } = await import('../services/dbService')
    const todasIdeias = await buscarTodasIdeias()
    const encontrada = todasIdeias.find(i => i.id === resultado.id || i.titulo === titulo)
    
    if (encontrada) {
      console.log('✅ IDEIA ENCONTRADA NO BANCO APÓS SALVAR!')
      console.log('✅ ID encontrado:', encontrada.id)
    } else {
      console.error('❌ IDEIA NÃO ENCONTRADA NO BANCO APÓS SALVAR!')
      console.error('❌ ID retornado no salvamento:', resultado.id)
      console.error('❌ IDs no banco:', todasIdeias.map(i => i.id).slice(0, 10))
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de salvamento:', error)
  }
  
  console.log('🧪 ===== FIM DO TESTE =====')
}

