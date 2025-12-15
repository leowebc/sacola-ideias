import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function Cotation() {
  const { t } = useTranslation()
  
  // Dados de exemplo - podem vir de props ou estado
  const [shipmentData] = useState({
    embarque: 'Brás / SP',
    status: 'Cotação',
    cepDestino: '01023-000',
    valorCarga: 'R$ 100,00',
    pesoTotal: '10,00 Kg',
    dataHora: '01/12/2025 21:41',
    prazoEntrega: 'até 2 dias',
    valorFrete: 'R$ 45,52'
  })

  return (
    <div className="min-h-screen py-12 px-4 animate-fade-in bg-gray-100">
      <div className="max-w-6xl mx-auto">
        {/* Card principal */}
        <div className="bg-white border border-gray-300 rounded-lg shadow-sm px-6 pt-1 pb-6">
          {/* Header - MELHOR OFERTA e DADOS DE ENVIO na mesma linha */}
          <div className="flex items-start gap-x-8 mb-6 pb-6 border-b border-gray-200">
            {/* Lado Esquerdo - MELHOR OFERTA */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-700">
                MELHOR <span className="text-green-600">OFERTA</span>
              </h2>
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            {/* Meio - DADOS DE ENVIO */}
            <div className="flex gap-x-8 items-start flex-grow">
              {/* Grupo Esquerdo */}
              <div className="flex">
                {/* Coluna de Labels (Estáticos) - Esquerda */}
                <div className="flex flex-col space-y-3.5 mr-6">
                  <div className="text-[11px] text-gray-200 leading-tight">Embarque</div>
                  <div className="text-[11px] text-gray-200 leading-tight">Status</div>
                  <div className="text-[11px] text-gray-200 leading-tight">CEP Destino</div>
                </div>
                {/* Coluna de Valores (Dinâmicos) - Esquerda */}
                <div className="flex flex-col space-y-3.5">
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.embarque}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.status}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.cepDestino}</div>
                </div>
              </div>

              {/* Grupo Direito */}
              <div className="flex">
                {/* Coluna de Labels (Estáticos) - Direita */}
                <div className="flex flex-col space-y-3.5 mr-6">
                  <div className="text-[11px] text-gray-200 leading-tight">Valor da Carga</div>
                  <div className="text-[11px] text-gray-200 leading-tight">Peso total</div>
                  <div className="text-[11px] text-gray-200 leading-tight">Data/Hora</div>
                </div>
                {/* Coluna de Valores (Dinâmicos) - Direita */}
                <div className="flex flex-col space-y-3.5">
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.valorCarga}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.pesoTotal}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-tight">{shipmentData.dataHora}</div>
                </div>
              </div>
            </div>

            {/* Lado Direito - Prazo e Preço */}
            <div className="flex flex-col items-end space-y-1 flex-shrink-0">
              <div className="text-sm text-gray-700">{shipmentData.prazoEntrega}</div>
              <div className="text-2xl font-bold text-green-600">{shipmentData.valorFrete}</div>
            </div>
          </div>

          {/* INFORMAÇÕES DO REMETENTE */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-700 mb-4 uppercase">INFORMAÇÕES DO REMETENTE</h3>
            {/* Aqui você pode adicionar os campos do remetente */}
            <div className="text-xs text-gray-600">
              {/* Campos do remetente serão adicionados aqui */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cotation

