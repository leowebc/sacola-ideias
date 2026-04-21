BEGIN;

CREATE TABLE IF NOT EXISTS kanban_cards (
    id BIGSERIAL PRIMARY KEY,
    kanban_id BIGINT NOT NULL REFERENCES kanbans(id) ON DELETE CASCADE,
    projeto_id BIGINT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    kanban_status VARCHAR(30) NOT NULL DEFAULT 'novo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_usuario_kanban
ON kanban_cards (usuario_id, kanban_id);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_usuario_projeto
ON kanban_cards (usuario_id, projeto_id);

COMMIT;
