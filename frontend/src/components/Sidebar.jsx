import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const SIDEBAR_STORAGE_KEY = 'sacola_sidebar_expanded'

const MENU_ITEMS = [
  {
    to: '/app/espacos',
    labelKey: 'nav.espacos',
    defaultLabel: 'Espaço',
    matches: ['/app/espacos'],
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 7.75A1.75 1.75 0 015.5 6h3.25l1.5 1.75H18.5A1.75 1.75 0 0120.25 9.5v8.75A1.75 1.75 0 0118.5 20H5.5a1.75 1.75 0 01-1.75-1.75V7.75z" />,
  },
  {
    to: '/app/cadastro',
    labelKey: 'nav.cadastrar',
    defaultLabel: 'Cadastrar',
    matches: ['/app/cadastro'],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 4v16m8-8H4"
      />
    ),
  },
  {
    to: '/app/busca',
    labelKey: 'nav.buscar',
    defaultLabel: 'Buscar',
    matches: ['/app/busca'],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    ),
  },
  {
    to: '/app/kanban',
    labelKey: 'nav.kanban',
    defaultLabel: 'Kanban',
    matches: ['/app/kanban'],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 5h7v6H4V5zm9 0h7v4h-7V5zM4 13h7v6H4v-6zm9-2h7v8h-7v-8z"
      />
    ),
  },
  {
    to: '/app/agenda',
    labelKey: 'nav.agenda',
    defaultLabel: 'Agenda',
    matches: ['/app/agenda'],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z"
      />
    ),
  },
  {
    to: '/app/contato',
    labelKey: 'nav.faleConosco',
    defaultLabel: 'Contato',
    matches: ['/app/contato', '/app/fale-conosco'],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9zm1.5.5L12 12.5 19.5 8"
      />
    ),
  },
  {
    to: '/app/cotation',
    labelKey: 'nav.shipment',
    defaultLabel: 'Shipment',
    matches: ['/app/cotation', '/app/cotation/shipment', '/app/shipment'],
    icon: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M4 7.5h11v8H4z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 10h2.8l2.2 2.5v3H15zM7.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        />
      </>
    ),
  },
]

function Sidebar() {
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, expanded ? 'true' : 'false')
  }, [expanded])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
      setImageError(false)
    }
  }, [location.pathname])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  function isActive(matches) {
    return matches.some((path) => (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    ))
  }

  function handleLogout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  function toggleLanguage() {
    const nextLanguage = i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR'
    i18n.changeLanguage(nextLanguage)
  }

  const widthClass = expanded ? 'md:w-72' : 'md:w-24'

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
        aria-label="Abrir menu lateral"
      >
        &gt;&gt;
      </button>

      {mobileOpen ? (
        <div
          className="md:hidden fixed inset-0 z-40 bg-indigo-950/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-indigo-100/80 bg-gradient-to-b from-white via-indigo-50/80 to-purple-50/70 text-slate-800 shadow-2xl shadow-indigo-200/40 transition-transform duration-300 md:static md:translate-x-0 ${widthClass} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-indigo-100 px-4 py-4">
            <Link to="/app" className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M7 8.5A2.5 2.5 0 019.5 6h5A2.5 2.5 0 0117 8.5v1H7v-1zm-1 1h12l1.2 9a2 2 0 01-2 2.25H6.8a2 2 0 01-2-2.25L6 9.5z"
                  />
                </svg>
              </div>
              {expanded ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500/80">
                    Workspace
                  </p>
                  <h1 className="truncate bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
                    {t('nav.title')}
                  </h1>
                </div>
              ) : null}
            </Link>

            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(false)
                } else {
                  setExpanded((current) => !current)
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-white text-sm font-semibold text-indigo-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
              aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
            >
              {expanded ? '<<' : '>>'}
            </button>
          </div>

	          <div className="flex-1 overflow-y-auto px-3 py-5">
	            <nav className="space-y-2">
              {MENU_ITEMS.map((item) => {
                const active = isActive(item.matches)

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group flex items-center rounded-2xl px-3 py-3 transition-all ${
                      expanded ? 'justify-start gap-3' : 'justify-center'
                    } ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'border border-transparent text-slate-600 hover:border-indigo-100 hover:bg-white/75 hover:text-indigo-700'
                    }`}
                    title={t(item.labelKey, { defaultValue: item.defaultLabel })}
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {item.icon}
                    </svg>
                    {expanded ? (
                      <span className="truncate text-sm font-medium">
                        {t(item.labelKey, { defaultValue: item.defaultLabel })}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </nav>

	          </div>

          <div className="border-t border-white/10 px-3 py-4 space-y-3">
            <button
              onClick={toggleLanguage}
              className={`flex w-full items-center rounded-2xl border border-indigo-100 bg-white/80 px-3 py-3 text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-white ${
                expanded ? 'justify-between' : 'justify-center'
              }`}
              title="Alterar idioma"
            >
              {expanded ? (
                <>
                  <span className="text-sm font-medium">
                    {i18n.language === 'pt-BR' ? 'Portuguese' : 'English'}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-indigo-500">
                    {i18n.language === 'pt-BR' ? 'PT' : 'EN'}
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold uppercase text-indigo-600">
                  {i18n.language === 'pt-BR' ? 'PT' : 'EN'}
                </span>
              )}
            </button>

            {user ? (
              <div className={`rounded-2xl border border-indigo-100 bg-white/85 p-3 shadow-sm ${expanded ? '' : 'flex flex-col items-center'}`}>
                <div className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'}`}>
                  {user.foto_url && !imageError ? (
                    <img
                      src={user.foto_url}
                      alt={user.nome || user.email}
                      className="h-11 w-11 rounded-2xl object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/25">
                      {user.nome
                        ? user.nome.split(' ').map((parte) => parte[0]).join('').toUpperCase().slice(0, 2)
                        : user.email
                          ? user.email[0].toUpperCase()
                          : 'U'}
                    </div>
                  )}

                  {expanded ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {user.nome || user.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={handleLogout}
                  className={`mt-3 flex w-full items-center rounded-2xl border border-indigo-100 px-3 py-2.5 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 ${
                    expanded ? 'justify-between' : 'justify-center'
                  }`}
                  title={t('auth.sair')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M15 12H3m0 0l4-4m-4 4l4 4m4-9.5h5A1.5 1.5 0 0119.5 8v8a1.5 1.5 0 01-1.5 1.5h-5"
                    />
                  </svg>
                  {expanded ? (
                    <span className="text-sm font-medium">{t('auth.sair')}</span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
