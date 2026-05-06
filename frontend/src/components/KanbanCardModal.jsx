import { useEffect, useState } from 'react'

function createChecklistItem(titulo = '') {
  return {
    id: `card-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

function formatDateTimeLocal(dateValue) {
  if (!dateValue) {
    return ''
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function formatPreviewDate(dateValue) {
  if (!dateValue) {
    return 'Sem prazo definido'
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return 'Sem prazo definido'
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function KanbanCardModal({
  isOpen,
  card,
  saving = false,
  onClose,
  onSave,
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [checklist, setChecklist] = useState([])

  useEffect(() => {
    if (!isOpen || !card) {
      setTitulo('')
      setDescricao('')
      setPrazoEntrega('')
      setChecklist([])
      return
    }

    setTitulo(card.titulo || '')
    setDescricao(card.descricao || '')
    setPrazoEntrega(formatDateTimeLocal(card.prazo_entrega))
    setChecklist(normalizeChecklist(card.checklist || []))
  }, [isOpen, card?.id])

  if (!isOpen || !card) {
    return null
  }

  const checklistConcluido = checklist.filter((item) => item.concluido).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
                Card do kanban
              </p>
              <h2 className="mt-2 truncate text-3xl font-bold text-slate-900">
                {titulo || card.titulo}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Edite o card, escreva uma descrição mais detalhada, monte um checklist e defina um prazo de entrega.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,1.15fr)_320px] md:px-8">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Conteudo do card
              </h3>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-native-card-title">
                    Titulo
                  </label>
                  <input
                    id="kanban-native-card-title"
                    type="text"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Titulo do card"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-native-card-description">
                    Descricao
                  </label>
                  <textarea
                    id="kanban-native-card-description"
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Descreva com mais detalhes o que precisa ser feito neste card"
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
                    Organize as etapas desse card.
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
                Prazo
              </h3>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="kanban-native-card-deadline">
                  Prazo de entrega
                </label>
                <input
                  id="kanban-native-card-deadline"
                  type="datetime-local"
                  value={prazoEntrega}
                  onChange={(event) => setPrazoEntrega(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="button"
                onClick={() => setPrazoEntrega('')}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Limpar prazo
              </button>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Resumo
              </p>

              <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-[1.4rem] bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                    Card nativo
                  </p>
                  <h4 className="mt-2 text-2xl font-bold">{titulo || 'Titulo do card'}</h4>
                  <p className="mt-3 text-sm text-white/85">
                    {descricao || 'A descricao detalhada do card aparece aqui.'}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Prazo
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatPreviewDate(prazoEntrega)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Checklist
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{checklist.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Concluidos
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{checklistConcluido}</p>
                    </div>
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
              titulo: titulo.trim(),
              descricao: descricao.trim() || null,
              checklist: checklist
                .map((item) => ({
                  ...item,
                  titulo: item.titulo.trim(),
                }))
                .filter((item) => item.titulo),
              prazo_entrega: prazoEntrega ? new Date(prazoEntrega).toISOString() : null,
            })}
            disabled={saving || !titulo.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default KanbanCardModal
