import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SacolaAnimacao from '../components/SacolaAnimacao'
import AutocompleteInput from '../components/AutocompleteInput'
import LembrancaModal from '../components/LembrancaModal'
import IdeiaModal from '../components/IdeiaModal'
import { salvarIdeiaComEmbedding } from '../services/buscaService'
import { getApiKey } from '../utils/apiKey'
import { showDeleteConfirm, showError, showErrorToast, showSuccessToast } from '../utils/alerts'

function Cadastro() {
  const { t } = useTranslation()
  const [titulo, setTitulo] = useState('')
  const [tag, setTag] = useState('')
  const [ideia, setIdeia] = useState('')
  const [mostrarSucesso, setMostrarSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [titulosSugeridos, setTitulosSugeridos] = useState([])
  const [tagsSugeridas, setTagsSugeridas] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [imagemErro, setImagemErro] = useState(false)
  const [mostrarLembrancaModal, setMostrarLembrancaModal] = useState(false)
  const [ultimasIdeias, setUltimasIdeias] = useState([])
  const [carregandoUltimas, setCarregandoUltimas] = useState(true)
  const [ideiaSelecionada, setIdeiaSelecionada] = useState(null)
  const [mostrarModal, setMostrarModal] = useState(false)

  // Debug
  useEffect(() => {
    console.log('🔍 mostrarLembrancaModal:', mostrarLembrancaModal)
  }, [mostrarLembrancaModal])

  // Nota: A edição agora é feita diretamente no modal, então não precisamos mais
  // carregar ideias para editar aqui. Mas mantemos o código caso seja necessário.

  const obterTimestampIdeia = (ideia) => {
    const dataRaw = ideia?.data || ideia?.created_at || ideia?.createdAt
    const timestamp = dataRaw ? new Date(dataRaw).getTime() : NaN
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  const prepararUltimasIdeias = (ideias) => {
    if (!Array.isArray(ideias)) {
      return []
    }

    return [...ideias]
      .filter(Boolean)
      .sort((a, b) => obterTimestampIdeia(b) - obterTimestampIdeia(a))
      .slice(0, 6)
  }

  const carregarSugestoes = async () => {
    setCarregandoUltimas(true)
    try {
      const { buscarTodasIdeias } = await import('../services/dbService')
      const ideias = await buscarTodasIdeias()
      
      // Extrair títulos únicos
      const titulos = [...new Set(ideias.map(i => i.titulo).filter(Boolean))]
      setTitulosSugeridos(titulos)
      
      // Extrair tags únicas
      const tags = [...new Set(ideias.map(i => i.tag).filter(Boolean))]
      setTagsSugeridas(tags)

      setUltimasIdeias(prepararUltimasIdeias(ideias))
    } catch (error) {
      console.error('Erro ao carregar sugestões do banco:', error)
      // Fallback para localStorage ou arrays vazios
      try {
        const ideias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
        const titulos = [...new Set(ideias.map(i => i.titulo).filter(Boolean))]
        const tags = [...new Set(ideias.map(i => i.tag).filter(Boolean))]
        setTitulosSugeridos(titulos)
        setTagsSugeridas(tags)
        setUltimasIdeias(prepararUltimasIdeias(ideias))
      } catch (localError) {
        console.error('Erro ao carregar do localStorage:', localError)
        setTitulosSugeridos([])
        setTagsSugeridas([])
        setUltimasIdeias([])
      }
    } finally {
      setCarregandoUltimas(false)
    }
  }

  // Carregar sugestões de títulos e tags das ideias existentes
  useEffect(() => {
    carregarSugestoes()
  }, [])

  // Recarregar quando uma ideia for salva
  useEffect(() => {
    if (!mostrarSucesso) {
      return
    }

    const timer = setTimeout(() => {
      carregarSugestoes()
    }, 300)

    return () => clearTimeout(timer)
  }, [mostrarSucesso])

  const formatarData = (dataISO) => {
    if (!dataISO) return ''
    const data = new Date(dataISO)
    return data.toLocaleString('pt-BR', {
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

  const handleCloseModal = () => {
    setMostrarModal(false)
    setIdeiaSelecionada(null)
  }

  const handleEdit = (ideiaAtualizada) => {
    setIdeiaSelecionada(ideiaAtualizada)
    setUltimasIdeias(prev => prev.map(i => (i.id === ideiaAtualizada.id ? ideiaAtualizada : i)))
    carregarSugestoes()
  }

  const handleExcluir = async (ideia, e) => {
    if (e) {
      e.stopPropagation()
    }

    const result = await showDeleteConfirm(ideia.titulo || 'pensamento')
    if (!result.isConfirmed) {
      return
    }

    try {
      const { deletarIdeia } = await import('../services/dbService')
      await deletarIdeia(ideia.id)

      setUltimasIdeias(prev => prev.filter(i => i.id !== ideia.id))
      if (ideiaSelecionada && ideiaSelecionada.id === ideia.id) {
        handleCloseModal()
      }

      showSuccessToast('Pensamento excluído com sucesso!')
      carregarSugestoes()
    } catch (error) {
      console.error('Erro ao excluir ideia:', error)
      showErrorToast(`Erro ao excluir: ${error.message || 'tente novamente.'}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!titulo.trim() || !ideia.trim()) {
      return
    }

    setSalvando(true)

    try {
      let ideiaAtualizada
      if (editandoId) {
        // Editar ideia existente
        ideiaAtualizada = {
          id: editandoId,
          titulo: titulo.trim(),
          tag: tag.trim(),
          ideia: ideia.trim(),
          data: new Date().toISOString()
        }
        
        // Atualizar no localStorage (remover embedding antigo para regenerar)
        const ideiasExistentes = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
        const index = ideiasExistentes.findIndex(i => i.id === editandoId)
        if (index !== -1) {
          // Remove embedding para forçar regeneração
          delete ideiasExistentes[index].embedding
          ideiasExistentes[index] = ideiaAtualizada
          localStorage.setItem('sacola_ideias', JSON.stringify(ideiasExistentes))
        }
        
        // Obter API key e regenerar embedding
        const apiKey = getApiKey()
        if (apiKey) {
          try {
            const { gerarEmbedding } = await import('../services/buscaService')
            const textoCompleto = `${ideiaAtualizada.titulo} ${ideiaAtualizada.tag || ''} ${ideiaAtualizada.ideia}`.trim()
            const embedding = await gerarEmbedding(textoCompleto, apiKey)
            
            // Atualizar com novo embedding
            const todasIdeias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
            const idx = todasIdeias.findIndex(i => i.id === editandoId)
            if (idx !== -1) {
              todasIdeias[idx].embedding = embedding
              localStorage.setItem('sacola_ideias', JSON.stringify(todasIdeias))
            }
          } catch (error) {
            console.error('Erro ao gerar embedding para edição:', error)
          }
        }
        
        // Resetar modo de edição
        setEditandoId(null)
      } else {
        // Criar nova ideia
        ideiaAtualizada = {
          id: Date.now(),
          titulo: titulo.trim(),
          tag: tag.trim(),
          ideia: ideia.trim(),
          data: new Date().toISOString()
        }
        
        console.log('📝 [Cadastro] Salvando nova ideia:', ideiaAtualizada)
        
        // Backend gera embedding automaticamente
        const resultado = await salvarIdeiaComEmbedding(ideiaAtualizada, null)
        console.log('✅ [Cadastro] Ideia salva, resposta do backend:', resultado)
        
        // Verificar se a resposta contém um ID válido do banco
        if (resultado && resultado.id) {
          console.log('✅ [Cadastro] Ideia salva com ID do banco:', resultado.id)
          // Verificar se o ID é um número (ID do banco) ou timestamp (ID temporário)
          if (typeof resultado.id === 'number' && resultado.id > 1000000000000) {
            console.warn('⚠️ [Cadastro] ATENÇÃO: ID parece ser um timestamp, não um ID do banco!')
            console.warn('⚠️ [Cadastro] Isso indica que o backend pode não estar salvando corretamente.')
          }
        } else {
          console.error('❌ [Cadastro] ERRO CRÍTICO: Resposta do backend não contém ID válido!')
          console.error('❌ [Cadastro] Resposta completa:', JSON.stringify(resultado, null, 2))
          throw new Error('Backend não retornou ID válido. A ideia pode não ter sido salva no banco.')
        }
      }

      // Guardar valores antes de limpar (para animação)
      const tituloParaAnimacao = titulo
      const tagParaAnimacao = tag
      const ideiaParaAnimacao = ideia

      // Mostrar mensagem de sucesso PRIMEIRO
      setMostrarSucesso(true)
      
      // Aguardar animação completar antes de limpar formulário
      // A animação precisa dos valores, então mantemos um pouco mais
      setTimeout(() => {
        // Limpar formulário após animação ter iniciado
        setTitulo('')
        setTag('')
        setIdeia('')
      }, 4000) // Tempo para animação completa
      
      // Esconder mensagem de sucesso após animação
      setTimeout(() => {
        setMostrarSucesso(false)
      }, 3500)
    } catch (error) {
      console.error('Erro ao salvar ideia:', error)
      const mensagemErro = error.message || 'Erro desconhecido ao salvar ideia'
      showError(t('cadastro.error'), `${mensagemErro}\n\n${t('cadastro.errorDesc')}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-slide-in">
          <div className="inline-flex items-center justify-center mb-4">
            {/* Ícone de lâmpada 3D moderno */}
            {!imagemErro ? (
              <img
                src="/images/lampada.jpg"
                alt="Nova Ideia"
                width="140"
                height="140"
                className="drop-shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer"
                onError={() => setImagemErro(true)}
              />
            ) : (
              <div className="w-30 h-30 flex items-center justify-center drop-shadow-lg">
                <svg
                  width="140"
                  height="140"
                  viewBox="0 0 80 80"
                  className="drop-shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer"
                >
                  <rect
                    x="10"
                    y="10"
                    width="60"
                    height="60"
                    rx="12"
                    ry="12"
                    fill="white"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                  />
                  <ellipse
                    cx="40"
                    cy="28"
                    rx="11"
                    ry="13"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M 33 20 L 33 24 L 35 26 L 40 24 L 45 26 L 47 24 L 47 20"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                  <rect
                    x="31"
                    y="38"
                    width="18"
                    height="9"
                    rx="2"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                  />
                  <line x1="40" y1="15" x2="40" y2="8" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="3,2" opacity="0.8" />
                  <line x1="30" y1="20" x2="25" y2="16" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="3,2" opacity="0.8" />
                  <line x1="50" y1="20" x2="55" y2="16" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="3,2" opacity="0.8" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {editandoId ? t('cadastro.titleEdit') : t('cadastro.titleNew')}
          </h1>
          {editandoId ? (
            <p className="text-gray-500 text-lg">
              {t('cadastro.subtitleEdit')}
            </p>
          ) : (
            <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mt-2 mb-2 tracking-tight">
              {t('cadastro.subtitle')}
            </p>
          )}
          {editandoId && (
            <button
              onClick={() => {
                setEditandoId(null)
                setTitulo('')
                setTag('')
                setIdeia('')
              }}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t('cadastro.cancelar')}
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <div className="modern-card rounded-2xl p-8 animate-fade-in">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>{t('cadastro.titulo')}</span>
                    {titulosSugeridos.length > 0 && (
                      <span className="text-xs font-normal text-gray-400">
                        ({titulosSugeridos.length} {t('cadastro.tagSugestoes', { count: titulosSugeridos.length })})
                      </span>
                    )}
                  </span>
                </label>
                <AutocompleteInput
                  value={titulo}
                  onChange={setTitulo}
                  placeholder={t('cadastro.tituloPlaceholder')}
                  suggestions={titulosSugeridos}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>{t('cadastro.tag')}</span>
                    <span className="text-xs font-normal text-gray-400">(opcional)</span>
                    {tagsSugeridas.length > 0 && (
                      <span className="text-xs font-normal text-gray-400">
                        • {t('cadastro.tagSugestoes', { count: tagsSugeridas.length })}
                      </span>
                    )}
                  </span>
                </label>
                <AutocompleteInput
                  value={tag}
                  onChange={setTag}
                  placeholder="trabalho, pessoal, projeto..."
                  suggestions={tagsSugeridas}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>{t('cadastro.ideia')}</span>
                  </span>
                </label>
                <textarea
                  className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none resize-none"
                  rows="10"
                  placeholder={t('cadastro.ideiaPlaceholder')}
                  value={ideia}
                  onChange={(e) => setIdeia(e.target.value)}
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="modern-btn w-full px-6 py-4 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={salvando}
              >
                {salvando ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('cadastro.salvando')}</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t('cadastro.salvar')}</span>
                  </span>
                )}
              </button>

              {mostrarSucesso && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 animate-fade-in">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">{t('cadastro.success')}</p>
                      <p className="text-xs text-green-600">{t('cadastro.successDesc')}</p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Animação da Sacola + Últimos pensamentos */}
          <div className="relative animate-fade-in">
            {/* Imagem "esqueceu?" fora do quadro */}
            <div 
              className="absolute top-0 right-0 -translate-y-1/2 translate-x-0 sm:translate-x-1/2 group z-20"
              title={t('lembranca.tooltip')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('🔍 Clicou na imagem esqueceu?')
                  setMostrarLembrancaModal(true)
                }}
                className="p-0 border-0 bg-transparent cursor-pointer"
              >
                <img
                  src="/images/esqueceu.svg"
                  alt="Esqueceu?"
                  width="100"
                  height="100"
                  className="drop-shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer"
                  onError={(e) => {
                    console.error('Erro ao carregar imagem esqueceu.svg')
                    e.target.style.display = 'none'
                  }}
                />
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {t('lembranca.tooltip')}
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>

            <div className="modern-card rounded-2xl p-8 min-h-[500px] flex flex-col gap-6">
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Últimos pensamentos
                  </h2>
                  <span className="text-xs text-gray-400">
                    {ultimasIdeias.length}/6
                  </span>
                </div>

                {carregandoUltimas ? (
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="ai-loader-bars">
                      <span className="ai-loader-bar"></span>
                      <span className="ai-loader-bar"></span>
                      <span className="ai-loader-bar"></span>
                      <span className="ai-loader-bar"></span>
                    </span>
                    <span>Carregando pensamentos...</span>
                  </div>
                ) : ultimasIdeias.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Ainda não há pensamentos salvos.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ultimasIdeias.map((item, index) => (
                      <div
                        key={item.id || `${item.titulo || 'ideia'}-${item.data || index}`}
                        className="modern-card rounded-xl p-3 cursor-pointer transform hover:scale-[1.01] transition-all duration-200"
                        onClick={() => handleCardClick(item)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {item.titulo || 'Sem título'}
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleExcluir(item, e)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors text-xs font-medium flex items-center justify-center"
                              title="Excluir"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            {item.tag && (
                              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700">
                                {item.tag}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 text-[11px] text-gray-600 line-clamp-2">
                          {item.ideia || 'Sem descrição.'}
                        </p>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400">
                            {formatarData(item.data)}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCardClick(item)
                            }}
                            className="text-[11px] text-indigo-600 font-medium hover:text-indigo-700 flex items-center space-x-1"
                          >
                            <span>Clique para ver mais</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 w-full flex items-start justify-center">
                <SacolaAnimacao 
                  titulo={titulo}
                  tag={tag}
                  ideia={ideia}
                  mostrarSucesso={mostrarSucesso}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Lembrança */}
      <LembrancaModal 
        isOpen={mostrarLembrancaModal}
        onClose={() => setMostrarLembrancaModal(false)}
        onSugestaoSelecionada={(dados) => {
          try {
            // Se for um objeto, preencher título, tag e ideia
            if (typeof dados === 'object' && dados !== null) {
              if (dados.titulo) setTitulo(dados.titulo)
              if (dados.tag) setTag(dados.tag)
              if (dados.ideia) setIdeia(dados.ideia)
            } else {
              // Se for string, preencher apenas a ideia
              setIdeia(dados)
            }
            setMostrarLembrancaModal(false)
          } catch (error) {
            console.error('Erro ao processar sugestão selecionada:', error)
            setMostrarLembrancaModal(false)
          }
        }}
      />

      <IdeiaModal
        ideia={ideiaSelecionada}
        isOpen={mostrarModal}
        onClose={handleCloseModal}
        onEdit={handleEdit}
        titulosSugeridos={titulosSugeridos}
        tagsSugeridas={tagsSugeridas}
      />
    </div>
  )
}

export default Cadastro

