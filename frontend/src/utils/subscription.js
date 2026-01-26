import { showConfirm, showError, showInfo } from './alerts'

const formatDateTime = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR')
}

export const buildTrialExpiredMessage = (trialExpiraEm) => {
  const formatted = formatDateTime(trialExpiraEm)
  if (formatted) {
    return `Seu periodo gratuito terminou em ${formatted}.`
  }
  return 'Seu periodo gratuito terminou.'
}

export const startCheckout = async (apiUrl, token, options = {}) => {
  const {
    errorTitle = 'Erro ao iniciar assinatura',
    maxAttempts = 2,
    attempt = 1,
  } = options

  try {
    const checkoutResponse = await fetch(`${apiUrl}/stripe/checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const checkoutData = await checkoutResponse.json().catch(() => ({}))
    if (!checkoutResponse.ok) {
      throw new Error(checkoutData.detail || 'Erro ao iniciar checkout')
    }

    if (!checkoutData.url) {
      throw new Error('Checkout retornou URL invalida')
    }

    window.location.href = checkoutData.url
    return true
  } catch (err) {
    const message = err?.message || 'Nao foi possivel iniciar o checkout'
    if (attempt >= maxAttempts) {
      showError(errorTitle, message)
      return false
    }

    const result = await showConfirm(
      errorTitle,
      `${message} Deseja tentar novamente?`,
      'Tentar novamente',
      'Fechar'
    )

    if (result.isConfirmed) {
      return startCheckout(apiUrl, token, { ...options, attempt: attempt + 1 })
    }
  }

  return false
}

export const handleTrialExpired = async ({ apiUrl, token, trialExpiraEm, detail } = {}) => {
  const baseMessage = detail || buildTrialExpiredMessage(trialExpiraEm)
  await showInfo('Periodo gratuito encerrado', `${baseMessage} Para continuar, assine um plano.`)
  if (!apiUrl || !token) {
    return false
  }
  return startCheckout(apiUrl, token, { errorTitle: 'Assinatura necessaria' })
}
