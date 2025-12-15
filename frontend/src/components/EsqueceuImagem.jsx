/**
 * Componente de imagem "Esqueceu?" no mesmo estilo da lupa da página de busca
 * Substitui a necessidade de um arquivo de imagem
 */

function EsqueceuImagem({ width = 140, height = 140, className = "" }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 140"
      className={`drop-shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fundo com gradiente similar à lupa */}
      <defs>
        <linearGradient id="esqueceuGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(0,0,0,0.2)" />
        </filter>
      </defs>
      
      {/* Círculo de fundo */}
      <circle
        cx="70"
        cy="70"
        r="65"
        fill="url(#esqueceuGradient)"
        filter="url(#shadow)"
      />
      
      {/* Texto "esqueceu?" */}
      <text
        x="70"
        y="70"
        fontSize="24"
        fontWeight="bold"
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="1px"
      >
        esqueceu?
      </text>
      
      {/* Decoração - ponto de interrogação estilizado */}
      <circle
        cx="70"
        cy="50"
        r="3"
        fill="white"
        opacity="0.8"
      />
      <path
        d="M 70 60 Q 70 70, 65 75 Q 60 80, 60 85"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
}

export default EsqueceuImagem

