import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { showError } from '../utils/alerts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002/api'

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState('processando')

  useEffect(() => {
    const processarCallback = async () => {
      const code = searchParams.get('code')
      const token = searchParams.get('token')
      const error = searchParams.get('error')

      if (error) {
        setStatus('erro')
        showError('Erro no login', 'Falha ao autenticar com Google')
        setTimeout(() => navigate('/'), 2000)
        return
      }

      // Se o token já veio na URL (do backend), usar diretamente
      if (token) {
        try {
          // Buscar dados do usuário usando o token
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (!response.ok) {
            throw new Error('Falha ao obter dados do usuário')
          }

          const userData = await response.json()

          // Salvar token e dados do usuário
          localStorage.setItem('auth_token', token)
          localStorage.setItem('user', JSON.stringify({
            id: userData.id,
            email: userData.email,
            nome: userData.nome,
            foto_url: userData.foto_url,
            role: userData.role
          }))

          setStatus('sucesso')

          // Redirecionar para tela de cadastro de ideias após 1 segundo
          setTimeout(() => {
            navigate('/app')
          }, 1000)
        } catch (error) {
          console.error('Erro ao processar token:', error)
          setStatus('erro')
          showError('Erro no login', 'Não foi possível completar o login')
          setTimeout(() => navigate('/'), 2000)
        }
        return
      }

      // Se não tem token mas tem code, tentar método antigo (POST) como fallback
      if (!code) {
        setStatus('erro')
        showError('Erro no login', 'Código de autorização não encontrado')
        setTimeout(() => navigate('/'), 2000)
        return
      }

      try {
        // Obter redirect_uri atual
        const redirect_uri = window.location.origin + '/auth/google/callback'

        // Enviar code para o backend
        const response = await fetch(`${API_URL}/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: code,
            redirect_uri: redirect_uri
          })
        })

        if (!response.ok) {
          throw new Error('Falha ao autenticar')
        }

        const data = await response.json()

        // Salvar token no localStorage
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user', JSON.stringify({
          id: data.id,
          email: data.email,
          nome: data.nome,
          foto_url: data.foto_url
        }))

        setStatus('sucesso')

        // Redirecionar para tela de cadastro de ideias após 1 segundo
        setTimeout(() => {
          navigate('/app')
        }, 1000)

      } catch (error) {
        console.error('Erro ao processar callback:', error)
        setStatus('erro')
        showError('Erro no login', 'Não foi possível completar o login')
        setTimeout(() => navigate('/'), 2000)
      }
    }

    processarCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center">
        {status === 'processando' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-700 text-lg">Processando autenticação...</p>
          </>
        )}
        {status === 'sucesso' && (
          <>
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <p className="text-gray-700 text-lg">Login realizado com sucesso!</p>
            <p className="text-gray-500 text-sm">Redirecionando...</p>
          </>
        )}
        {status === 'erro' && (
          <>
            <div className="text-red-600 text-6xl mb-4">✗</div>
            <p className="text-gray-700 text-lg">Erro ao fazer login</p>
            <p className="text-gray-500 text-sm">Redirecionando...</p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback

