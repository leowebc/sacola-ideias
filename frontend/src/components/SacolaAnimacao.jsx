import { useState, useEffect, useRef } from 'react'

function SacolaAnimacao({ titulo, tag, ideia, mostrarSucesso }) {
  const [mensagensCaindo, setMensagensCaindo] = useState([])
  const [ultimaMensagemEnviada, setUltimaMensagemEnviada] = useState({ titulo: '', tag: '', ideia: '' })
  const containerRef = useRef(null)
  const timeoutRef = useRef(null)

  // Efeito para mensagens enquanto digita (efeito de #digitados)
  useEffect(() => {
    // Não mostrar animação durante o salvamento
    if (mostrarSucesso) return

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Verificar se há mudanças nos campos
    const temConteudo = titulo || tag || ideia
    if (!temConteudo) {
      setUltimaMensagemEnviada({ titulo: '', tag: '', ideia: '' })
      return
    }

    // Aguardar um pouco após parar de digitar antes de mostrar mensagem
    timeoutRef.current = setTimeout(() => {
      // Gerar mensagens ocasionais enquanto digita (20% de chance)
      if (Math.random() > 0.8) {
        let novaMensagem = null

        if (titulo && titulo !== ultimaMensagemEnviada.titulo && titulo.length > 3) {
          novaMensagem = {
            id: Date.now() + Math.random(),
            texto: `# ${titulo.substring(0, 15)}${titulo.length > 15 ? '...' : ''}`,
            tipo: 'titulo'
          }
          setUltimaMensagemEnviada(prev => ({ ...prev, titulo }))
        } else if (tag && tag !== ultimaMensagemEnviada.tag && tag.length > 2) {
          novaMensagem = {
            id: Date.now() + Math.random(),
            texto: `# ${tag}`,
            tipo: 'tag'
          }
          setUltimaMensagemEnviada(prev => ({ ...prev, tag }))
        } else if (ideia) {
          const palavrasIdeia = ideia.split(/\s+/).filter(p => p.length > 2)
          const palavrasUltima = ultimaMensagemEnviada.ideia.split(/\s+/).filter(p => p.length > 2)
          
          if (palavrasIdeia.length > palavrasUltima.length) {
            const ultimaPalavra = palavrasIdeia[palavrasIdeia.length - 1]
            if (ultimaPalavra && ultimaPalavra.length > 2) {
              novaMensagem = {
                id: Date.now() + Math.random(),
                texto: ultimaPalavra.length > 15 ? ultimaPalavra.substring(0, 15) + '...' : ultimaPalavra,
                tipo: 'palavra'
              }
            }
          }
        }

        if (novaMensagem) {
          setMensagensCaindo(prev => [...prev, novaMensagem])
          
          // Remover mensagem após animação
          setTimeout(() => {
            setMensagensCaindo(prev => prev.filter(m => m.id !== novaMensagem.id))
          }, 2500)
        }
      }
    }, 1000) // Aguarda 1s após parar de digitar

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [titulo, tag, ideia, mostrarSucesso])

  // Quando uma ideia é salva, cria múltiplas mensagens caindo
  useEffect(() => {
    if (mostrarSucesso) {
      // Limpar mensagens anteriores
      setMensagensCaindo([])
      
      // Criar animação imediatamente quando mostrarSucesso for true
      const novasMensagens = []
      const tituloAtual = (titulo || '').trim()
      const tagAtual = (tag || '').trim()
      const ideiaAtual = (ideia || '').trim()
      
      // Sempre mostrar título quando salvar
      if (tituloAtual) {
        novasMensagens.push({
          id: Date.now() + Math.random(),
          texto: `# ${tituloAtual.length > 25 ? tituloAtual.substring(0, 25) + '...' : tituloAtual}`,
          tipo: 'titulo'
        })
      }
      
      // Mostrar tag se tiver
      if (tagAtual) {
        novasMensagens.push({
          id: Date.now() + Math.random() + 1,
          texto: `# ${tagAtual}`,
          tipo: 'tag'
        })
      }
      
      // Dividir a ideia em palavras para criar múltiplas mensagens caindo
      if (ideiaAtual) {
        const palavras = ideiaAtual.split(/\s+/).filter(p => p.length > 2)
        // Pegar até 15 palavras para criar animação bem rica e intensa
        palavras.slice(0, 15).forEach((palavra, index) => {
          novasMensagens.push({
            id: Date.now() + Math.random() + index + 10,
            texto: palavra.length > 18 ? palavra.substring(0, 18) + '...' : palavra,
            tipo: 'palavra'
          })
        })
      }

      // Criar animação escalonada intensa e rápida
      if (novasMensagens.length > 0) {
        novasMensagens.forEach((msg, index) => {
          setTimeout(() => {
            setMensagensCaindo(prev => [...prev, msg])
            // Remover mensagem após animação completa (3 segundos)
            setTimeout(() => {
              setMensagensCaindo(prev => prev.filter(m => m.id !== msg.id))
            }, 3000)
          }, index * 70) // Delay menor (70ms) para animação mais rápida e intensa
        })
      }

      // Reset após salvar
      setUltimaMensagemEnviada({ titulo: '', tag: '', ideia: '' })
    }
  }, [mostrarSucesso]) // Dependência apenas de mostrarSucesso para garantir que execute

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px] flex flex-col items-center justify-end">
      {/* Sacola */}
      <div className="relative z-10">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="drop-shadow-lg"
        >
          {/* Corpo da sacola */}
          <path
            d="M 50 80 Q 50 40 100 40 Q 150 40 150 80 L 150 180 Q 150 190 100 190 Q 50 190 50 180 Z"
            fill="#e0e7ff"
            stroke="#6366f1"
            strokeWidth="3"
          />
          
          {/* Alças */}
          <path
            d="M 70 80 Q 70 50 100 50 Q 130 50 130 80"
            fill="none"
            stroke="#6366f1"
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Detalhes */}
          <line
            x1="60"
            y1="120"
            x2="140"
            y2="120"
            stroke="#6366f1"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <line
            x1="60"
            y1="150"
            x2="140"
            y2="150"
            stroke="#6366f1"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>
      </div>

      {/* Mensagens caindo */}
      {mensagensCaindo.map((msg) => (
        <div
          key={msg.id}
          className={`absolute text-xs sm:text-sm font-semibold px-2 py-1 rounded-full shadow-lg animate-drop ${
            msg.tipo === 'titulo'
              ? 'bg-primary text-primary-content'
              : msg.tipo === 'tag'
              ? 'bg-secondary text-secondary-content'
              : 'bg-accent text-accent-content'
          }`}
          style={{
            left: `${Math.random() * 50 + 25}%`,
            top: '-5%',
            animationDelay: '0s',
            animationDuration: '2.5s',
            animationFillMode: 'forwards'
          }}
        >
          {msg.texto}
        </div>
      ))}

      {/* Estilo para animação de queda */}
      <style>{`
        @keyframes drop {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(20px) rotate(5deg) scale(1);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(420px) rotate(360deg) scale(0.6);
            opacity: 0;
          }
        }
        .animate-drop {
          animation: drop 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
    </div>
  )
}

export default SacolaAnimacao

