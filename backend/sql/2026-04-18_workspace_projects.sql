BEGIN;

CREATE TABLE IF NOT EXISTS espacos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    descricao TEXT,
    cor VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projetos (
    id BIGSERIAL PRIMARY KEY,
    espaco_id BIGINT NOT NULL REFERENCES espacos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_espacos_usuario_nome
ON espacos (usuario_id, lower(nome));

CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_espaco_nome
ON projetos (espaco_id, lower(nome));

CREATE INDEX IF NOT EXISTS idx_projetos_usuario_espaco
ON projetos (usuario_id, espaco_id);

ALTER TABLE ideias
ADD COLUMN IF NOT EXISTS projeto_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'ideias'
          AND constraint_name = 'ideias_projeto_id_fkey'
    ) THEN
        ALTER TABLE ideias
        ADD CONSTRAINT ideias_projeto_id_fkey
        FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ideias_usuario_projeto
ON ideias (usuario_id, projeto_id);

COMMIT;
