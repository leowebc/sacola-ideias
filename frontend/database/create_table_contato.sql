-- =====================================================
-- Tabela: contato
-- Descrição: Armazena mensagens do formulário "Fale Conosco"
-- Relacionamento: usuarios (opcional - pode ser anônimo)
-- =====================================================

CREATE TABLE IF NOT EXISTS contato (
    id BIGSERIAL PRIMARY KEY,
    
    -- Relacionamento com usuário (opcional - pode ser null se não estiver logado)
    usuario_id BIGINT,
    
    -- Dados do formulário
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    assunto VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    
    -- Email de destino (sempre contato@sacoladeideias.com)
    email_destino VARCHAR(255) DEFAULT 'contato@sacoladeideias.com',
    
    -- Status da mensagem
    status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'lido', 'respondido', 'arquivado')),
    
    -- Timestamps
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key para usuarios
    CONSTRAINT fk_contato_usuario 
        FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- =====================================================
-- Índices para melhor performance
-- =====================================================

-- Índice para buscar por usuário
CREATE INDEX IF NOT EXISTS idx_contato_usuario_id ON contato(usuario_id);

-- Índice para buscar por email
CREATE INDEX IF NOT EXISTS idx_contato_email ON contato(email);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_contato_status ON contato(status);

-- Índice para buscar por data de criação (ordenar por mais recentes)
CREATE INDEX IF NOT EXISTS idx_contato_criado_em ON contato(criado_em DESC);

-- Índice composto para buscar mensagens pendentes recentes
CREATE INDEX IF NOT EXISTS idx_contato_status_criado ON contato(status, criado_em DESC);

-- =====================================================
-- Comentários nas colunas (documentação)
-- =====================================================

COMMENT ON TABLE contato IS 'Armazena mensagens do formulário Fale Conosco';
COMMENT ON COLUMN contato.id IS 'ID único da mensagem';
COMMENT ON COLUMN contato.usuario_id IS 'ID do usuário que enviou (null se anônimo)';
COMMENT ON COLUMN contato.nome IS 'Nome do remetente';
COMMENT ON COLUMN contato.email IS 'Email do remetente';
COMMENT ON COLUMN contato.assunto IS 'Assunto da mensagem';
COMMENT ON COLUMN contato.mensagem IS 'Conteúdo da mensagem';
COMMENT ON COLUMN contato.email_destino IS 'Email de destino (sempre contato@sacoladeideias.com)';
COMMENT ON COLUMN contato.status IS 'Status: pendente, lido, respondido, arquivado';
COMMENT ON COLUMN contato.criado_em IS 'Data e hora de criação da mensagem';
COMMENT ON COLUMN contato.atualizado_em IS 'Data e hora da última atualização';

-- =====================================================
-- Trigger para atualizar automaticamente o campo atualizado_em
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_contato_atualizado_em
    BEFORE UPDATE ON contato
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_atualizado_em();

-- =====================================================
-- Exemplo de consultas úteis
-- =====================================================

-- Buscar todas as mensagens pendentes ordenadas por mais recentes
-- SELECT * FROM contato WHERE status = 'pendente' ORDER BY criado_em DESC;

-- Buscar mensagens de um usuário específico
-- SELECT * FROM contato WHERE usuario_id = 1 ORDER BY criado_em DESC;

-- Buscar mensagens por email
-- SELECT * FROM contato WHERE email = 'usuario@example.com' ORDER BY criado_em DESC;

-- Contar mensagens por status
-- SELECT status, COUNT(*) as total FROM contato GROUP BY status;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

