const API_BASE_URL = (typeof window !== 'undefined' && window.API_URL)
  ? window.API_URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

function buildAuthHeaders() {
  const token = localStorage.getItem('auth_token')
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function parseResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => ({})) : {}

  if (!response.ok) {
    throw new Error(data?.detail || fallbackMessage || `Erro na API (${response.status})`)
  }

  return data
}

export async function buscarWorkspace() {
  const response = await fetch(`${API_BASE_URL}/workspace`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  })

  const data = await parseResponse(response, 'Nao foi possivel carregar o workspace.')
  return Array.isArray(data) ? data : []
}

export async function criarEspaco(payload) {
  const response = await fetch(`${API_BASE_URL}/espacos`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'Nao foi possivel criar o espaco.')
}

export async function renomearEspaco(espacoId, payload) {
  const response = await fetch(`${API_BASE_URL}/espacos/${espacoId}`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'Nao foi possivel renomear o espaco.')
}

export async function excluirEspaco(espacoId) {
  const response = await fetch(`${API_BASE_URL}/espacos/${espacoId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  })

  return parseResponse(response, 'Nao foi possivel excluir o espaco.')
}

export async function criarProjeto(payload) {
  const response = await fetch(`${API_BASE_URL}/projetos`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'Nao foi possivel criar o projeto.')
}

export async function criarKanban(payload) {
  const response = await fetch(`${API_BASE_URL}/kanbans`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'Nao foi possivel criar o kanban.')
}

export async function vincularIdeiaAoProjeto(ideiaId, projetoId, kanbanId = null) {
  const response = await fetch(`${API_BASE_URL}/ideias/${ideiaId}/projeto`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      projeto_id: projetoId,
      kanban_id: kanbanId,
    }),
  })

  return parseResponse(response, 'Nao foi possivel vincular a ideia ao projeto.')
}
