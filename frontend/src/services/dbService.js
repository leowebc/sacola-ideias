// Serviço para comunicação com o banco de dados PostgreSQL
// Esta é uma camada de abstração que pode ser usada com um backend API

// URL da API - verifica em ordem: window.API_URL (Hostgator), env var, ou localhost
const API_BASE_URL = (typeof window !== 'undefined' && window.API_URL) 
  ? window.API_URL 
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

// Log da URL da API sendo usada (apenas uma vez ao carregar)
if (typeof window !== 'undefined') {
  console.log('🔧 [dbService] API_BASE_URL configurada:', API_BASE_URL)
  console.log('🔧 [dbService] window.API_URL:', window.API_URL || 'não definido')
  console.log('🔧 [dbService] VITE_API_URL:', import.meta.env.VITE_API_URL || 'não definido')
  
  // Aviso se estiver usando backend local
  if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
    console.warn('⚠️ [dbService] ATENÇÃO: Usando backend LOCAL!')
    console.warn('⚠️ [dbService] Se os dados não aparecerem no Supabase, verifique:')
    console.warn('⚠️ [dbService] 1. Se o backend local está conectado ao Supabase')
    console.warn('⚠️ [dbService] 2. Se as variáveis de ambiente do backend estão corretas')
    console.warn('⚠️ [dbService] 3. Se o backend local está usando o mesmo banco que produção')
  }
}

// Função auxiliar para fazer requisições (inclui token de autenticação)
async function fetchAPI(endpoint, options = {}) {
  // Obter token de autenticação do localStorage
  const token = localStorage.getItem('auth_token')
  
  // Log para debug
  if (endpoint.includes('/ideias') && options.method === 'POST') {
    console.log('🔐 [dbService] Criando ideia - Token presente:', !!token)
    if (token) {
      console.log('   Token (primeiros 20 chars):', token.substring(0, 20) + '...')
    } else {
      console.warn('   ⚠️  ATENÇÃO: Token não encontrado no localStorage!')
    }
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  // Adicionar token de autenticação se existir
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    console.warn('⚠️  [dbService] Requisição sem token de autenticação:', endpoint)
  }
  
  try {
    // Garantir que método GET seja explícito para buscar ideias
    const method = options.method || (endpoint === '/ideias' ? 'GET' : undefined)
    
    const url = `${API_BASE_URL}${endpoint}`
    console.log(`🌐 [fetchAPI] ${method || 'GET'} ${url}`)
    console.log(`🌐 [fetchAPI] Headers:`, headers)
    if (options.body) {
      console.log(`🌐 [fetchAPI] Body:`, options.body.substring(0, 200) + '...')
    }
    
    const response = await fetch(url, {
      method: method,
      headers,
      ...options,
    })

    console.log(`🌐 [fetchAPI] Response status: ${response.status} ${response.statusText}`)
    console.log(`🌐 [fetchAPI] Response headers:`, Object.fromEntries(response.headers.entries()))

    // Verificar se a resposta é JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      console.error('❌ [fetchAPI] Resposta não é JSON:', text.substring(0, 200))
      throw new Error(`Backend retornou resposta inválida: ${response.status} ${response.statusText}`)
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ [fetchAPI] Erro na resposta:', errorData)
      throw new Error(errorData.detail || `Erro na API: ${response.statusText} (${response.status})`)
    }

    const data = await response.json()
    console.log(`✅ [fetchAPI] Resposta OK:`, data)
    
    // Log adicional para POST de ideias
    if (endpoint.includes('/ideias') && options.method === 'POST') {
      console.log('📊 [fetchAPI] Resposta do POST /ideias:')
      console.log('📊 [fetchAPI] - ID retornado:', data?.id)
      console.log('📊 [fetchAPI] - Tipo do ID:', typeof data?.id)
      console.log('📊 [fetchAPI] - Título:', data?.titulo)
      console.log('📊 [fetchAPI] - Resposta completa:', JSON.stringify(data, null, 2))
      
      // Aviso especial se for backend local
      if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
        console.warn('⚠️ [fetchAPI] ⚠️ BACKEND LOCAL DETECTADO ⚠️')
        console.warn('⚠️ [fetchAPI] Se este ID não aparecer no Supabase, o problema está no backend local!')
        console.warn('⚠️ [fetchAPI] Verifique:')
        console.warn('⚠️ [fetchAPI] 1. Variáveis de ambiente do backend (SUPABASE_URL, SUPABASE_KEY)')
        console.warn('⚠️ [fetchAPI] 2. Se o backend local está conectado ao Supabase')
        console.warn('⚠️ [fetchAPI] 3. Logs do backend para ver se há erros')
      }
    }
    
    return data
  } catch (error) {
    console.error('❌ [fetchAPI] Erro ao comunicar com a API:', error)
    console.error('❌ [fetchAPI] URL tentada:', `${API_BASE_URL}${endpoint}`)
    throw error
  }
}

// Buscar todas as ideias
export async function buscarTodasIdeias() {
  try {
    console.log('🔍 [dbService] Buscando todas as ideias do banco...')
    const resultado = await fetchAPI('/ideias')
    console.log('✅ [dbService] Ideias encontradas:', resultado?.length || 0)
    
    // Verificar se o resultado é um array
    if (!Array.isArray(resultado)) {
      console.error('❌ [dbService] ERRO: Backend não retornou um array!')
      console.error('❌ [dbService] Tipo recebido:', typeof resultado)
      console.error('❌ [dbService] Valor:', resultado)
      throw new Error('Backend retornou formato inválido: esperado array de ideias')
    }
    
    // Log dos IDs encontrados
    if (resultado.length > 0) {
      const ids = resultado.map(i => i.id).filter(Boolean)
      console.log('🔍 [dbService] IDs encontrados no banco:', ids.slice(0, 10), ids.length > 10 ? '...' : '')
      
      // Verificar se há IDs que parecem timestamps (indicando problema)
      const timestamps = ids.filter(id => typeof id === 'number' && id > 1000000000000)
      if (timestamps.length > 0) {
        console.warn('⚠️ [dbService] ATENÇÃO: Encontrados', timestamps.length, 'IDs que parecem timestamps!')
        console.warn('⚠️ [dbService] Isso indica que o backend pode estar retornando IDs temporários em vez de IDs do banco.')
      }
      
      // Log de exemplo de ideia para verificar estrutura
      console.log('🔍 [dbService] Exemplo de ideia retornada:', {
        id: resultado[0].id,
        titulo: resultado[0].titulo?.substring(0, 50),
        temData: !!resultado[0].data,
        temTag: !!resultado[0].tag
      })
    }
    
    // Se obteve sucesso, limpar localStorage para não confundir
    localStorage.removeItem('sacola_ideias')
    return resultado
  } catch (error) {
    console.error('❌ [dbService] Erro ao buscar ideias da API:', error)
    // Não usar fallback - sempre lançar erro para mostrar que API não está funcionando
    throw error
  }
}

// Buscar ideia por ID
export async function buscarIdeiaPorId(id) {
  try {
    return await fetchAPI(`/ideias/${id}`)
  } catch (error) {
    console.error('Erro ao buscar ideia:', error)
    throw error
  }
}

// Salvar nova ideia
export async function salvarIdeia(ideia) {
  try {
    const payload = {
      titulo: ideia.titulo,
      tag: ideia.tag || null,
      ideia: ideia.ideia
    }
    
    console.log('💾 [dbService] Salvando ideia:', payload)
    console.log('💾 [dbService] API_BASE_URL:', API_BASE_URL)
    
    // Aviso adicional se for backend local
    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
      console.warn('⚠️ [dbService] SALVANDO NO BACKEND LOCAL!')
      console.warn('⚠️ [dbService] Verifique se o backend local está conectado ao Supabase')
    }
    
    // Se tiver embedding, usar endpoint específico
    if (ideia.embedding && Array.isArray(ideia.embedding)) {
      console.log('💾 [dbService] Salvando com embedding (tamanho:', ideia.embedding.length, ')')
      const resultado = await fetchAPI('/ideias/com-embedding', {
        method: 'POST',
        body: JSON.stringify({
          ideia: payload,
          embedding: ideia.embedding
        }),
      })
      console.log('✅ [dbService] Ideia salva com embedding:', resultado)
      
      // Verificar se a resposta contém um ID válido do banco
      if (!resultado || !resultado.id) {
        console.error('❌ [dbService] ERRO: Backend retornou sucesso mas sem ID!')
        console.error('❌ [dbService] Resposta:', JSON.stringify(resultado, null, 2))
        throw new Error('Backend retornou resposta inválida: sem ID da ideia salva')
      }
      
      // Verificar se o ID é um timestamp (indicando que não foi salvo no banco)
      if (typeof resultado.id === 'number' && resultado.id > 1000000000000) {
        console.warn('⚠️ [dbService] ATENÇÃO: ID parece ser um timestamp!')
        console.warn('⚠️ [dbService] ID recebido:', resultado.id)
        console.warn('⚠️ [dbService] Isso pode indicar que o backend não salvou no banco.')
      }
      
      return resultado
    }
    
    console.log('💾 [dbService] Salvando sem embedding')
    const resultado = await fetchAPI('/ideias', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    console.log('✅ [dbService] Ideia salva com sucesso:', resultado)
    
    // Verificar se a resposta contém um ID válido do banco
    if (!resultado || !resultado.id) {
      console.error('❌ [dbService] ERRO: Backend retornou sucesso mas sem ID!')
      console.error('❌ [dbService] Resposta:', JSON.stringify(resultado, null, 2))
      throw new Error('Backend retornou resposta inválida: sem ID da ideia salva')
    }
    
    // Verificar se o ID é um timestamp (indicando que não foi salvo no banco)
    if (typeof resultado.id === 'number' && resultado.id > 1000000000000) {
      console.warn('⚠️ [dbService] ATENÇÃO: ID parece ser um timestamp!')
      console.warn('⚠️ [dbService] ID recebido:', resultado.id)
      console.warn('⚠️ [dbService] Isso pode indicar que o backend não salvou no banco.')
    }
    
    return resultado
  } catch (error) {
    console.error('❌ [dbService] Erro ao salvar ideia:', error)
    console.error('❌ [dbService] Detalhes do erro:', {
      message: error.message,
      stack: error.stack
    })
    throw error // Não usar localStorage como fallback, deixar o erro subir
  }
}

// Atualizar ideia existente
export async function atualizarIdeia(id, ideiaAtualizada) {
  try {
    return await fetchAPI(`/ideias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ideiaAtualizada),
    })
  } catch (error) {
    console.error('Erro ao atualizar ideia:', error)
    // Fallback para localStorage se API não disponível
    const ideias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
    const index = ideias.findIndex(i => i.id === id)
    if (index !== -1) {
      ideias[index] = { ...ideias[index], ...ideiaAtualizada }
      localStorage.setItem('sacola_ideias', JSON.stringify(ideias))
      return ideias[index]
    }
    throw new Error('Ideia não encontrada')
  }
}

// Deletar ideia
export async function deletarIdeia(id) {
  try {
    return await fetchAPI(`/ideias/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Erro ao deletar ideia:', error)
    // Fallback para localStorage se API não disponível
    const ideias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
    const filtradas = ideias.filter(i => i.id !== id)
    localStorage.setItem('sacola_ideias', JSON.stringify(filtradas))
    return { success: true }
  }
}

// Buscar por similaridade (backend gera embedding automaticamente)
export async function buscarPorSimilaridade(termoBusca) {
  try {
    // Backend gera embedding automaticamente, só enviar o termo
    return await fetchAPI('/ideias/buscar', {
      method: 'POST',
      body: JSON.stringify({
        termo: termoBusca,
      }),
    })
  } catch (error) {
    console.error('Erro na busca por similaridade:', error)
    throw error
  }
}

// Salvar ideia com embedding
export async function salvarIdeiaComEmbeddingDB(ideia, embedding, apiKey) {
  try {
    return await fetchAPI('/ideias/com-embedding', {
      method: 'POST',
      body: JSON.stringify({
        ideia: ideia,
        embedding: embedding,
      }),
    })
  } catch (error) {
    console.error('Erro ao salvar ideia com embedding:', error)
    throw error
  }
}

// Atualizar embedding de uma ideia
export async function atualizarEmbedding(id, embedding) {
  try {
    return await fetchAPI(`/ideias/${id}/embedding`, {
      method: 'PUT',
      body: JSON.stringify({ embedding }),
    })
  } catch (error) {
    console.error('Erro ao atualizar embedding:', error)
    throw error
  }
}

