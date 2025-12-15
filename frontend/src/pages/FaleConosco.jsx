import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { showError, showSuccessToast } from '../utils/alerts'

const API_URL = (typeof window !== 'undefined' && window.API_URL) 
  ? window.API_URL 
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

// Email de contato - pode ser configurado via variável de ambiente
const CONTATO_EMAIL = import.meta.env.VITE_CONTATO_EMAIL || 'contato@sacoladeideias.com'

function FaleConosco() {
  const { t } = useTranslation()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!nome.trim() || !email.trim() || !assunto.trim() || !mensagem.trim()) {
      showError(t('contato.erroValidacao'), t('contato.erroValidacaoDesc'))
      return
    }

    setEnviando(true)

    try {
      const token = localStorage.getItem('auth_token')
      
      const response = await fetch(`${API_URL}/contato`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          assunto: assunto.trim(),
          mensagem: mensagem.trim(),
          // Email de destino - configurável via VITE_CONTATO_EMAIL
          email_destino: CONTATO_EMAIL
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao enviar mensagem')
      }

      showSuccessToast(t('contato.sucesso'))
      
      // Limpar formulário
      setNome('')
      setEmail('')
      setAssunto('')
      setMensagem('')

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      showError(t('contato.erro'), error.message || t('contato.erroDesc'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-slide-in">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            {t('contato.titulo')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('contato.subtitulo')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informações de Contato */}
          <div className="lg:col-span-1 space-y-6">
            <div className="modern-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('contato.infoTitulo')}</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t('contato.email')}</p>
                    <p className="text-sm text-gray-600">{CONTATO_EMAIL}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t('contato.tempoResposta')}</p>
                    <p className="text-sm text-gray-600">{t('contato.tempoRespostaDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="lg:col-span-2">
            <div className="modern-card rounded-2xl p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{t('contato.nome')}</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                      placeholder={t('contato.nomePlaceholder')}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{t('contato.emailLabel')}</span>
                      </span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                      placeholder={t('contato.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{t('contato.assunto')}</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none"
                    placeholder={t('contato.assuntoPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{t('contato.mensagem')}</span>
                    </span>
                  </label>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    rows="6"
                    className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none resize-none"
                    placeholder={t('contato.mensagemPlaceholder')}
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {enviando ? (
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('contato.enviando')}</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>{t('contato.enviar')}</span>
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaleConosco

