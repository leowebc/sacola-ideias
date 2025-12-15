import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import LanguageSelector from './LanguageSelector'
import SettingsMenu from './SettingsMenu'
import LoginGoogle from './LoginGoogle'
import { limparLocalStorage } from '../utils/limparLocalStorage'
import { showConfirm, showSuccessToast } from '../utils/alerts'

function Navbar() {
  const location = useLocation()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [imageError, setImageError] = useState(false)
  
  const isActive = (path) => location.pathname === path

  useEffect(() => {
    // Verificar se usuário está logado
    const token = localStorage.getItem('auth_token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
      setImageError(false) // Resetar erro de imagem quando usuário mudar
    }
  }, [location])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6">
            <Link 
              to="/app" 
              className="flex items-center space-x-3 group"
            >
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden p-1.5">
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 120 120" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <defs>
                    <linearGradient id="navGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:"#ffffff",stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:"#f3f4f6",stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  
                  {/* Sacola principal */}
                  <path d="M25 30 L25 85 C25 92 31 98 38 98 L82 98 C89 98 95 92 95 85 L95 30 L25 30 Z" 
                        fill="url(#navGradient)" 
                        stroke="white" 
                        strokeWidth="2.5"/>
                  
                  {/* Alça da sacola */}
                  <path d="M30 30 Q60 20 90 30" 
                        fill="none" 
                        stroke="white" 
                        strokeWidth="4" 
                        strokeLinecap="round"/>
                  
                  {/* Lâmpada de ideia */}
                  <g transform="translate(50, 50)">
                    <circle cx="10" cy="8" r="7" fill="#fbbf24" opacity="0.95"/>
                    <circle cx="10" cy="8" r="5" fill="#fef3c7" opacity="0.8"/>
                    <rect x="7" y="13" width="6" height="2.5" rx="1" fill="white"/>
                    <path d="M10 2 L10 0 M10 16 L10 18 M3 8 L1 8 M17 8 L19 8" 
                          stroke="#fbbf24" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          opacity="0.7"/>
                  </g>
                  
                  {/* Estrela decorativa */}
                  <g transform="translate(20, 40)">
                    <path d="M0 4 L1 1.5 L4 0 L1 -1.5 L0 -4 L-1 -1.5 L-4 0 L-1 1.5 Z" 
                          fill="white" 
                          opacity="0.6"/>
                  </g>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t('nav.title')}
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">{t('nav.subtitle')}</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link
              to="/app"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/app') || isActive('/app/cadastro')
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-gray-600 border border-purple-400 hover:text-indigo-600 hover:bg-gray-100 hover:border-indigo-300'
              }`}
            >
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{t('nav.cadastrar')}</span>
              </span>
            </Link>
            <Link
              to="/app/busca"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/app/busca') || isActive('/busca')
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-gray-600 border border-purple-400 hover:text-indigo-600 hover:bg-gray-100 hover:border-indigo-300'
              }`}
            >
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>{t('nav.buscar')}</span>
              </span>
            </Link>
            {user && (
              <div className="flex items-center space-x-2 ml-2">
                {user.foto_url && !imageError ? (
                  <img 
                    src={user.foto_url} 
                    alt={user.nome || user.email} 
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold border-2 border-gray-200">
                    {user.nome 
                      ? user.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : user.email ? user.email[0].toUpperCase() : 'U'
                    }
                  </div>
                )}
                <span className="text-sm text-gray-700 hidden sm:inline">
                  {user.nome || user.email}
                </span>
                {user.role === 'admin' && (
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                    Admin
                  </span>
                )}
              </div>
            )}
            <LanguageSelector />
            {user && <SettingsMenu />}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

