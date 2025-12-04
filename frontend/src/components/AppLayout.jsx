import { Routes, Route, Navigate } from 'react-router-dom'
import Cadastro from '../pages/Cadastro'
import Busca from '../pages/Busca'
import FaleConosco from '../pages/FaleConosco'
import Navbar from './Navbar'

function AppLayout() {
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
        {/* Qualquer outra rota redireciona para cadastro */}
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </>
  )
}

export default AppLayout
