import { useEffect, useMemo, useState } from 'react'
import AutocompleteInput from './AutocompleteInput'
import { useWorkspace } from '../context/WorkspaceContext'
import { showErrorToast } from '../utils/alerts'

const KANBAN_STATUS_LABELS = {
  novo: 'Novo',
  verificando: 'Verificando',
  em_producao: 'Em producao',
  teste: 'Teste',
  fechado: 'Fechado',
}

function formatarData(dataISO) {
  if (!dataISO) {
    return 'Sem data definida'
  }

  const data = new Date(dataISO)
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarStatusKanban(status) {
  if (!status) {
    return 'Sem status'
  }

  return KANBAN_STATUS_LABELS[status] || status.replaceAll('_', ' ')
}

function IdeiaModal({
  ideia,
  isOpen,
  onClose,
  onEdit,
  onCopy,
  onScheduleIdea,
  agendandoIdeia = false,
  kanbanHistory = [],
  loadingKanbanHistory = false,
  showKanbanDetails = false,
  titulosSugeridos = [],
  tagsSugeridas = [],
  compactActions = false,
  initialAction = null,
}) {
  const { projectOptions, vincularIdeiaAoProjeto } = useWorkspace()
  const [copied, setCopied] = useState(false)
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [tag, setTag] = useState('')
  const [texto, setTexto] = useState('')
  const [agendaData, setAgendaData] = useState('')
  const [agendaObservacao, setAgendaObservacao] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [kanbanId, setKanbanId] = useState('')
  const [salvandoProjeto, setSalvandoProjeto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [acaoAtiva, setAcaoAtiva] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'unset'
      setEditando(false)
      setShowActionsMenu(false)
      setAcaoAtiva(null)
      return
    }

    document.body.style.overflow = 'hidden'
    if (ideia) {
      setTitulo(ideia.titulo || '')
      setTag(ideia.tag || '')
      setTexto(ideia.ideia || '')
      setAgendaData(ideia.agenda_data ? ideia.agenda_data.slice(0, 16) : '')
      setAgendaObservacao(ideia.agenda_observacao || '')
      setProjetoId(ideia.projeto_id ? String(ideia.projeto_id) : '')
      setKanbanId(ideia.kanban_id ? String(ideia.kanban_id) : '')
      setEditando(false)
      setShowActionsMenu(false)
      setAcaoAtiva(
        compactActions
          ? (initialAction === 'kanban' ? 'project' : initialAction)
          : null,
      )
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [compactActions, ideia, initialAction, isOpen])

  const projetoSelecionado = useMemo(
    () => projectOptions.find((option) => String(option.id) === String(projetoId || '')) || null,
    [projectOptions, projetoId],
  )

  const kanbanOptions = projetoSelecionado?.kanbans || []
  const kanbanSelecionado = kanbanOptions.find(
    (option) => String(option.id) === String(kanbanId || ''),
  ) || null

  const projetoFoiAlterado = String(projetoId || '') !== String(ideia?.projeto_id || '')
  const kanbanFoiAlterado = String(kanbanId || '') !== String(ideia?.kanban_id || '')

  const detalhesKanban = useMemo(() => {
    if (!showKanbanDetails || !ideia?.kanban_ativo) {
      return []
    }

    const itens = [
      {
        label: 'Kanban',
        value: ideia.kanban_nome || 'Kanban principal',
      },
      {
        label: 'Status no funil',
        value: formatarStatusKanban(ideia.kanban_status),
      },
      {
        label: 'Data do card',
        value: formatarData(ideia.agenda_data),
      },
      {
        label: 'Ultima mudanca',
        value: formatarData(ideia.kanban_updated_at || ideia.updated_at || ideia.data),
      },
      {
        label: 'Criada em',
        value: formatarData(ideia.data),
      },
    ]

    if (ideia.agenda_observacao) {
      itens.push({
        label: 'Observacao da agenda',
        value: ideia.agenda_observacao,
      })
    }

    return itens
  }, [ideia, showKanbanDetails])

  if (!isOpen || !ideia) {
    return null
  }

  function handleProjetoChange(value) {
    setProjetoId(value)

    const projeto = projectOptions.find((option) => String(option.id) === String(value)) || null
    const primeiroKanban = projeto?.kanbans?.[0]
    setKanbanId(primeiroKanban ? String(primeiroKanban.id) : '')
  }

  async function handleCopy() {
    const textoParaCopiar = editando ? texto : (ideia?.ideia || '')

    try {
      await navigator.clipboard.writeText(textoParaCopiar)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      showErrorToast('Erro ao copiar. Tente novamente.')
    }

    if (onCopy) {
      onCopy()
    }
  }

  async function handleSalvarEdicao() {
    if (!titulo.trim() || !texto.trim()) {
      return
    }

    setSalvando(true)

    try {
      const { atualizarIdeia } = await import('../services/dbService')
      const ideiaSalva = await atualizarIdeia(ideia.id, {
        titulo: titulo.trim(),
        tag: tag.trim(),
        ideia: texto.trim(),
      })

      setEditando(false)
      setTitulo(ideiaSalva.titulo || '')
      setTag(ideiaSalva.tag || '')
      setTexto(ideiaSalva.ideia || '')

      if (onEdit) {
        onEdit(ideiaSalva)
      }
    } catch (error) {
      console.error('Erro ao salvar edicao:', error)
      showErrorToast('Erro ao salvar edicao. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  function handleCancelarEdicao() {
    setEditando(false)
    setTitulo(ideia.titulo || '')
    setTag(ideia.tag || '')
    setTexto(ideia.ideia || '')
    setAgendaData(ideia.agenda_data ? ideia.agenda_data.slice(0, 16) : '')
    setAgendaObservacao(ideia.agenda_observacao || '')
    setProjetoId(ideia.projeto_id ? String(ideia.projeto_id) : '')
    setKanbanId(ideia.kanban_id ? String(ideia.kanban_id) : '')
  }

  async function handleSalvarProjetoKanban() {
    const projetoAtualId = projetoId ? Number(projetoId) : null

    if (projetoAtualId && !kanbanSelecionado) {
      showErrorToast('Escolha um kanban valido para vincular o card.')
      return
    }

    setSalvandoProjeto(true)
    try {
      const ideiaAtualizada = await vincularIdeiaAoProjeto(
        ideia.id,
        projetoAtualId,
        kanbanSelecionado ? Number(kanbanSelecionado.id) : null,
      )

      if (onEdit) {
        onEdit(ideiaAtualizada)
      }

      if (compactActions) {
        setAcaoAtiva(null)
      }
    } catch (error) {
      console.error('Erro ao atualizar projeto da ideia:', error)
    } finally {
      setSalvandoProjeto(false)
    }
  }

  async function handleSalvarAgenda() {
    if (!onScheduleIdea) {
      return
    }

    try {
      await onScheduleIdea(ideia, {
        agenda_data: agendaData ? new Date(agendaData).toISOString() : null,
        agenda_observacao: agendaObservacao.trim() || null,
      })

      if (compactActions) {
        setAcaoAtiva(null)
      }
    } catch (error) {
      console.error('Erro ao salvar agenda:', error)
    }
  }

  async function handleRemoverAgenda() {
    if (!onScheduleIdea) {
      return
    }

    try {
      await onScheduleIdea(ideia, {
        agenda_data: null,
        agenda_observacao: null,
      })
      setAgendaData('')
      setAgendaObservacao('')

      if (compactActions) {
        setAcaoAtiva(null)
      }
    } catch (error) {
      console.error('Erro ao remover agenda:', error)
    }
  }

  function handleAbrirAcao(acao) {
    setShowActionsMenu(false)
    setAcaoAtiva(acao)
  }

  function renderProjectKanbanFields(isCompact = false) {
    return (
      <div className={isCompact ? 'mt-6 space-y-4' : 'space-y-4'}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Vinculo atual
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {ideia.projeto_nome
              ? `${ideia.espaco_nome ? `${ideia.espaco_nome} / ` : ''}${ideia.projeto_nome}`
              : 'Sem projeto'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ideia.kanban_nome || 'Sem kanban'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Projeto
            </label>
            <select
              value={projetoId}
              onChange={(event) => handleProjetoChange(event.target.value)}
              className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Sem projeto</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.espaco_nome} / {option.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Kanban
            </label>
            <select
              value={kanbanId}
              onChange={(event) => setKanbanId(event.target.value)}
              disabled={!projetoSelecionado}
              className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {projetoSelecionado ? 'Selecione um kanban' : 'Escolha um projeto primeiro'}
              </option>
              {kanbanOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {projetoSelecionado
                ? 'Ao salvar, o card ja entra no kanban selecionado.'
                : 'Selecione um projeto para carregar os kanbans.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {isCompact ? (
            <button
              type="button"
              onClick={() => setAcaoAtiva(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSalvarProjetoKanban}
            disabled={salvandoProjeto || (!projetoFoiAlterado && !kanbanFoiAlterado)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvandoProjeto ? 'Salvando...' : 'Salvar projeto'}
          </button>
        </div>
      </div>
    )
  }

  function renderAgendaFields(isCompact = false) {
    return (
      <div className={isCompact ? 'mt-6 space-y-4' : 'space-y-4'}>
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Data e hora
            </label>
            <input
              type="datetime-local"
              value={agendaData}
              onChange={(event) => setAgendaData(event.target.value)}
              className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observacao
            </label>
            <textarea
              value={agendaObservacao}
              onChange={(event) => setAgendaObservacao(event.target.value)}
              rows="4"
              className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-slate-700 resize-none focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ex: revisar esse ponto na proxima reuniao"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          {ideia.agenda_data ? (
            <button
              type="button"
              onClick={handleRemoverAgenda}
              disabled={agendandoIdeia}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remover agenda
            </button>
          ) : null}
          {isCompact ? (
            <button
              type="button"
              onClick={() => setAcaoAtiva(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSalvarAgenda}
            disabled={agendandoIdeia}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {agendandoIdeia ? 'Salvando...' : 'Salvar agenda'}
          </button>
        </div>
      </div>
    )
  }

  function renderHistory() {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/70 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Historico do Kanban</h3>
            <p className="text-sm text-slate-500">
              Cada mudanca de etapa fica registrada neste card.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
            {kanbanHistory.length} registro{kanbanHistory.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingKanbanHistory ? (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-white/80 px-4 py-6 text-sm text-slate-500">
            Carregando historico...
          </div>
        ) : kanbanHistory.length > 0 ? (
          <div className="space-y-3">
            {kanbanHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.de_status
                        ? `${formatarStatusKanban(item.de_status)} -> ${formatarStatusKanban(item.para_status)}`
                        : `Entrada em ${formatarStatusKanban(item.para_status)}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatarData(item.moved_at)}
                    </p>
                  </div>
                  {item.observacao ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {item.observacao}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-white/80 px-4 py-6 text-sm text-slate-500">
            Nenhuma movimentacao registrada ainda.
          </div>
        )}
      </div>
    )
  }

  const title = acaoAtiva === 'agenda' ? 'Agenda' : 'Projeto vinculado'
  const description = acaoAtiva === 'agenda'
    ? 'Defina ou ajuste a data de acompanhamento desta ideia.'
    : 'Escolha em qual projeto e kanban este card deve ficar.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !editando) {
          onClose()
        }
      }}
    >
      <div className="modern-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            {editando ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Titulo</label>
                  <AutocompleteInput
                    value={titulo}
                    onChange={setTitulo}
                    placeholder="Titulo da ideia"
                    suggestions={titulosSugeridos.filter((item) => item !== ideia.titulo)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Tag</label>
                  <AutocompleteInput
                    value={tag}
                    onChange={setTag}
                    placeholder="Tag (opcional)"
                    suggestions={tagsSugeridas.filter((item) => item !== ideia.tag && item)}
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="mb-2 text-3xl font-bold text-gray-900">
                  {ideia.titulo}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {ideia.tag ? (
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-3 py-1 text-sm font-medium text-indigo-700">
                      {ideia.tag}
                    </span>
                  ) : null}
                  {ideia.projeto_nome ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                      {ideia.projeto_nome}
                    </span>
                  ) : null}
                  {ideia.kanban_nome ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                      {ideia.kanban_nome}
                    </span>
                  ) : null}
                  {ideia.kanban_ativo && ideia.kanban_status ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                      {formatarStatusKanban(ideia.kanban_status)}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {!editando ? (
            <div className="ml-4 flex items-center gap-2">
              {compactActions ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActionsMenu((current) => !current)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    aria-label="Abrir acoes da ideia"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                    </svg>
                  </button>

                  {showActionsMenu ? (
                    <div className="absolute right-0 top-12 z-10 min-w-[210px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
                      <button
                        type="button"
                        onClick={() => handleAbrirAcao('project')}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Projeto vinculado
                      </button>
                      {onScheduleIdea ? (
                        <button
                          type="button"
                          onClick={() => handleAbrirAcao('agenda')}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {ideia.agenda_data ? 'Editar agenda' : 'Agendar'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                onClick={onClose}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              >
                <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-6">
          {editando ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Ideia / Anotacao</label>
              <textarea
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                className="modern-input w-full resize-none rounded-xl bg-gray-50 px-4 py-3 focus:bg-white focus:outline-none"
                rows="10"
                placeholder="Escreva sua ideia ou anotacao aqui..."
                required
              />
            </div>
          ) : (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-700">
                {ideia.ideia}
              </p>
            </div>
          )}
        </div>

        {!editando && detalhesKanban.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Detalhes do card</h3>
                <p className="text-sm text-slate-500">
                  As informacoes do quadro aparecem aqui quando a ideia ja esta em um kanban.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                Card #{ideia.id}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {detalhesKanban.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!editando && !compactActions ? (
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-sky-50/70 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Projeto vinculado</h3>
                <p className="text-sm text-slate-500">
                  Escolha o projeto e o kanban onde este card deve ficar.
                </p>
              </div>
            </div>
            {renderProjectKanbanFields()}
          </div>
        ) : null}

        {!editando && onScheduleIdea && !compactActions ? (
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/70 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Agenda</h3>
                <p className="text-sm text-slate-500">
                  Defina uma data para revisar ou acompanhar esta ideia depois.
                </p>
              </div>
              {ideia.agenda_data ? (
                <span className="inline-flex items-center rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-medium text-indigo-700">
                  Agendada
                </span>
              ) : null}
            </div>
            {renderAgendaFields()}
          </div>
        ) : null}

        {!editando && showKanbanDetails && ideia.kanban_ativo && !compactActions ? renderHistory() : null}

        <div className="flex flex-wrap justify-end gap-3">
          {!editando ? (
            <>
              <button
                onClick={handleCopy}
                className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-all ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copiar</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setEditando(true)}
                className="flex items-center space-x-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 font-medium text-white transition-all hover:shadow-lg hover:shadow-indigo-500/30"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Editar</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCancelarEdicao}
                className="flex items-center space-x-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-all hover:bg-gray-200"
                disabled={salvando}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancelar</span>
              </button>

              <button
                onClick={handleSalvarEdicao}
                className="flex items-center space-x-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 font-medium text-white transition-all hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={salvando || !titulo.trim() || !texto.trim()}
              >
                {salvando ? (
                  <>
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {compactActions && acaoAtiva ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) {
              setAcaoAtiva(null)
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">
                  Acao da ideia
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcaoAtiva(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {acaoAtiva === 'project' ? renderProjectKanbanFields(true) : null}
            {acaoAtiva === 'agenda' ? renderAgendaFields(true) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default IdeiaModal
