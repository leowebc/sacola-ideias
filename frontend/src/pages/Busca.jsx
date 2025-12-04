import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { buscarPorSimilaridade } from '../services/buscaService'
import IdeiaModal from '../components/IdeiaModal'
// API Key é gerenciada pelo backend, não precisa no frontend
import { showDeleteConfirm, showSuccessToast, showErrorToast } from '../utils/alerts'

function Busca() {
  const { t, i18n } = useTranslation()
  const [termoBusca, setTermoBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [apiKey, setApiKey] = useState(null) // Backend gerencia API Key, não precisa no frontend
  const [ideiaSelecionada, setIdeiaSelecionada] = useState(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [titulosSugeridos, setTitulosSugeridos] = useState([])
  const [tagsSugeridas, setTagsSugeridas] = useState([])
  const timeoutRef = useRef(null)

  useEffect(() => {
    // Backend gerencia API Key, sempre assume que busca semântica está disponível
    setApiKey(true) // Indica que busca semântica pode estar ativa (backend decide)

    // Carregar todas as ideias inicialmente
    carregarIdeias()
    carregarSugestoes().catch(err => console.error('Erro ao carregar sugestões:', err))
  }, [])

  const carregarSugestoes = async () => {
    try {
      const { buscarTodasIdeias } = await import('../services/dbService')
      const ideias = await buscarTodasIdeias()
      
      // Extrair títulos únicos
      const titulos = [...new Set(ideias.map(i => i.titulo).filter(Boolean))]
      setTitulosSugeridos(titulos)
      
      // Extrair tags únicas
      const tags = [...new Set(ideias.map(i => i.tag).filter(Boolean))]
      setTagsSugeridas(tags)
    } catch (error) {
      console.log('Erro ao carregar sugestões:', error)
      // Em caso de erro, não carregar sugestões (deixar vazio)
      setTitulosSugeridos([])
      setTagsSugeridas([])
    }
  }

  const carregarIdeias = async () => {
    try {
      const { buscarTodasIdeias } = await import('../services/dbService')
      const ideias = await buscarTodasIdeias()
      setResultados(ideias.map(ideia => ({ ideia, similaridade: null })))
      // Limpar localStorage quando conseguir buscar do banco
      localStorage.removeItem('sacola_ideias')
    } catch (error) {
      console.error('Erro ao carregar ideias:', error)
      // Limpar localStorage quando houver erro para não mostrar dados antigos
      localStorage.removeItem('sacola_ideias')
      // Mostrar vazio
      setResultados([])
    }
  }

  const handleBusca = async (e) => {
    const termo = e.target.value
    setTermoBusca(termo)

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (!termo.trim()) {
      await carregarIdeias()
      return
    }

    // Debounce: aguardar 500ms após parar de digitar
    setBuscando(true)
    timeoutRef.current = setTimeout(async () => {
      try {
        // Backend gera embedding automaticamente, não precisa de API Key no frontend
        const resultadosBusca = await buscarPorSimilaridade(termo, null)
        setResultados(resultadosBusca)
      } catch (error) {
        console.error('Erro na busca:', error)
        // Não usar fallback - mostrar vazio quando houver erro
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 500)
  }

  const formatarData = (dataISO) => {
    const data = new Date(dataISO)
    const locale = (i18n.language || 'pt-BR').replace('_', '-')
    return data.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCardClick = (ideia) => {
    setIdeiaSelecionada(ideia)
    setMostrarModal(true)
  }

  const handleEdit = (ideiaAtualizada) => {
    // Atualizar ideia selecionada no modal (para mostrar os dados atualizados)
    setIdeiaSelecionada(ideiaAtualizada)
    
    // Atualizar resultados se estiver em modo de busca
    if (termoBusca.trim()) {
      // Recarregar busca para atualizar resultados
      setTimeout(() => {
        handleBusca({ target: { value: termoBusca } })
      }, 100)
    } else {
      // Atualizar lista de resultados
      setResultados(prev => prev.map(r => {
        const ideia = r.ideia || r
        if (ideia.id === ideiaAtualizada.id) {
          return { ideia: ideiaAtualizada, similaridade: r.similaridade }
        }
        return r
      }))
    }
    
    // Recarregar sugestões
    carregarSugestoes()
  }

  const handleCopy = () => {
    // Feedback visual já está no modal
  }

  const handleExcluir = async (ideia, e) => {
    // Parar propagação do evento para não abrir o modal
    e.stopPropagation()
    
    const result = await showDeleteConfirm(ideia.titulo, {
      title: t('busca.excluirConfirmTitle'),
      html: t('busca.excluirConfirmHtml', { titulo: ideia.titulo }),
      confirmButtonText: t('busca.excluirConfirmYes'),
      cancelButtonText: t('busca.excluirConfirmNo')
    })
    
    if (!result.isConfirmed) {
      return
    }

    try {
      const { deletarIdeia } = await import('../services/dbService')
      await deletarIdeia(ideia.id)
      
      // Remover do estado local
      setResultados(prev => prev.filter(r => {
        const i = r.ideia || r
        return i.id !== ideia.id
      }))
      
      // Recarregar lista completa se não houver termo de busca
      if (!termoBusca.trim()) {
        await carregarIdeias()
      }
      
      // Recarregar sugestões
      await carregarSugestoes()
      
      // Se estava editando essa ideia, fechar modal
      if (ideiaSelecionada && ideiaSelecionada.id === ideia.id) {
        setMostrarModal(false)
        setIdeiaSelecionada(null)
      }
      
      showSuccessToast(t('busca.excluirSuccess'))
    } catch (error) {
      console.error('Erro ao excluir ideia:', error)
      showErrorToast(`${t('busca.excluirError')}: ${error.message}`)
    }
  }

  const handleCloseModal = () => {
    setMostrarModal(false)
    setIdeiaSelecionada(null)
  }

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12 animate-slide-in">
          <div>
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/images/lupa.jpg"
                alt={t('busca.title')}
                width="140"
                height="140"
                className="drop-shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer"
              />
            </div>
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('busca.title')}
            </h1>
            <p className="text-gray-500 text-lg">{t('busca.subtitle')}</p>
          </div>
        </div>
        

        <div className="modern-card rounded-2xl p-6 mb-8 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>{t('busca.searchLabel')}</span>
              </span>
            </label>
            <div className={`relative futuristic-input-wrapper ${termoBusca ? 'active' : ''}`}>
              {/* Grid digital de fundo */}
              <div className="digital-grid-bg"></div>
              
              {/* Partículas flutuantes */}
              {termoBusca && (
                <div className="particle-container">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="particle"
                      style={{
                        left: `${(i * 12.5) % 100}%`,
                        top: `${20 + (i * 15) % 60}%`,
                        animationDelay: `${i * 0.2}s`,
                        '--tx': `${(Math.random() - 0.5) * 20}px`,
                        '--ty': `${(Math.random() - 0.5) * 30}px`,
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Linha de scan */}
              {termoBusca && <div className="scan-line"></div>}
              
              <input
                type="text"
                placeholder={t('busca.inputPlaceholder')}
                className="modern-input w-full px-4 py-4 rounded-xl bg-gray-50 focus:bg-white focus:outline-none pr-12 text-lg relative z-10 transition-all duration-300"
                style={{
                  borderColor: termoBusca ? '#6366f1' : '#e2e8f0',
                  boxShadow: termoBusca 
                    ? '0 0 20px rgba(99, 102, 241, 0.2), 0 0 40px rgba(139, 92, 246, 0.1)' 
                    : 'none',
                }}
                value={termoBusca}
                onChange={handleBusca}
              />
              {buscando && (
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
                  <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              )}
            </div>
            {termoBusca && (
              <p className="mt-2 text-sm text-indigo-600 font-medium flex items-center space-x-1">
                {/* Preloader de barras futurístico */}
                <span className="ai-loader-bars">
                  <span className="ai-loader-bar"></span>
                  <span className="ai-loader-bar"></span>
                  <span className="ai-loader-bar"></span>
                  <span className="ai-loader-bar"></span>
                </span>
                <span>{t('busca.aiAtivada')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {resultados.length === 0 ? (
            <div className="modern-card rounded-xl p-8 text-center">
              <div className="flex flex-col items-center space-y-4">
                {termoBusca ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-lg text-gray-600">
                      {t('busca.semResultadosTermo')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900 mb-2">
                        {t('busca.semResultadosTitulo')}
                      </p>
                      <p className="text-gray-500">
                        {t('busca.semResultadosHint')}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-base-content/60 mb-4 flex justify-between items-center">
                <span>
                  {t('busca.resultCount', { count: resultados.length })}
                </span>
                {termoBusca && resultados[0]?.similaridade !== null && resultados[0]?.similaridade !== undefined && (
                  <span className="badge badge-primary">
                    {t('busca.ordenadoSimilaridade')}
                  </span>
                )}
              </div>
              {resultados.map((resultado) => {
                const ideia = resultado.ideia || resultado
                const similaridade = resultado.similaridade !== undefined ? resultado.similaridade : null
                return (
                <div 
                  key={ideia.id} 
                  className="modern-card rounded-xl p-6 cursor-pointer transform hover:scale-[1.02] transition-all duration-200"
                  onClick={() => handleCardClick(ideia)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {ideia.titulo}
                    </h2>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={(e) => handleExcluir(ideia, e)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors text-sm font-medium flex items-center justify-center"
                        title={t('busca.excluirIdeia')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {similaridade !== null && similaridade !== undefined && (
                        <div className="tooltip" data-tip={t('busca.similaridade', { percent: (similaridade * 100).toFixed(1) })}>
                          <div className="badge badge-success badge-lg">
                            {(similaridade * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                      {ideia.tag && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700">
                          {ideia.tag}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3 line-clamp-3">
                    {ideia.ideia}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {formatarData(ideia.data)}
                    </p>
                    <span className="text-xs text-indigo-600 font-medium flex items-center space-x-1">
                      <span>{t('busca.cliqueVerMais')}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Modal de Visualização/Edição */}
      <IdeiaModal
        ideia={ideiaSelecionada}
        isOpen={mostrarModal}
        onClose={handleCloseModal}
        onEdit={handleEdit}
        onCopy={handleCopy}
        titulosSugeridos={titulosSugeridos}
        tagsSugeridas={tagsSugeridas}
      />
    </div>
  )
}

export default Busca

