import { useEffect, useRef, useState } from 'react'

function KanbanItemMenu({
  item,
  onEdit,
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
      callback(item)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        draggable={false}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        aria-label={`Abrir acoes de ${item.titulo}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-20 min-w-[150px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
          <button
            type="button"
            onClick={() => runAction(onEdit)}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => runAction(onDelete)}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Excluir
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default KanbanItemMenu
