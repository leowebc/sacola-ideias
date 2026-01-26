import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Cadastro from '../pages/Cadastro'
import Busca from '../pages/Busca'
import FaleConosco from '../pages/FaleConosco'
import Cotation from '../pages/Cotation'
import Navbar from './Navbar'
import { showSuccessToast, showErrorToast } from '../utils/alerts'

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const checkout = params.get('checkout')
    if (!checkout) {
      return
    }

    if (checkout === 'success') {
      showSuccessToast('Plano ativado com sucesso!')
    } else if (checkout === 'cancel') {
      showErrorToast('Checkout cancelado. Voce pode tentar novamente.')
    }

    navigate(location.pathname, { replace: true })
  }, [location.search, location.pathname, navigate])

  return (
    <>
      <Navbar />
      <Routes>
        {/* Rota principal - cadastro de ideias para todos os usuários (dentro de /app/*) */}
        <Route index element={<Cadastro />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="busca" element={<Busca />} />
        <Route path="contato" element={<FaleConosco />} />
        <Route path="fale-conosco" element={<FaleConosco />} />
        <Route path="cotation" element={<Cotation />} />
        <Route path="cotation/shipment" element={<Cotation />} />
        <Route path="shipment" element={<Cotation />} />
        {/* Qualquer outra rota redireciona para cadastro */}
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </>
  )
}

export default AppLayout
