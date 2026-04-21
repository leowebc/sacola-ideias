import { useEffect, useRef, useState } from 'react'

function IdeiaCardMenu({
  ideia,
  onOpenDetails,
  onOpenProject,
  onOpenSchedule,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  function runAction(callback) {
    setOpen(false)
    if (callback) {
      callback()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        aria-label={`Abrir ações da ideia ${ideia.titulo}`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-20 min-w-[190px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
          <button
            type="button"
            onClick={() => runAction(onOpenDetails)}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Abrir detalhes
          </button>
          <button
            type="button"
            onClick={() => runAction(onOpenProject)}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Projeto vinculado
          </button>
          <button
            type="button"
            onClick={() => runAction(onOpenSchedule)}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {ideia.agenda_data ? 'Editar agenda' : 'Agendar'}
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={() => runAction(onDelete)}
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Excluir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default IdeiaCardMenu
