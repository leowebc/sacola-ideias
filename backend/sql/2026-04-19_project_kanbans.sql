BEGIN;

CREATE TABLE IF NOT EXISTS kanbans (
    id BIGSERIAL PRIMARY KEY,
    projeto_id BIGINT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanbans_projeto_nome
ON kanbans (projeto_id, lower(nome));

CREATE INDEX IF NOT EXISTS idx_kanbans_usuario_projeto
ON kanbans (usuario_id, projeto_id);

ALTER TABLE ideias
ADD COLUMN IF NOT EXISTS kanban_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'ideias'
          AND constraint_name = 'ideias_kanban_id_fkey'
    ) THEN
        ALTER TABLE ideias
        ADD CONSTRAINT ideias_kanban_id_fkey
        FOREIGN KEY (kanban_id) REFERENCES kanbans(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ideias_usuario_kanban
ON ideias (usuario_id, kanban_id);

INSERT INTO kanbans (projeto_id, usuario_id, nome, descricao)
SELECT
    p.id,
    p.usuario_id,
    'Kanban principal',
    'Quadro inicial criado automaticamente'
FROM projetos p
WHERE NOT EXISTS (
    SELECT 1
    FROM kanbans k
    WHERE k.projeto_id = p.id
);

WITH primeiro_kanban AS (
    SELECT DISTINCT ON (k.projeto_id)
        k.projeto_id,
        k.id
    FROM kanbans k
    ORDER BY k.projeto_id, lower(k.nome), k.id
)
UPDATE ideias i
SET kanban_id = pk.id
FROM primeiro_kanban pk
WHERE i.projeto_id = pk.projeto_id
  AND i.kanban_ativo IS TRUE
  AND i.kanban_id IS NULL;

COMMIT;
