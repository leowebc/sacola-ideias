import { useEffect, useState } from 'react'

const KANBAN_COLOR_PRESETS = [
  '#4F46E5',
  '#0F766E',
  '#EA580C',
  '#DC2626',
  '#9333EA',
  '#0891B2',
  '#65A30D',
  '#111827',
]

function createChecklistItem(titulo = '') {
  return {
    id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    titulo,
    concluido: false,
  }
}

function normalizeChecklist(checklist = []) {
  return checklist.map((item) => ({
    id: item.id || createChecklistItem().id,
    titulo: item.titulo || '',
    concluido: Boolean(item.concluido),
  }))
}

function KanbanEditModal({
  isOpen,
  kanban,
  saving = false,
  onClose,
  onSave,
  onOpenBoard,
}) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState('#4F46E5')
  const [checklist, setChecklist] = useState([])

  useEffect(() => {
    if (!isOpen || !kanban) {
      setNome('')
      setDescricao('')
      setCor('#4F46E5')
      setChecklist([])
      return
    }

    setNome(kanban.nome || '')
    setDescricao(kanban.descricao || '')
    setCor(kanban.cor || '#4F46E5')
    setChecklist(normalizeChecklist(kanban.checklist || []))
  }, [isOpen, kanban?.id])

  if (!isOpen || !kanban) {
    return null
  }

  const totalChecklist = checklist.length
  const checklistConcluido = checklist.filter((item) => item.concluido).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="border-b border-slate-200 px-6 py-5 md:px-8"
          style={{ boxShadow: `inset 0 4px 0 0 ${cor || '#4F46E5'}` }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
                Configurar kanban
              </p>
              <h2 className="mt-2 truncate text-3xl font-bold text-slate-900">
                {nome || kanban.nome}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Edite o nome, escreva uma descrição, escolha uma cor e organize um checklist deste kanban.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onOpenBoard ? (
                <button
                  type="button"
                  onClick={onOpenBoard}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Abrir quadro
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,1.2fr)_360px] md:px-8">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Informacoes
              </h3>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-edit-name">
                    Nome do kanban
                  </label>
                  <input
                    id="kanban-edit-name"
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Nome do kanban"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-edit-description">
                    Descricao
                  </label>
                  <textarea
                    id="kanban-edit-description"
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Descreva o objetivo, escopo ou uso deste kanban"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Checklist
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Crie uma lista de verificacao para esse kanban.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setChecklist((current) => [...current, createChecklistItem('Novo item')])}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  Novo item
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {checklist.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
                    Nenhum item ainda. Adicione o primeiro item do checklist.
                  </div>
                ) : checklist.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setChecklist((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, concluido: !entry.concluido }
                              : entry,
                          ),
                        )
                      }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                        item.concluido
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </button>

                    <input
                      type="text"
                      value={item.titulo}
                      onChange={(event) => {
                        const value = event.target.value
                        setChecklist((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, titulo: value }
                              : entry,
                          ),
                        )
                      }}
                      className={`min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                        item.concluido ? 'bg-emerald-50/70 line-through' : 'bg-white'
                      }`}
                      placeholder={`Item ${index + 1}`}
                    />

                    <button
                      type="button"
                      onClick={() => setChecklist((current) => current.filter((entry) => entry.id !== item.id))}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Cor
              </h3>

              <div className="mt-5 flex flex-wrap gap-3">
                {KANBAN_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCor(preset)}
                    className={`h-11 w-11 rounded-2xl border-2 transition-transform hover:scale-105 ${
                      cor === preset ? 'border-slate-900' : 'border-white'
                    }`}
                    style={{ backgroundColor: preset }}
                    aria-label={`Selecionar cor ${preset}`}
                  />
                ))}
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-color-value">
                  Cor personalizada
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="kanban-color-value"
                    type="text"
                    value={cor}
                    onChange={(event) => setCor(event.target.value.toUpperCase())}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="#4F46E5"
                  />
                  <div
                    className="h-12 w-12 rounded-2xl border border-slate-200"
                    style={{ backgroundColor: cor || '#4F46E5' }}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Preview
              </p>

              <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                <div
                  className="rounded-[1.4rem] p-5 text-white"
                  style={{ background: `linear-gradient(135deg, ${cor || '#4F46E5'}, ${cor || '#4F46E5'}CC)` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                    Kanban
                  </p>
                  <h4 className="mt-2 text-2xl font-bold">{nome || 'Nome do kanban'}</h4>
                  <p className="mt-3 text-sm text-white/85">
                    {descricao || 'A descricao do kanban aparece aqui como resumo visual.'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Checklist
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{totalChecklist}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Concluidos
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{checklistConcluido}</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-5 md:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave({
              nome: nome.trim(),
              descricao: descricao.trim() || null,
              cor: cor.trim().toUpperCase() || null,
              checklist: checklist
                .map((item) => ({
                  ...item,
                  titulo: item.titulo.trim(),
                }))
                .filter((item) => item.titulo),
            })}
            disabled={saving || !nome.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default KanbanEditModal
