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

export async function atualizarKanbanStatus(id, kanbanStatus) {
  const response = await fetch(`${API_BASE_URL}/ideias/${id}/kanban`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      kanban_status: kanbanStatus,
    }),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao mover cartão (${response.status})`)
  }

  return data
}

export async function iniciarIdeiaNoKanban(id, payload) {
  const response = await fetch(`${API_BASE_URL}/ideias/${id}/kanban/start`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao iniciar no Kanban (${response.status})`)
  }

  return data
}

export async function buscarHistoricoKanban(id) {
  const response = await fetch(`${API_BASE_URL}/ideias/${id}/kanban/history`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ([]))
    : []

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao buscar histÃ³rico do Kanban (${response.status})`)
  }

  return Array.isArray(data) ? data : []
}

export async function buscarCardsKanban(kanbanId) {
  const response = await fetch(`${API_BASE_URL}/kanbans/${kanbanId}/cards`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ([]))
    : []

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao buscar cards do kanban (${response.status})`)
  }

  return Array.isArray(data) ? data : []
}

export async function criarCardKanban(kanbanId, payload) {
  const response = await fetch(`${API_BASE_URL}/kanbans/${kanbanId}/cards`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao criar card do kanban (${response.status})`)
  }

  return data
}

export async function atualizarCardKanban(cardId, payload) {
  const response = await fetch(`${API_BASE_URL}/kanban-cards/${cardId}`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao atualizar card do kanban (${response.status})`)
  }

  return data
}
