import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Espacos from '../pages/Espacos'
import EspacoDetalhe from '../pages/EspacoDetalhe'
import Cadastro from '../pages/Cadastro'
import Busca from '../pages/Busca'
import Kanban from '../pages/Kanban'
import KanbanBoard from '../pages/KanbanBoard'
import Agenda from '../pages/Agenda'
import FaleConosco from '../pages/FaleConosco'
import Cotation from '../pages/Cotation'
import Sidebar from './Sidebar'
import { WorkspaceProvider } from '../context/WorkspaceContext'
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
    <WorkspaceProvider>
      <div className="min-h-screen bg-slate-100 text-slate-900 md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 pt-16 md:pt-0">
          <Routes>
            <Route index element={<Navigate to="espacos" replace />} />
            <Route path="espacos" element={<Espacos />} />
            <Route path="espacos/:spaceId" element={<EspacoDetalhe />} />
            <Route path="cadastro" element={<Cadastro />} />
            <Route path="busca" element={<Busca />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="kanban/:kanbanId" element={<KanbanBoard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="contato" element={<FaleConosco />} />
            <Route path="fale-conosco" element={<FaleConosco />} />
            <Route path="cotation" element={<Cotation />} />
            <Route path="cotation/shipment" element={<Cotation />} />
            <Route path="shipment" element={<Cotation />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </main>
      </div>
    </WorkspaceProvider>
  )
}

export default AppLayout
