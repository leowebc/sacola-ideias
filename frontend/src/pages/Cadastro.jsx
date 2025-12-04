import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SacolaAnimacao from '../components/SacolaAnimacao'
import AutocompleteInput from '../components/AutocompleteInput'
import { salvarIdeiaComEmbedding } from '../services/buscaService'
import { getApiKey } from '../utils/apiKey'
import { showError } from '../utils/alerts'

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

  // Nota: A edição agora é feita diretamente no modal, então não precisamos mais
  // carregar ideias para editar aqui. Mas mantemos o código caso seja necessário.

  // Carregar sugestões de títulos e tags das ideias existentes
  useEffect(() => {
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
        console.log('Erro ao carregar sugestões do banco, usando localStorage:', error)
        // Fallback para localStorage
        const ideias = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
        const titulos = [...new Set(ideias.map(i => i.titulo).filter(Boolean))]
        const tags = [...new Set(ideias.map(i => i.tag).filter(Boolean))]
        setTitulosSugeridos(titulos)
        setTagsSugeridas(tags)
      }
    }

    carregarSugestoes()
    
    // Recarregar quando uma ideia for salva
    if (mostrarSucesso) {
      setTimeout(() => {
        carregarSugestoes()
      }, 300)
    }
  }, [mostrarSucesso])

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

          {/* Animação da Sacola */}
          <div className="modern-card rounded-2xl p-8 flex items-center justify-center min-h-[500px] animate-fade-in">
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
  )
}

export default Cadastro

