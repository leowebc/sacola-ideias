import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'

function Kanban() {
  const navigate = useNavigate()
  const {
    espacos,
    loadingWorkspace,
    savingWorkspace,
    selectedProject,
    kanbanOptions,
    criarKanban,
    selecionarProjeto,
  } = useWorkspace()

  const [novoKanbanNome, setNovoKanbanNome] = useState('')
  const [espacoId, setEspacoId] = useState('')
  const [projetoId, setProjetoId] = useState('')

  useEffect(() => {
    if (selectedProject) {
      setEspacoId(String(selectedProject.espaco_id))
      setProjetoId(String(selectedProject.id))
      return
    }

    if (espacos.length > 0 && !espacoId) {
      const primeiroEspaco = espacos[0]
      setEspacoId(String(primeiroEspaco.id))
      setProjetoId(primeiroEspaco.projetos?.[0]?.id ? String(primeiroEspaco.projetos[0].id) : '')
    }
  }, [espacoId, espacos, selectedProject])

  const espacoSelecionado = useMemo(
    () => espacos.find((espaco) => String(espaco.id) === String(espacoId)) || null,
    [espacoId, espacos],
  )

  const projetosDoEspaco = espacoSelecionado?.projetos || []

  useEffect(() => {
    if (!espacoSelecionado) {
      setProjetoId('')
      return
    }

    const projetoExiste = projetosDoEspaco.some((projeto) => String(projeto.id) === String(projetoId))
    if (!projetoExiste) {
      setProjetoId(projetosDoEspaco[0]?.id ? String(projetosDoEspaco[0].id) : '')
    }
  }, [espacoSelecionado, projetoId, projetosDoEspaco])

  const projetoSelecionado = useMemo(
    () => projetosDoEspaco.find((projeto) => String(projeto.id) === String(projetoId)) || null,
    [projetoId, projetosDoEspaco],
  )

  const kanbansVisiveis = useMemo(() => {
    if (projetoSelecionado) {
      return projetoSelecionado.kanbans || []
    }

    if (!espacoSelecionado) {
      return []
    }

    return kanbanOptions.filter((kanban) => Number(kanban.espaco_id) === Number(espacoSelecionado.id))
  }, [espacoSelecionado, kanbanOptions, projetoSelecionado])

  async function handleCriarKanban(event) {
    event.preventDefault()
    if (!projetoSelecionado?.id || !novoKanbanNome.trim()) {
      return
    }

    await criarKanban({
      projeto_id: projetoSelecionado.id,
      nome: novoKanbanNome.trim(),
    })

    selecionarProjeto(projetoSelecionado.id)
    setNovoKanbanNome('')
  }

  function handleSelecionarEspaco(value) {
    setEspacoId(value)
  }

  function handleSelecionarProjeto(value) {
    setProjetoId(value)
    selecionarProjeto(value ? Number(value) : null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Kanban
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Criar e organizar kanbans
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Nesta tela voce cria o kanban escolhendo espaco e projeto. Depois basta clicar em um card de kanban para abrir o quadro completo com as colunas.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Contexto
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {espacoSelecionado?.nome || 'Espaco'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {projetoSelecionado
                ? `Projeto selecionado: ${projetoSelecionado.nome}`
                : 'Escolha um projeto para listar os kanbans.'}
            </p>
            <p className="mt-4 text-sm text-slate-500">
              {kanbansVisiveis.length} kanban(s) visivel(is)
            </p>
          </aside>

          <div className="space-y-6">
            <form
              onSubmit={handleCriarKanban}
              className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Nome do kanban
                  </label>
                  <input
                    type="text"
                    value={novoKanbanNome}
                    onChange={(event) => setNovoKanbanNome(event.target.value)}
                    placeholder="Ex: Kanban 1"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Espaco
                  </label>
                  <select
                    value={espacoId}
                    onChange={(event) => handleSelecionarEspaco(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Selecione um espaco</option>
                    {espacos.map((espaco) => (
                      <option key={espaco.id} value={espaco.id}>
                        {espaco.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Projeto
                  </label>
                  <select
                    value={projetoId}
                    onChange={(event) => handleSelecionarProjeto(event.target.value)}
                    disabled={!espacoSelecionado}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">Selecione um projeto</option>
                    {projetosDoEspaco.map((projeto) => (
                      <option key={projeto.id} value={projeto.id}>
                        {projeto.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingWorkspace || !projetoSelecionado?.id || !novoKanbanNome.trim()}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingWorkspace ? 'Criando...' : 'Criar kanban'}
                  </button>
                </div>
              </div>
            </form>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">
                    Kanbans
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {projetoSelecionado?.nome || 'Selecione um projeto'}
                  </h2>
                </div>
                {loadingWorkspace ? (
                  <span className="text-sm text-slate-400">Carregando...</span>
                ) : null}
              </div>

              {kanbansVisiveis.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-500">
                  Nenhum kanban criado para este filtro ainda.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {kanbansVisiveis.map((kanban) => (
                    <button
                      key={kanban.id}
                      type="button"
                      onClick={() => navigate(`/app/kanban/${kanban.id}`)}
                      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {kanban.espaco_nome || espacoSelecionado?.nome || 'Espaco'}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">
                        {kanban.nome}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {kanban.projeto_nome || projetoSelecionado?.nome || 'Projeto'}
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                        <span className="font-medium text-indigo-600">
                          Abrir quadro
                        </span>
                        <span className="text-slate-400">
                          {kanban.cards_count || 0} card(s)
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Kanban
