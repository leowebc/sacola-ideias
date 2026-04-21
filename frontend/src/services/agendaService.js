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

export async function atualizarAgendaIdeia(id, payload) {
  const response = await fetch(`${API_BASE_URL}/ideias/${id}/agenda`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    throw new Error(data?.detail || `Erro ao atualizar agenda (${response.status})`)
  }

  return data
}
