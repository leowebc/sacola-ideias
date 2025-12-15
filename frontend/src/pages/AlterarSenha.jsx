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

    // Validações
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
      console.log('🔐 [AlterarSenha] Tentando alterar senha:', url)
      
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

      console.log('🔐 [AlterarSenha] Status da resposta:', response.status)

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type')
      let data
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.error('❌ [AlterarSenha] Resposta não é JSON:', text)
        throw new Error(response.status === 404 ? 'Endpoint não encontrado. Verifique se o backend está rodando.' : `Erro ${response.status}: ${text}`)
      }

      if (!response.ok) {
        console.error('❌ [AlterarSenha] Erro na resposta:', data)
        throw new Error(data.detail || data.message || t('alterarSenha.error'))
      }

      showSuccessToast(t('alterarSenha.success'))
      
      // Limpar campos
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')

      // Redirecionar após 1 segundo
      setTimeout(() => {
        navigate('/app')
      }, 1000)

    } catch (error) {
      console.error('❌ [AlterarSenha] Erro completo:', error)
      console.error('❌ [AlterarSenha] URL tentada:', `${API_URL}/auth/alterar-senha`)
      console.error('❌ [AlterarSenha] API_URL configurado:', API_URL)
      
      let mensagemErro = error.message || t('alterarSenha.errorDesc')
      
      // Mensagens mais específicas para erros comuns
      if (error.message && error.message.includes('Not Found')) {
        mensagemErro = 'Endpoint não encontrado. Verifique se o backend está rodando e se a URL está correta.'
      } else if (error.message && error.message.includes('Failed to fetch')) {
        mensagemErro = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.'
      }
      
      showError(t('alterarSenha.error'), mensagemErro)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
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

        {/* Formulário */}
        <div className="modern-card rounded-2xl p-8 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>{t('alterarSenha.senhaAtual')}</span>
                </span>
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
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>{t('alterarSenha.novaSenha')}</span>
                </span>
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
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>{t('alterarSenha.confirmarSenha')}</span>
                </span>
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
              {salvando ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('alterarSenha.salvando')}</span>
                </span>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('alterarSenha.salvar')}</span>
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AlterarSenha

