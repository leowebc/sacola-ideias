import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import LanguageSelector from './LanguageSelector'
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
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-white text-xl">🎒</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t('nav.title')}
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">{t('nav.subtitle')}</p>
              </div>
            </Link>
            <Link
              to="/app/contato"
              className={`flex items-center space-x-1.5 text-sm font-medium transition-all duration-200 ${
                isActive('/app/contato') || isActive('/app/fale-conosco')
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{t('nav.faleConosco')}</span>
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
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                  title={t('auth.sair')}
                >
                  {t('auth.sair')}
                </button>
              </div>
            )}
            <LanguageSelector />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

