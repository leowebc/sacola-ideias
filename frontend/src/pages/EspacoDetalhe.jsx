import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'

function EspacoDetalhe() {
  const navigate = useNavigate()
  const { spaceId } = useParams()
  const {
    espacos,
    loadingWorkspace,
    savingWorkspace,
    selectedProjectId,
    criarProjeto,
    selecionarProjeto,
  } = useWorkspace()
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [novoProjetoNome, setNovoProjetoNome] = useState('')
  const [novoProjetoKanbanNome, setNovoProjetoKanbanNome] = useState('')

  const espaco = useMemo(
    () => espacos.find((item) => Number(item.id) === Number(spaceId)) || null,
    [espacos, spaceId],
  )

  async function handleCriarProjeto(event) {
    event.preventDefault()
    if (!espaco || !novoProjetoNome.trim()) {
      return
    }

    await criarProjeto({
      espaco_id: espaco.id,
      nome: novoProjetoNome.trim(),
      kanban_nome_inicial: novoProjetoKanbanNome.trim() || undefined,
    })
    setNovoProjetoNome('')
    setNovoProjetoKanbanNome('')
    setShowProjectForm(false)
  }

  if (loadingWorkspace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1800px] rounded-[2rem] border border-slate-200 bg-white/90 p-10 text-center text-slate-500 shadow-sm">
          Carregando espaço...
        </div>
      </div>
    )
  }

  if (!espaco) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1800px] rounded-[2rem] border border-dashed border-slate-200 bg-white/90 p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Espaço não encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">
            Volte para a lista de espaços e escolha um espaço válido.
          </p>
          <Link
            to="/app/espacos"
            className="mt-6 inline-flex rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Voltar para Espaços
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link to="/app/espacos" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Espaços
              </Link>
              <h1 className="mt-3 text-4xl font-bold text-slate-900">{espaco.nome}</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Aqui ficam os projetos deste espaço. Você pode criar vários projetos e depois usar o projeto ativo para filtrar cadastro, agenda e Kanban.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowProjectForm((current) => !current)}
                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25"
              >
                + Criar Projeto
              </button>
            </div>
          </div>

          {showProjectForm ? (
            <form onSubmit={handleCriarProjeto} className="mt-5 rounded-[1.5rem] border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <input
                  type="text"
                  value={novoProjetoNome}
                  onChange={(event) => setNovoProjetoNome(event.target.value)}
                  placeholder={`Novo projeto em ${espaco.nome}`}
                  className="w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <input
                  type="text"
                  value={novoProjetoKanbanNome}
                  onChange={(event) => setNovoProjetoKanbanNome(event.target.value)}
                  placeholder="Primeiro kanban (opcional)"
                  className="w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingWorkspace || !novoProjetoNome.trim()}
                    className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Salvar projeto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProjectForm(false)
                      setNovoProjetoNome('')
                      setNovoProjetoKanbanNome('')
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Projetos
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                {espaco.projetos?.length || 0} projeto{(espaco.projetos?.length || 0) === 1 ? '' : 's'}
              </h2>
            </div>

            <div className="space-y-2">
              {(espaco.projetos || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                  Crie o primeiro projeto deste espaço.
                </div>
              ) : (
                espaco.projetos.map((projeto) => {
                  const active = selectedProjectId === projeto.id
                  return (
                    <button
                      key={projeto.id}
                      type="button"
                      onClick={() => selecionarProjeto(projeto.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-100 hover:bg-slate-50'
                      }`}
                    >
                      <p className="truncate text-sm font-semibold">{projeto.nome}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {projeto.ideias_count} ideia{projeto.ideias_count === 1 ? '' : 's'} • {projeto.kanban_count} no Kanban
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">
                  Área do espaço
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedProjectId
                    ? espaco.projetos?.find((projeto) => projeto.id === selectedProjectId)?.nome || 'Projeto ativo'
                    : 'Selecione um projeto'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Depois de selecionar um projeto, você pode continuar no cadastro, agenda ou Kanban usando esse contexto.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/app/cadastro')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  Nova ideia
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/kanban')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  Abrir Kanban
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/agenda')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  Abrir Agenda
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(espaco.projetos || []).length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/70 p-8 text-sm text-slate-500">
                  Ainda não há projetos neste espaço.
                </div>
              ) : (
                espaco.projetos.map((projeto) => {
                  const active = selectedProjectId === projeto.id
                  return (
                    <article
                      key={projeto.id}
                      className={`rounded-[1.75rem] border p-5 shadow-sm transition-all ${
                        active
                          ? 'border-indigo-200 bg-indigo-50/70 shadow-indigo-100'
                          : 'border-slate-200 bg-white hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Projeto
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{projeto.nome}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => selecionarProjeto(projeto.id)}
                          className={`rounded-xl px-3 py-2 text-sm font-medium ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {active ? 'Ativo' : 'Selecionar'}
                        </button>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Ideias
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{projeto.ideias_count}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Kanban
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{projeto.kanban_count}</p>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default EspacoDetalhe
