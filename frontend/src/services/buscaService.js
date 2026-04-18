import { 
  buscarTodasIdeias, 
  salvarIdeia as salvarIdeiaDB,
  buscarPorSimilaridade as buscarPorSimilaridadeDB 
} from './dbService'

// Buscar ideias por similaridade (backend gera embedding automaticamente)
export async function buscarPorSimilaridade(termoBusca, _apiKey = null, options = {}) {
  if (!termoBusca || !termoBusca.trim()) {
    // Retornar todas as ideias se não houver termo de busca (sem similaridade)
    const ideias = await buscarTodasIdeias()
    return ideias.map(ideia => ({ ideia, similaridade: null }))
  }

  try {
    // Backend gera embedding automaticamente, só enviar o termo
    const resultados = await buscarPorSimilaridadeDB(termoBusca, options)
    return resultados.map(r => ({
      ideia: {
        id: r.id,
        titulo: r.titulo,
        tag: r.tag,
        ideia: r.ideia,
        data: r.data
      },
      // Backend retorna similarity real (0.0 a 1.0) quando tem API Key
      // Se similarity for 0.0, pode ser busca simples (sem API Key) ou realmente 0% de similaridade
      // Vamos mostrar apenas se for > 0 (busca semântica real funcionou)
      similaridade: (r.similarity !== undefined && r.similarity !== null && r.similarity > 0) 
        ? r.similarity 
        : null
    }))
  } catch (error) {
    console.error('Erro na busca por similaridade:', error)
    // Fallback para busca simples (sem similaridade)
    try {
      const ideias = await buscarTodasIdeias()
      const termo = termoBusca.toLowerCase()
      return ideias
        .filter(ideia => 
          ideia.titulo?.toLowerCase().includes(termo) ||
          ideia.tag?.toLowerCase().includes(termo) ||
          ideia.ideia?.toLowerCase().includes(termo)
        )
        .map(ideia => ({ ideia, similaridade: null }))
    } catch (e) {
      throw e
    }
  }
}

// Salvar ideia (backend gera embedding automaticamente)
export async function salvarIdeiaComEmbedding(ideia, _apiKey = null) {
  // Backend gera embedding automaticamente, apenas enviar a ideia
  return await salvarIdeiaDB(ideia)
}

