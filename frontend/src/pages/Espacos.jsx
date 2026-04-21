import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'

function Espacos() {
  const navigate = useNavigate()
  const {
    espacos,
    loadingWorkspace,
    savingWorkspace,
    selectedProjectId,
    criarEspaco,
    excluirEspaco,
    criarProjeto,
    renomearEspaco,
    selecionarProjeto,
  } = useWorkspace()
  const [showSpaceForm, setShowSpaceForm] = useState(false)
  const [novoEspacoNome, setNovoEspacoNome] = useState('')
  const [quickProjectSpaceId, setQuickProjectSpaceId] = useState(null)
  const [novoProjetoNome, setNovoProjetoNome] = useState('')
  const [novoProjetoKanbanNome, setNovoProjetoKanbanNome] = useState('')
  const [menuEspacoId, setMenuEspacoId] = useState(null)
  const [editingSpaceId, setEditingSpaceId] = useState(null)
  const [edicaoEspacoNome, setEdicaoEspacoNome] = useState('')

  const espacosOrdenados = useMemo(
    () => [...espacos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [espacos],
  )

  async function handleCriarEspaco(event) {
    event.preventDefault()
    if (!novoEspacoNome.trim()) {
      return
    }

    const espaco = await criarEspaco({ nome: novoEspacoNome.trim() })
    setNovoEspacoNome('')
    setShowSpaceForm(false)
    navigate(`/app/espacos/${espaco.id}`)
  }

  async function handleCriarProjeto(event) {
    event.preventDefault()
    if (!quickProjectSpaceId || !novoProjetoNome.trim()) {
      return
    }

    await criarProjeto({
      espaco_id: quickProjectSpaceId,
      nome: novoProjetoNome.trim(),
      kanban_nome_inicial: novoProjetoKanbanNome.trim() || undefined,
    })
    setNovoProjetoNome('')
    setNovoProjetoKanbanNome('')
    setQuickProjectSpaceId(null)
    navigate(`/app/espacos/${quickProjectSpaceId}`)
  }

  function iniciarRenomeacao(espaco) {
    setEditingSpaceId(espaco.id)
    setEdicaoEspacoNome(espaco.nome)
    setMenuEspacoId(null)
  }

  async function handleRenomearEspaco(event, espacoId) {
    event.preventDefault()
    if (!edicaoEspacoNome.trim()) {
      return
    }

    await renomearEspaco(espacoId, { nome: edicaoEspacoNome.trim() })
    setEditingSpaceId(null)
    setEdicaoEspacoNome('')
  }

  async function handleExcluirEspaco(espaco) {
    setMenuEspacoId(null)
    const confirmed = window.confirm(
      `Excluir o espaço "${espaco.nome}"? Os projetos dele serão removidos e as ideias vinculadas ficarão sem projeto.`,
    )
    if (!confirmed) {
      return
    }

    await excluirEspaco(espaco.id)
    if (editingSpaceId === espaco.id) {
      setEditingSpaceId(null)
      setEdicaoEspacoNome('')
    }
    if (quickProjectSpaceId === espaco.id) {
      setQuickProjectSpaceId(null)
      setNovoProjetoNome('')
      setNovoProjetoKanbanNome('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
                Workspace
              </p>
              <h1 className="mt-2 text-4xl font-bold text-slate-900">Espaços</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Crie um novo espaço para organizar seus contextos. Dentro de cada espaço você poderá criar um ou vários projetos e depois ligar as ideias ao projeto certo.
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">
                Contexto ativo
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedProjectId ? 'Um projeto está selecionado no workspace.' : 'Nenhum projeto selecionado.'}
              </p>
            </div>
          </div>
        </section>

        {loadingWorkspace ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-10 text-center text-slate-500 shadow-sm">
            Carregando espaços...
          </div>
        ) : (
          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Seus espaços</h2>
                <p className="text-sm text-slate-500">
                  Clique em um espaço para abrir a área dele e criar projetos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSpaceForm((current) => !current)}
                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25"
              >
                Novo Espaço
              </button>
            </div>

            {showSpaceForm ? (
              <form onSubmit={handleCriarEspaco} className="mb-6 rounded-[1.5rem] border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="text"
                    value={novoEspacoNome}
                    onChange={(event) => setNovoEspacoNome(event.target.value)}
                    placeholder="Nome do novo espaço"
                    className="w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingWorkspace || !novoEspacoNome.trim()}
                      className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSpaceForm(false)
                        setNovoEspacoNome('')
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setShowSpaceForm(true)}
                className="group flex min-h-[240px] flex-col justify-between rounded-[1.75rem] border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-6 text-left transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl font-light text-indigo-600 shadow-sm">
                  +
                </div>
                <div>
                  <h3 className="text-3xl font-semibold text-slate-900">Novo Espaço</h3>
                  <p className="mt-3 text-sm text-slate-500">
                    Comece um novo agrupador para seus projetos, times ou contextos.
                  </p>
                </div>
              </button>

              {espacosOrdenados.map((espaco) => (
                <article
                  key={espaco.id}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Espaço
                      </p>
                      {editingSpaceId === espaco.id ? (
                        <form onSubmit={(event) => handleRenomearEspaco(event, espaco.id)} className="mt-2 space-y-3">
                          <input
                            type="text"
                            value={edicaoEspacoNome}
                            onChange={(event) => setEdicaoEspacoNome(event.target.value)}
                            className="w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Novo nome do espaço"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={savingWorkspace || !edicaoEspacoNome.trim()}
                              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpaceId(null)
                                setEdicaoEspacoNome('')
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <h3 className="mt-2 truncate text-3xl font-semibold text-slate-900">{espaco.nome}</h3>
                      )}
                    </div>

                    <div className="relative flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/espacos/${espaco.id}`)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Abrir
                      </button>

                      <button
                        type="button"
                        onClick={() => setMenuEspacoId((current) => (current === espaco.id ? null : espaco.id))}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        aria-label={`Abrir ações do espaço ${espaco.nome}`}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                        </svg>
                      </button>

                      {menuEspacoId === espaco.id ? (
                        <div className="absolute right-0 top-12 z-10 min-w-[170px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
                          <button
                            type="button"
                            onClick={() => iniciarRenomeacao(espaco)}
                            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirEspaco(espaco)}
                            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Projetos
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {espaco.projetos?.length || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Kanban
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {(espaco.projetos || []).reduce((acc, projeto) => acc + Number(projeto.kanban_count || 0), 0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Projetos deste espaço</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickProjectSpaceId(espaco.id)
                          setNovoProjetoNome('')
                          setNovoProjetoKanbanNome('')
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        + Criar Projeto
                      </button>
                    </div>

                    {quickProjectSpaceId === espaco.id ? (
                      <form onSubmit={handleCriarProjeto} className="mt-3 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
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
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={savingWorkspace || !novoProjetoNome.trim()}
                            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Salvar projeto
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickProjectSpaceId(null)
                              setNovoProjetoNome('')
                              setNovoProjetoKanbanNome('')
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {(espaco.projetos || []).length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhum projeto criado ainda.</p>
                      ) : (
                        espaco.projetos.slice(0, 3).map((projeto) => (
                          <button
                            key={projeto.id}
                            type="button"
                            onClick={() => {
                              selecionarProjeto(projeto.id)
                              navigate(`/app/espacos/${espaco.id}`)
                            }}
                            className="flex w-full items-center justify-between rounded-2xl border border-white bg-white px-4 py-3 text-left hover:border-indigo-100 hover:bg-indigo-50/50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{projeto.nome}</p>
                              <p className="text-xs text-slate-400">
                                {projeto.ideias_count} ideia{projeto.ideias_count === 1 ? '' : 's'}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                              #{projeto.id}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default Espacos
