import { useState, useEffect } from 'react'
import AutocompleteInput from './AutocompleteInput'
import { showErrorToast } from '../utils/alerts'

function IdeiaModal({ ideia, isOpen, onClose, onEdit, onCopy, titulosSugeridos = [], tagsSugeridas = [] }) {
  const [copied, setCopied] = useState(false)
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [tag, setTag] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Carregar dados da ideia quando modal abrir
      if (ideia) {
        setTitulo(ideia.titulo || '')
        setTag(ideia.tag || '')
        setTexto(ideia.ideia || '')
        setEditando(false)
      }
    } else {
      document.body.style.overflow = 'unset'
      setEditando(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, ideia])

  if (!isOpen || !ideia) return null

  const formatarData = (dataISO) => {
    const data = new Date(dataISO)
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCopy = async () => {
    // Copiar apenas o texto da ideia (textarea) - não incluir título nem tag
    const textoParaCopiar = editando ? texto : (ideia?.ideia || '')
    
    try {
      await navigator.clipboard.writeText(textoParaCopiar)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      // Fallback para método antigo
      try {
        const textarea = document.createElement('textarea')
        textarea.value = textoParaCopiar
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error('Erro no fallback de cópia:', fallbackError)
        showErrorToast('Erro ao copiar. Tente selecionar o texto manualmente.')
      }
    }
    
    if (onCopy) {
      onCopy()
    }
  }

  const handleEdit = () => {
    setEditando(true)
  }

  const handleCancelarEdicao = () => {
    setEditando(false)
    // Restaurar valores originais
    if (ideia) {
      setTitulo(ideia.titulo || '')
      setTag(ideia.tag || '')
      setTexto(ideia.ideia || '')
    }
  }

  const handleSalvarEdicao = async () => {
    if (!titulo.trim() || !texto.trim()) {
      return
    }

    setSalvando(true)

    try {
      const ideiaAtualizada = {
        titulo: titulo.trim(),
        tag: tag.trim(),
        ideia: texto.trim()
      }

      // Tentar salvar no banco primeiro
      try {
        const { atualizarIdeia } = await import('../services/dbService')
        
        // Atualizar ideia no banco
        const ideiaSalva = await atualizarIdeia(ideia.id, ideiaAtualizada)

        // Backend regenera embedding automaticamente ao atualizar a ideia

        // Sair do modo de edição
        setEditando(false)
        
        // Atualizar dados do modal
        setTitulo(ideiaSalva.titulo)
        setTag(ideiaSalva.tag)
        setTexto(ideiaSalva.ideia)
        
        // Atualizar ideia no callback
        if (onEdit) {
          onEdit(ideiaSalva)
        }
      } catch (apiError) {
        console.log('API não disponível, salvando em localStorage:', apiError)
        
        // Fallback para localStorage
        const ideiasExistentes = JSON.parse(localStorage.getItem('sacola_ideias') || '[]')
        const index = ideiasExistentes.findIndex(i => i.id === ideia.id)
        
        if (index !== -1) {
          const ideiaLocal = {
            ...ideiasExistentes[index],
            ...ideiaAtualizada,
            data: new Date().toISOString()
          }

          delete ideiaLocal.embedding
          ideiasExistentes[index] = ideiaLocal
          localStorage.setItem('sacola_ideias', JSON.stringify(ideiasExistentes))

          // Embedding não é mais usado no localStorage (backend gerencia)

          setEditando(false)
          setTitulo(ideiaLocal.titulo)
          setTag(ideiaLocal.tag)
          setTexto(ideiaLocal.ideia)
          
          if (onEdit) {
            onEdit(ideiaLocal)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error)
      showErrorToast('Erro ao salvar edição. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const handleOverlayClick = (e) => {
    // Não fechar se estiver editando
    if (e.target === e.currentTarget && !editando) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="modern-card rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-in shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            {editando ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Título</label>
                  <AutocompleteInput
                    value={titulo}
                    onChange={setTitulo}
                    placeholder="Título da ideia"
                    suggestions={titulosSugeridos.filter(t => t !== ideia.titulo)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tag</label>
                  <AutocompleteInput
                    value={tag}
                    onChange={setTag}
                    placeholder="Tag (opcional)"
                    suggestions={tagsSugeridas.filter(t => t !== ideia.tag && t)}
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {ideia.titulo}
                </h2>
                {ideia.tag && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700">
                    {ideia.tag}
                  </span>
                )}
              </>
            )}
          </div>
          {!editando && (
            <button
              onClick={onClose}
              className="ml-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mb-6">
          {editando ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ideia / Anotação</label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none resize-none"
                rows="10"
                placeholder="Escreva sua ideia ou anotação aqui..."
                required
              />
            </div>
          ) : (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">
                {ideia.ideia}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Criada em {formatarData(ideia.data)}
          </p>
          
          <div className="flex items-center space-x-3">
            {!editando ? (
              <>
                <button
                  onClick={handleCopy}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleEdit}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Editar</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancelarEdicao}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                  disabled={salvando}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancelar</span>
                </button>
                
                <button
                  onClick={handleSalvarEdicao}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando || !titulo.trim() || !texto.trim()}
                >
                  {salvando ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Salvar</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IdeiaModal

