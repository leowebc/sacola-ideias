import { OpenAIEmbeddings } from '@langchain/openai'
import { 
  buscarTodasIdeias, 
  salvarIdeia as salvarIdeiaDB,
  atualizarIdeia as atualizarIdeiaDB,
  buscarPorSimilaridade as buscarPorSimilaridadeDB 
} from './dbService'

// Função para calcular similaridade de cosseno
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  if (normA === 0 || normB === 0) {
    return 0
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Cache para embeddings por API key
const embeddingsCache = new Map()

function getEmbeddingsModel(apiKey) {
  if (!apiKey) {
    return null
  }
  
  // Se já existe um modelo para esta API key, reutilizar
  if (embeddingsCache.has(apiKey)) {
    return embeddingsCache.get(apiKey)
  }
  
  // Criar novo modelo para esta API key
  const model = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: 'text-embedding-3-small'
  })
  
  embeddingsCache.set(apiKey, model)
  return model
}

// Gerar embedding para uma ideia
export async function gerarEmbedding(texto, apiKey) {
  if (!apiKey) {
    throw new Error('API Key da OpenAI não configurada')
  }
  
  try {
    const model = getEmbeddingsModel(apiKey)
    const embedding = await model.embedQuery(texto)
    return embedding
  } catch (error) {
    console.error('Erro ao gerar embedding:', error)
    throw error
  }
}

// Gerar embedding para texto de busca
export async function gerarEmbeddingBusca(texto, apiKey) {
  return gerarEmbedding(texto, apiKey)
}

// Buscar ideias por similaridade (backend gera embedding automaticamente)
export async function buscarPorSimilaridade(termoBusca, apiKey, options = {}) {
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
export async function salvarIdeiaComEmbedding(ideia, apiKey) {
  // Backend gera embedding automaticamente, apenas enviar a ideia
  return await salvarIdeiaDB(ideia)
}

