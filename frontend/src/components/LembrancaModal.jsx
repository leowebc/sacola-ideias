import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const API_URL = (typeof window !== 'undefined' && window.API_URL) 
  ? window.API_URL 
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

function LembrancaModal({ isOpen, onClose, onSugestaoSelecionada }) {
  const { t } = useTranslation()
  const [texto, setTexto] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [erro, setErro] = useState(null)
  const [sugestaoExpandida, setSugestaoExpandida] = useState(null)
  const [tituloSelecionado, setTituloSelecionado] = useState('')
  const [tagSelecionada, setTagSelecionada] = useState('')
  const [ideiaSelecionada, setIdeiaSelecionada] = useState('')
  const timeoutRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    // Se o modal não estiver aberto, não fazer nada
    if (!isOpen) {
      return
    }

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Se o texto estiver vazio, limpar sugestões
    if (!texto.trim()) {
      setSugestoes([])
      setMostrarSugestoes(false)
      setCarregando(false)
      setErro(null)
      return
    }

    // Debounce: aguardar 800ms após parar de digitar
    setCarregando(true)
    timeoutRef.current = setTimeout(async () => {
      await buscarSugestoesIA(texto.trim())
    }, 800)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [texto, isOpen])

  const buscarSugestoesIA = async (termo) => {
    try {
      setErro(null)
      
      const token = localStorage.getItem('auth_token')
      const url = `${API_URL}/lembrancas/sugerir`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          texto: termo
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        const errorMsg = `Erro ${response.status}: ${response.statusText}. Verifique se o backend está rodando.`
        setErro(errorMsg)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      
      if (!data.sugestoes || data.sugestoes.length === 0) {
        setErro('Nenhuma sugestão foi gerada. Tente descrever com mais detalhes.')
      }
      
      setSugestoes(data.sugestoes || [])
      setMostrarSugestoes(true)
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error)
      setSugestoes([])
      setErro(`Erro ao buscar sugestões: ${error.message}. Verifique se o backend está rodando na porta 8002.`)
    } finally {
      setCarregando(false)
    }
  }

  const handleSugestaoClick = (sugestao) => {
    // Expandir a sugestão para dividir em título, tag e ideia
    setSugestaoExpandida(sugestao)
    // Dividir a sugestão por vírgulas ou pontos para facilitar
    const partes = sugestao.split(/[,.]/).map(p => p.trim()).filter(p => p)
    if (partes.length > 0) {
      setTituloSelecionado(partes[0] || '')
      setTagSelecionada(partes.length > 1 ? partes[1] : '')
      setIdeiaSelecionada(partes.length > 2 ? partes.slice(2).join(', ') : sugestao)
    } else {
      setTituloSelecionado('')
      setTagSelecionada('')
      setIdeiaSelecionada(sugestao)
    }
  }

  const handleConfirmarDivisao = () => {
    try {
      if (onSugestaoSelecionada) {
        onSugestaoSelecionada({
          titulo: tituloSelecionado || '',
          tag: tagSelecionada || '',
          ideia: ideiaSelecionada || ''
        })
      }
      handleClose()
    } catch (error) {
      console.error('Erro ao confirmar divisão:', error)
    }
  }

  const handleTodaIdeia = () => {
    try {
      if (onSugestaoSelecionada && sugestaoExpandida) {
        onSugestaoSelecionada({
          titulo: '',
          tag: '',
          ideia: sugestaoExpandida
        })
      }
      handleClose()
    } catch (error) {
      console.error('Erro ao colocar toda ideia:', error)
    }
  }

  const handleCancelarDivisao = () => {
    setSugestaoExpandida(null)
    setTituloSelecionado('')
    setTagSelecionada('')
    setIdeiaSelecionada('')
  }

  const handleClose = () => {
    setTexto('')
    setSugestoes([])
    setMostrarSugestoes(false)
    setSugestaoExpandida(null)
    setTituloSelecionado('')
    setTagSelecionada('')
    setIdeiaSelecionada('')
    setErro(null)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t('lembranca.titulo')}
                </h2>
                <p className="text-sm text-gray-500">{t('lembranca.subtitulo')}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Input */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>{t('lembranca.inputLabel')}</span>
                </span>
              </label>
              <textarea
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={t('lembranca.inputPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none resize-none min-h-[120px] text-lg"
                rows="4"
              />
              {carregando && (
                <div className="absolute bottom-3 right-3">
                  <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Sugestões da IA */}
            {mostrarSugestoes && sugestoes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-semibold">{t('lembranca.sugestoesIA')}</span>
                </div>
                <div className="space-y-2">
                  {sugestoes.map((sugestao, index) => (
                    <button
                      key={index}
                      onClick={() => handleSugestaoClick(sugestao)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-400 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800 group-hover:text-indigo-700 font-medium">
                          {sugestao}
                        </span>
                        <svg className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interface de Divisão de Sugestão */}
            {sugestaoExpandida && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-indigo-800">Dividir sugestão</h3>
                  <button
                    onClick={handleCancelarDivisao}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {/* Título */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      value={tituloSelecionado}
                      onChange={(e) => setTituloSelecionado(e.target.value)}
                      placeholder="Ex: Edital de licitação"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Tag */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tag
                    </label>
                    <input
                      type="text"
                      value={tagSelecionada}
                      onChange={(e) => setTagSelecionada(e.target.value)}
                      placeholder="Ex: licitação"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Ideia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ideia
                    </label>
                    <textarea
                      value={ideiaSelecionada}
                      onChange={(e) => setIdeiaSelecionada(e.target.value)}
                      placeholder="Ex: Quando um órgão público lança uma disputa por um edital de licitação"
                      rows="3"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-indigo-500 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleTodaIdeia}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Toda Ideia
                    </button>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCancelarDivisao}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmarDivisao}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem de erro */}
            {erro && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{erro}</p>
                </div>
              </div>
            )}

            {/* Mensagem quando não há sugestões mas está digitando */}
            {mostrarSugestoes && sugestoes.length === 0 && !carregando && !erro && texto.trim() && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p>{t('lembranca.semSugestoes')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {t('lembranca.dica')}
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              {t('lembranca.fechar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LembrancaModal

