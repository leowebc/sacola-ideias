import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import IdeiaModal from '../components/IdeiaModal'
import { useWorkspace } from '../context/WorkspaceContext'
import { atualizarAgendaIdeia } from '../services/agendaService'
import { buscarTodasIdeias } from '../services/dbService'
import {
  atualizarCardKanban,
  atualizarKanbanStatus,
  buscarCardsKanban,
  buscarHistoricoKanban,
  criarCardKanban,
} from '../services/kanbanService'
import { showErrorToast, showSuccessToast } from '../utils/alerts'

const KANBAN_COLUMNS = [
  { id: 'novo', label: 'Novo', accent: 'from-slate-500 to-slate-700' },
  { id: 'verificando', label: 'Verificando', accent: 'from-amber-500 to-orange-600' },
  { id: 'em_producao', label: 'Em producao', accent: 'from-blue-500 to-indigo-600' },
  { id: 'teste', label: 'Teste', accent: 'from-violet-500 to-fuchsia-600' },
  { id: 'fechado', label: 'Fechado', accent: 'from-emerald-500 to-teal-600' },
]

function normalizeKanbanStatus(status) {
  return KANBAN_COLUMNS.some((column) => column.id === status) ? status : 'novo'
}

function buildBoardIdea(ideia) {
  return {
    ...ideia,
    item_type: 'ideia',
    board_key: `ideia:${ideia.id}`,
    conteudo: ideia.ideia,
    display_id: `I${ideia.id}`,
  }
}

function buildBoardCard(card) {
  return {
    ...card,
    item_type: 'card',
    board_key: `card:${card.id}`,
    conteudo: card.descricao,
    display_id: `C${card.id}`,
  }
}

function ordenarItensKanban(items) {
  return [...items].sort((a, b) => {
    const dataA = new Date(a.kanban_updated_at || a.updated_at || a.created_at || 0).getTime()
    const dataB = new Date(b.kanban_updated_at || b.updated_at || b.created_at || 0).getTime()
    return dataB - dataA
  })
}

function KanbanBoard() {
  const navigate = useNavigate()
  const { kanbanId } = useParams()
  const {
    kanbanOptions,
    loadingWorkspace,
    selecionarProjeto,
    carregarWorkspace,
  } = useWorkspace()

  const [ideias, setIdeias] = useState([])
  const [cardsKanban, setCardsKanban] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [draggedItemKey, setDraggedItemKey] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [ideiaSelecionada, setIdeiaSelecionada] = useState(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [kanbanHistory, setKanbanHistory] = useState([])
  const [loadingKanbanHistory, setLoadingKanbanHistory] = useState(false)
  const [agendandoIdeia, setAgendandoIdeia] = useState(false)
  const [addingColumnId, setAddingColumnId] = useState(null)
  const [novoCardTitulo, setNovoCardTitulo] = useState('')
  const [salvandoCardColumnId, setSalvandoCardColumnId] = useState(null)

  useEffect(() => {
    carregarQuadro()
  }, [kanbanId])

  const kanbanAtual = useMemo(
    () => kanbanOptions.find((item) => String(item.id) === String(kanbanId)) || null,
    [kanbanId, kanbanOptions],
  )

  const kanbansDoProjeto = useMemo(() => {
    if (!kanbanAtual) {
      return []
    }

    return kanbanOptions.filter((item) => Number(item.projeto_id) === Number(kanbanAtual.projeto_id))
  }, [kanbanAtual, kanbanOptions])

  useEffect(() => {
    if (kanbanAtual?.projeto_id) {
      selecionarProjeto(kanbanAtual.projeto_id)
    }
  }, [kanbanAtual, selecionarProjeto])

  const sugestoes = useMemo(() => {
    const titulos = [...new Set(ideias.map((ideia) => ideia.titulo).filter(Boolean))]
    const tags = [...new Set(ideias.map((ideia) => ideia.tag).filter(Boolean))]

    return { titulos, tags }
  }, [ideias])

  const ideiasVisiveis = useMemo(
    () =>
      ideias.filter(
        (ideia) =>
          Number(ideia.kanban_id) === Number(kanbanId)
          && Boolean(ideia.kanban_ativo),
      ),
    [ideias, kanbanId],
  )

  const itensDoKanban = useMemo(
    () =>
      ordenarItensKanban([
        ...ideiasVisiveis.map(buildBoardIdea),
        ...cardsKanban.map(buildBoardCard),
      ]),
    [cardsKanban, ideiasVisiveis],
  )

  async function carregarQuadro() {
    setCarregando(true)
    try {
      const [resultadoIdeias, resultadoCards] = await Promise.all([
        buscarTodasIdeias(),
        buscarCardsKanban(kanbanId),
      ])
      setIdeias(
        resultadoIdeias.map((ideia) => ({
          ...ideia,
          kanban_status: normalizeKanbanStatus(ideia.kanban_status),
          kanban_ativo: Boolean(ideia.kanban_ativo),
        })),
      )
      setCardsKanban(
        resultadoCards.map((card) => ({
          ...card,
          kanban_status: normalizeKanbanStatus(card.kanban_status),
        })),
      )
    } catch (error) {
      console.error('Erro ao carregar quadro do Kanban:', error)
      showErrorToast(error.message || 'Nao foi possivel carregar o quadro do kanban.')
      setCardsKanban([])
    } finally {
      setCarregando(false)
    }
  }

  async function carregarHistoricoKanban(ideiaId) {
    setLoadingKanbanHistory(true)
    try {
      const historico = await buscarHistoricoKanban(ideiaId)
      setKanbanHistory(historico)
      return historico
    } catch (error) {
      console.error('Erro ao carregar historico do Kanban:', error)
      setKanbanHistory([])
      return []
    } finally {
      setLoadingKanbanHistory(false)
    }
  }

  function abrirIdeia(ideia) {
    setIdeiaSelecionada(ideia)
    setMostrarModal(true)
    setKanbanHistory([])
    carregarHistoricoKanban(ideia.id)
  }

  function fecharModal() {
    setMostrarModal(false)
    setIdeiaSelecionada(null)
    setKanbanHistory([])
  }

  function handleEditIdeia(ideiaAtualizada) {
    setIdeias((estadoAtual) =>
      estadoAtual.map((ideia) =>
        ideia.id === ideiaAtualizada.id
          ? {
              ...ideia,
              ...ideiaAtualizada,
              kanban_ativo: Boolean(ideiaAtualizada.kanban_ativo ?? ideia.kanban_ativo),
              kanban_status: normalizeKanbanStatus(
                ideiaAtualizada.kanban_status || ideia.kanban_status,
              ),
            }
          : ideia,
      ),
    )

    setIdeiaSelecionada((atual) => (
      atual && atual.id === ideiaAtualizada.id
        ? { ...atual, ...ideiaAtualizada }
        : atual
    ))

    carregarWorkspace()
  }

  async function handleScheduleIdea(ideia, payload) {
    setAgendandoIdeia(true)
    try {
      const ideiaAtualizada = await atualizarAgendaIdeia(ideia.id, payload)
      handleEditIdeia(ideiaAtualizada)
      showSuccessToast(payload.agenda_data ? 'Agenda da ideia atualizada!' : 'Agenda removida da ideia.')
      return ideiaAtualizada
    } catch (error) {
      console.error('Erro ao atualizar agenda da ideia:', error)
      showErrorToast(error.message || 'Nao foi possivel atualizar a agenda da ideia.')
      throw error
    } finally {
      setAgendandoIdeia(false)
    }
  }

  async function handleAdicionarCard(columnId) {
    if (!kanbanAtual?.id || !novoCardTitulo.trim()) {
      return
    }

    setSalvandoCardColumnId(columnId)
    try {
      const cardCriado = await criarCardKanban(Number(kanbanAtual.id), {
        titulo: novoCardTitulo.trim(),
        kanban_status: columnId,
      })
      setCardsKanban((estadoAtual) => [
        {
          ...cardCriado,
          kanban_status: normalizeKanbanStatus(cardCriado.kanban_status),
        },
        ...estadoAtual,
      ])

      await carregarWorkspace()
      setNovoCardTitulo('')
      setAddingColumnId(null)
      showSuccessToast(`Card criado em "${KANBAN_COLUMNS.find((item) => item.id === columnId)?.label}".`)
    } catch (error) {
      console.error('Erro ao criar card no kanban:', error)
      showErrorToast(error.message || 'Nao foi possivel criar o card neste kanban.')
    } finally {
      setSalvandoCardColumnId(null)
    }
  }

  async function moverItem(boardKey, novoStatus) {
    const statusFinal = normalizeKanbanStatus(novoStatus)
    const itemOriginal = itensDoKanban.find((item) => item.board_key === boardKey)

    if (!itemOriginal || itemOriginal.kanban_status === statusFinal) {
      return
    }

    const agora = new Date().toISOString()

    try {
      if (itemOriginal.item_type === 'card') {
        setCardsKanban((estadoAtual) =>
          estadoAtual.map((card) =>
            card.id === itemOriginal.id
              ? {
                  ...card,
                  kanban_status: statusFinal,
                  updated_at: agora,
                }
              : card,
          ),
        )

        const cardAtualizado = await atualizarCardKanban(itemOriginal.id, {
          kanban_status: statusFinal,
        })

        setCardsKanban((estadoAtual) =>
          estadoAtual.map((card) =>
            card.id === itemOriginal.id
              ? {
                  ...card,
                  ...cardAtualizado,
                  kanban_status: normalizeKanbanStatus(cardAtualizado.kanban_status),
                }
              : card,
          ),
        )
      } else {
        const estadoAnterior = ideias
        setIdeias((estadoAtual) =>
          estadoAtual.map((ideia) =>
            ideia.id === itemOriginal.id
              ? {
                  ...ideia,
                  kanban_status: statusFinal,
                  kanban_updated_at: agora,
                }
              : ideia,
          ),
        )

        try {
          const ideiaAtualizada = await atualizarKanbanStatus(itemOriginal.id, statusFinal)
          setIdeias((estadoAtual) =>
            estadoAtual.map((ideia) =>
              ideia.id === itemOriginal.id
                ? {
                    ...ideia,
                    ...ideiaAtualizada,
                    kanban_ativo: Boolean(ideiaAtualizada.kanban_ativo ?? ideia.kanban_ativo),
                    kanban_status: normalizeKanbanStatus(ideiaAtualizada.kanban_status),
                  }
                : ideia,
            ),
          )
        } catch (error) {
          setIdeias(estadoAnterior)
          throw error
        }
      }

      showSuccessToast(`Cartao movido para "${KANBAN_COLUMNS.find((item) => item.id === statusFinal)?.label}".`)
    } catch (error) {
      console.error('Erro ao mover cartao:', error)
      await carregarQuadro()
      showErrorToast(error.message || 'Nao foi possivel mover o cartao.')
    }
  }

  function handleDragStart(boardKey) {
    setDraggedItemKey(boardKey)
  }

  function handleDragEnd() {
    setDraggedItemKey(null)
    setDragOverColumn(null)
  }

  function handleDrop(columnId) {
    if (draggedItemKey == null) {
      return
    }

    moverItem(draggedItemKey, columnId)
    handleDragEnd()
  }

  function itensDaColuna(columnId) {
    return itensDoKanban.filter(
      (item) => normalizeKanbanStatus(item.kanban_status) === columnId,
    )
  }

  if (loadingWorkspace && !kanbanAtual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white/90 p-10 text-center text-slate-500 shadow-sm">
          Carregando kanban...
        </div>
      </div>
    )
  }

  if (!kanbanAtual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white/90 p-10 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Kanban nao encontrado</h1>
          <p className="mt-3 text-slate-600">
            O quadro solicitado nao existe mais ou nao esta disponivel no workspace atual.
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/kanban')}
            className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Voltar para a lista de kanbans
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate('/app/kanban')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Voltar para kanbans
              </button>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
                Quadro
              </p>
              <h1 className="text-3xl font-bold text-slate-900">{kanbanAtual.nome}</h1>
              <p className="mt-2 text-slate-600">
                {kanbanAtual.espaco_nome} / {kanbanAtual.projeto_nome}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ideias vinculadas entram em Novo. Cards criados aqui ficam salvos no proprio kanban.
              </p>
            </div>

            <button
              onClick={carregarQuadro}
              className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
            >
              Atualizar quadro
            </button>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {kanbansDoProjeto.map((kanban) => (
              <button
                key={kanban.id}
                type="button"
                onClick={() => navigate(`/app/kanban/${kanban.id}`)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  Number(kanban.id) === Number(kanbanAtual.id)
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                }`}
              >
                {kanban.nome}
              </button>
            ))}
          </div>
        </section>

        {carregando ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 shadow-sm">
            Carregando quadro...
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
            {KANBAN_COLUMNS.map((column) => {
              const cards = itensDaColuna(column.id)
              const isActiveDrop = dragOverColumn === column.id

              return (
                <section
                  key={column.id}
                  className={`rounded-2xl border transition-all ${
                    isActiveDrop
                      ? 'border-indigo-400 bg-indigo-50/70 shadow-lg shadow-indigo-100'
                      : 'border-slate-200 bg-white/90'
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverColumn(column.id)
                  }}
                  onDragLeave={() => setDragOverColumn((atual) => (atual === column.id ? null : atual))}
                  onDrop={() => handleDrop(column.id)}
                >
                  <header className={`rounded-t-2xl bg-gradient-to-r px-4 py-4 text-white ${column.accent}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{column.label}</h2>
                        <p className="text-xs text-white/80">Fluxo do kanban</p>
                      </div>
                      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/20 px-2 text-sm font-semibold">
                        {cards.length}
                      </span>
                    </div>
                  </header>

                  <div className="border-b border-slate-100 bg-white px-3 py-3">
                    {addingColumnId === column.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={novoCardTitulo}
                          onChange={(event) => setNovoCardTitulo(event.target.value)}
                          placeholder="Titulo do card"
                          autoFocus
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingColumnId(null)
                              setNovoCardTitulo('')
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdicionarCard(column.id)}
                            disabled={salvandoCardColumnId === column.id || !novoCardTitulo.trim()}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {salvandoCardColumnId === column.id ? 'Salvando...' : 'Adicionar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingColumnId(column.id)
                          setNovoCardTitulo('')
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <span>Adicionar card</span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-base leading-none">
                          +
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="min-h-[420px] space-y-3 p-3">
                    {cards.length === 0 ? (
                      <div className="flex min-h-[180px] h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm text-slate-400">
                        Solte um card aqui
                      </div>
                    ) : (
                      cards.map((item) => (
                        <article
                          key={item.board_key}
                          draggable
                          onDragStart={() => handleDragStart(item.board_key)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (item.item_type === 'ideia') {
                              abrirIdeia(item)
                            }
                          }}
                          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                            item.item_type === 'ideia' ? 'cursor-pointer' : 'cursor-default'
                          } ${
                            draggedItemKey === item.board_key ? 'rotate-1 scale-[0.98] opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="leading-snug font-semibold text-slate-900">{item.titulo}</h3>
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                              {item.display_id}
                            </span>
                          </div>

                          {item.item_type === 'ideia' && item.tag ? (
                            <span className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {item.tag}
                            </span>
                          ) : null}

                          {item.item_type === 'card' ? (
                            <span className="mt-3 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                              Card do kanban
                            </span>
                          ) : null}

                          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">
                            {item.conteudo || 'Card criado direto no quadro.'}
                          </p>

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
                            <span className="font-medium text-indigo-600">
                              {item.item_type === 'ideia' ? 'Clique para ver detalhes' : 'Card nativo do kanban'}
                            </span>
                            <span className="text-slate-400">
                              Arraste para mover
                            </span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <IdeiaModal
        ideia={ideiaSelecionada}
        isOpen={mostrarModal}
        onClose={fecharModal}
        onEdit={handleEditIdeia}
        onScheduleIdea={handleScheduleIdea}
        agendandoIdeia={agendandoIdeia}
        kanbanHistory={kanbanHistory}
        loadingKanbanHistory={loadingKanbanHistory}
        showKanbanDetails
        titulosSugeridos={sugestoes.titulos}
        tagsSugeridas={sugestoes.tags}
      />
    </div>
  )
}

export default KanbanBoard
