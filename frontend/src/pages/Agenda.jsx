import { useEffect, useMemo, useState } from 'react'
import IdeiaModal from '../components/IdeiaModal'
import { useWorkspace } from '../context/WorkspaceContext'
import { atualizarAgendaIdeia } from '../services/agendaService'
import { buscarTodasIdeias } from '../services/dbService'
import { buscarHistoricoKanban } from '../services/kanbanService'
import { showErrorToast, showSuccessToast } from '../utils/alerts'

const VIEW_OPTIONS = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date) {
  const next = startOfDay(date)
  const day = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - day)
  return next
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function formatDateKey(dateValue) {
  const date = new Date(dateValue)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateInputValue(date) {
  return formatDateKey(date)
}

function buildVisibleDays(referenceDate, viewMode) {
  if (viewMode === 'day') {
    return [startOfDay(referenceDate)]
  }

  if (viewMode === 'week') {
    const firstDay = startOfWeek(referenceDate)
    return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index))
  }

  const firstDay = startOfMonth(referenceDate)
  const lastDay = endOfMonth(referenceDate)
  const days = []
  let cursor = new Date(firstDay)

  while (cursor <= lastDay) {
    days.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }

  return days
}

function Agenda() {
  const { selectedProjectId, selectedProject, selectedSpace } = useWorkspace()
  const [viewMode, setViewMode] = useState('month')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [ideias, setIdeias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [ideiaSelecionada, setIdeiaSelecionada] = useState(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [agendandoIdeia, setAgendandoIdeia] = useState(false)
  const [kanbanHistory, setKanbanHistory] = useState([])
  const [loadingKanbanHistory, setLoadingKanbanHistory] = useState(false)

  useEffect(() => {
    carregarIdeias()
  }, [])

  const titulosSugeridos = useMemo(
    () => [...new Set(ideias.map((ideia) => ideia.titulo).filter(Boolean))],
    [ideias],
  )

  const tagsSugeridas = useMemo(
    () => [...new Set(ideias.map((ideia) => ideia.tag).filter(Boolean))],
    [ideias],
  )

  const ideiasComAgenda = useMemo(
    () =>
      ideias
        .filter((ideia) => (
          !selectedProjectId || Number(ideia.projeto_id) === Number(selectedProjectId)
        ))
        .filter((ideia) => Boolean(ideia.agenda_data))
        .sort((a, b) => new Date(a.agenda_data).getTime() - new Date(b.agenda_data).getTime()),
    [ideias, selectedProjectId],
  )

  const visibleDays = useMemo(
    () => buildVisibleDays(selectedDate, viewMode),
    [selectedDate, viewMode],
  )

  const secoes = useMemo(() => {
    const sections = visibleDays.map((date) => {
      const key = formatDateKey(date)
      const items = ideiasComAgenda.filter((ideia) => formatDateKey(ideia.agenda_data) === key)
      return {
        key,
        date,
        items,
      }
    })

    return viewMode === 'month'
      ? sections.filter((section) => section.items.length > 0)
      : sections
  }, [visibleDays, ideiasComAgenda, viewMode])

  const rotuloPeriodo = useMemo(() => {
    if (viewMode === 'day') {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(selectedDate)
    }

    if (viewMode === 'week') {
      const first = visibleDays[0]
      const last = visibleDays[visibleDays.length - 1]
      return `${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(first)} - ${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(last)}`
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(selectedDate)
  }, [selectedDate, viewMode, visibleDays])

  async function carregarIdeias() {
    setCarregando(true)
    try {
      const resultado = await buscarTodasIdeias()
      setIdeias(resultado)
    } catch (error) {
      console.error('Erro ao carregar agenda:', error)
      showErrorToast(error.message || 'Nao foi possivel carregar a agenda.')
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

  function atualizarIdeiaLocal(ideiaAtualizada) {
    setIdeias((estadoAtual) =>
      estadoAtual.map((ideia) => (ideia.id === ideiaAtualizada.id ? { ...ideia, ...ideiaAtualizada } : ideia)),
    )

    setIdeiaSelecionada((atual) => (
      atual && atual.id === ideiaAtualizada.id
        ? { ...atual, ...ideiaAtualizada }
        : atual
    ))
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

  async function handleScheduleIdea(ideia, payload) {
    setAgendandoIdeia(true)
    try {
      const ideiaAtualizada = await atualizarAgendaIdeia(ideia.id, payload)
      atualizarIdeiaLocal(ideiaAtualizada)
      showSuccessToast(payload.agenda_data ? 'Previsao de entrega atualizada!' : 'Previsao removida da ideia.')
      return ideiaAtualizada
    } catch (error) {
      console.error('Erro ao atualizar agenda da ideia:', error)
      showErrorToast(error.message || 'Nao foi possivel atualizar a previsao da ideia.')
      throw error
    } finally {
      setAgendandoIdeia(false)
    }
  }

  function navegarPeriodo(direction) {
    if (viewMode === 'day') {
      setSelectedDate((current) => addDays(current, direction))
      return
    }

    if (viewMode === 'week') {
      setSelectedDate((current) => addDays(current, direction * 7))
      return
    }

    setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  function formatarCabecalhoSecao(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(date)
  }

  function formatarHorario(dateValue) {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateValue))
  }

  const gridClass = viewMode === 'day'
    ? 'grid-cols-1'
    : viewMode === 'week'
      ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'
      : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
                Agenda
              </p>
              <h1 className="text-3xl font-bold text-slate-900">Previsoes de entrega das ideias</h1>
              <p className="mt-2 text-slate-600">
                Visualize tudo o que foi agendado por dia, semana ou mes e abra a ideia para ajustar prazo e Kanban.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {selectedProject
                  ? `Projeto ativo: ${selectedSpace?.nome || selectedProject.espaco_nome} / ${selectedProject.nome}`
                  : 'Projeto ativo: todas as ideias sem filtro'}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="inline-flex rounded-2xl border border-amber-100 bg-amber-50/70 p-1">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setViewMode(option.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === option.id
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navegarPeriodo(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date())}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => navegarPeriodo(1)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-lg font-semibold text-slate-800 capitalize">{rotuloPeriodo}</p>
            <input
              type="date"
              value={formatDateInputValue(selectedDate)}
              onChange={(event) => {
                const [year, month, day] = event.target.value.split('-').map(Number)
                setSelectedDate(new Date(year, month - 1, day, 12))
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {carregando ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 shadow-sm">
            Carregando agenda...
          </div>
        ) : secoes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-white/85 p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Nenhuma previsao neste periodo</h2>
            <p className="mt-2 text-sm text-slate-500">
              Abra uma ideia e use o icone de calendario para definir a previsao de entrega.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${gridClass}`}>
            {secoes.map((section) => (
              <section
                key={section.key}
                className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-500">
                      {formatarCabecalhoSecao(section.date)}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {section.items.length} agendamento{section.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {section.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-400">
                    Nenhuma ideia programada para este dia.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {section.items.map((ideia) => (
                      <article
                        key={ideia.id}
                        onClick={() => abrirIdeia(ideia)}
                        className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-slate-900">
                              {ideia.titulo}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-amber-600">
                              {formatarHorario(ideia.agenda_data)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {ideia.tag ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                                {ideia.tag}
                              </span>
                            ) : null}
                            {ideia.kanban_ativo ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                {String(ideia.kanban_status || 'novo').replaceAll('_', ' ')}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
                          {ideia.ideia}
                        </p>

                        {ideia.agenda_observacao ? (
                          <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
                            {ideia.agenda_observacao}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <IdeiaModal
        ideia={ideiaSelecionada}
        isOpen={mostrarModal}
        onClose={fecharModal}
        onEdit={atualizarIdeiaLocal}
        onScheduleIdea={handleScheduleIdea}
        agendandoIdeia={agendandoIdeia}
        kanbanHistory={kanbanHistory}
        loadingKanbanHistory={loadingKanbanHistory}
        titulosSugeridos={titulosSugeridos}
        tagsSugeridas={tagsSugeridas}
      />
    </div>
  )
}

export default Agenda
