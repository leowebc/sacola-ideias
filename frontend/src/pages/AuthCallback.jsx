import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { showError } from '../utils/alerts'

const API_URL = (typeof window !== 'undefined' && window.API_URL)
  ? window.API_URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8002/api')

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState('processando')

  const handlePosAuthRedirect = async (token) => {
    const meResponse = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const meData = await meResponse.json()
    if (!meResponse.ok) {
      throw new Error(meData.detail || 'Falha ao obter dados do usuario')
    }

    localStorage.setItem('auth_token', token)
    localStorage.setItem('user', JSON.stringify({
      id: meData.id,
      email: meData.email,
      nome: meData.nome,
      foto_url: meData.foto_url,
      role: meData.role,
      plano: meData.plano,
      status: meData.status,
      limite_buscas: meData.limite_buscas,
      limite_embeddings: meData.limite_embeddings,
      trial_ativo: meData.trial_ativo,
      trial_expira_em: meData.trial_expira_em
    }))

    const plano = (meData.plano || '').toLowerCase()
    const statusAss = (meData.status || '').toLowerCase()
    const trialAtivo = Boolean(meData.trial_ativo)
    const assinaturaAtiva = plano === 'pro' && (statusAss === 'ativa' || statusAss === 'active' || statusAss === 'trialing')

    if (assinaturaAtiva || trialAtivo) {
      setStatus('sucesso')
      setTimeout(() => {
        navigate('/app')
      }, 1000)
      return
    }

    const checkoutResponse = await fetch(`${API_URL}/stripe/checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const checkoutData = await checkoutResponse.json()
    if (!checkoutResponse.ok) {
      throw new Error(checkoutData.detail || 'Erro ao iniciar checkout')
    }

    if (!checkoutData.url) {
      throw new Error('Checkout retornou URL invalida')
    }

    window.location.href = checkoutData.url
  }

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
          await handlePosAuthRedirect(token)
        } catch (error) {
          console.error('Erro ao processar token:', error)
          setStatus('erro')
          showError('Erro no login', 'Nao foi possivel completar o login')
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

        await handlePosAuthRedirect(data.token)

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
