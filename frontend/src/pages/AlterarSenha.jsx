import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { showError, showSuccessToast } from '../utils/alerts'

const API_URL = (typeof window !== 'undefined' && window.API_URL) 
  ? window.API_URL 
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

function AlterarSenha() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSalvando(true)

    if (!senhaAtual.trim() || !novaSenha.trim() || !confirmarSenha.trim()) {
      showError(t('alterarSenha.validacao'))
      setSalvando(false)
      return
    }
    if (novaSenha.length < 6) {
      showError(t('alterarSenha.senhaMinima'))
      setSalvando(false)
      return
    }
    if (novaSenha !== confirmarSenha) {
      showError(t('alterarSenha.senhasNaoConferem'))
      setSalvando(false)
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        navigate('/login')
        return
      }

      const url = `${API_URL}/auth/alterar-senha`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          senha_atual: senhaAtual.trim(),
          nova_senha: novaSenha.trim()
        })
      })

      const contentType = response.headers.get('content-type')
      const data = contentType && contentType.includes('application/json')
        ? await response.json()
        : {}

      if (!response.ok) {
        throw new Error(data.detail || data.message || t('alterarSenha.error'))
      }

      showSuccessToast(t('alterarSenha.success'))
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setTimeout(() => navigate('/app'), 800)
    } catch (error) {
      let mensagemErro = error.message || t('alterarSenha.errorDesc')
      if (mensagemErro.includes('Not Found')) {
        mensagemErro = 'Endpoint não encontrado. Verifique se o backend está rodando.'
      } else if (mensagemErro.includes('Failed to fetch')) {
        mensagemErro = 'Não foi possível conectar ao servidor.'
      }
      showError(t('alterarSenha.error'), mensagemErro)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12 animate-slide-in">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            {t('alterarSenha.titulo')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('alterarSenha.subtitulo')}
          </p>
        </div>

        <div className="modern-card rounded-2xl p-8 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('alterarSenha.senhaAtual')}
              </label>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
                className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                placeholder={t('alterarSenha.senhaAtualPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('alterarSenha.novaSenha')}
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
                className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                placeholder={t('alterarSenha.novaSenhaPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('alterarSenha.confirmarSenha')}
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
                className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                placeholder={t('alterarSenha.confirmarSenhaPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {salvando ? t('alterarSenha.salvando') : t('alterarSenha.salvar')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AlterarSenha

