"""
Backend FastAPI para Sacola de Ideias
Conecta com PostgreSQL usando pgvector
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import re
from dotenv import load_dotenv
import stripe
import traceback
try:
    import stripe.checkout as stripe_checkout
except Exception:
    stripe_checkout = None
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from auth import (
    criar_token_jwt, 
    verificar_token_jwt, 
    obter_info_google_por_code,
    hash_senha,
    verificar_senha,
    GOOGLE_CLIENT_ID
)
from db_config import build_db_config, sanitize_db_config

load_dotenv()

# =====================================================
# CONFIGURAÇÕES DE AMBIENTE (URLs e Portas)
# =====================================================
# Todas as URLs e portas devem vir do .env para funcionar em local e produção
BACKEND_PORT = int(os.getenv("PORT") or os.getenv("BACKEND_PORT", "8002"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"http://localhost:{BACKEND_PORT}/api/auth/google/callback")
CONTATO_EMAIL = os.getenv("CONTATO_EMAIL", "contato@sacoladeideias.com")


def _parse_cors_origins() -> List[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]
    if not origins and FRONTEND_URL:
        origins = [FRONTEND_URL.rstrip("/")]
    return origins or ["http://localhost:5173"]


CORS_ORIGINS = _parse_cors_origins()

# Configurar embeddings (usa API Key do .env)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", f"{FRONTEND_URL}/app?checkout=success")
STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", f"{FRONTEND_URL}/app?checkout=cancel")
PRO_LIMITE_BUSCAS = int(os.getenv("PRO_LIMITE_BUSCAS", "1000"))
PRO_LIMITE_EMBEDDINGS = int(os.getenv("PRO_LIMITE_EMBEDDINGS", "1000"))
FREE_LIMITE_BUSCAS = int(os.getenv("FREE_LIMITE_BUSCAS", "10"))
FREE_LIMITE_EMBEDDINGS = int(os.getenv("FREE_LIMITE_EMBEDDINGS", "10"))
TRIAL_DIAS = int(os.getenv("TRIAL_DIAS", "3"))
KANBAN_STATUS_ORDER = ["novo", "verificando", "em_producao", "teste", "fechado"]
KANBAN_STATUS_SET = set(KANBAN_STATUS_ORDER)
DEFAULT_KANBAN_NAME = "Kanban principal"

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
embeddings_model = None

def get_embeddings_model():
    """Obter modelo de embeddings (singleton)"""
    global embeddings_model
    if embeddings_model is None and OPENAI_API_KEY:
        embeddings_model = OpenAIEmbeddings(
            openai_api_key=OPENAI_API_KEY,
            model="text-embedding-3-small"
        )
    return embeddings_model

def gerar_embedding(texto: str):
    """Gerar embedding para um texto"""
    model = get_embeddings_model()
    if not model:
        return None
    try:
        return model.embed_query(texto)
    except Exception as e:
        print(f"Erro ao gerar embedding: {e}")
        return None


def ensure_ideias_kanban_columns():
    """Garante as colunas mínimas do Kanban sem exigir migração manual."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.ideias')")
            if not cur.fetchone()[0]:
                print("⚠️  Tabela public.ideias ausente; Kanban não foi inicializado.")
                return

            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS kanban_status VARCHAR(30)
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS kanban_ativo BOOLEAN DEFAULT FALSE
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS kanban_updated_at TIMESTAMPTZ
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS agenda_data TIMESTAMPTZ
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS agenda_observacao TEXT
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ideias_kanban_historico (
                    id BIGSERIAL PRIMARY KEY,
                    ideia_id BIGINT NOT NULL REFERENCES ideias(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL,
                    de_status VARCHAR(30),
                    para_status VARCHAR(30) NOT NULL,
                    observacao TEXT,
                    moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ideias_kanban_historico_ideia_data
                ON ideias_kanban_historico (ideia_id, moved_at DESC)
                """
            )
            cur.execute(
                """
                UPDATE ideias
                SET kanban_ativo = FALSE
                WHERE kanban_ativo IS NULL
                """
            )
            conn.commit()
            print("✅ Colunas do Kanban verificadas em ideias.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"⚠️  Não foi possível preparar colunas do Kanban: {e}")
    finally:
        if conn:
            conn.close()


def _serialize_datetime_fields(record: dict, fields: List[str]) -> dict:
    serialized = dict(record)
    for field in fields:
        value = serialized.get(field)
        if value and hasattr(value, "isoformat"):
            serialized[field] = value.isoformat()
    return serialized


def _validate_kanban_status(status: str) -> str:
    normalized = (status or "").strip().lower()
    if normalized not in KANBAN_STATUS_SET:
        raise HTTPException(
            status_code=400,
            detail=f"Status inválido para o Kanban. Use: {', '.join(KANBAN_STATUS_ORDER)}",
        )
    return normalized


def _insert_kanban_history(cur, ideia_id: int, usuario_id: int, para_status: str, de_status: Optional[str] = None, observacao: Optional[str] = None):
    cur.execute(
        """
        INSERT INTO ideias_kanban_historico (ideia_id, usuario_id, de_status, para_status, observacao)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (ideia_id, usuario_id, de_status, para_status, observacao),
    )


def _constraint_exists(cur, table_name: str, constraint_name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = %s
          AND constraint_name = %s
        """,
        (table_name, constraint_name),
    )
    return cur.fetchone() is not None


def ensure_workspace_schema():
    """Garante as tabelas de espaços/projetos e o vínculo de ideias a projetos."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    to_regclass('public.usuarios'),
                    to_regclass('public.ideias')
                """
            )
            usuarios_table, ideias_table = cur.fetchone()
            if not usuarios_table or not ideias_table:
                print("⚠️  Tabelas public.usuarios/public.ideias ausentes; workspace não foi inicializado.")
                return

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS espacos (
                    id BIGSERIAL PRIMARY KEY,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    nome VARCHAR(160) NOT NULL,
                    descricao TEXT,
                    cor VARCHAR(20),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS projetos (
                    id BIGSERIAL PRIMARY KEY,
                    espaco_id BIGINT NOT NULL REFERENCES espacos(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    nome VARCHAR(160) NOT NULL,
                    descricao TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_espacos_usuario_nome
                ON espacos (usuario_id, lower(nome))
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_espaco_nome
                ON projetos (espaco_id, lower(nome))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_projetos_usuario_espaco
                ON projetos (usuario_id, espaco_id)
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS projeto_id BIGINT
                """
            )
            if not _constraint_exists(cur, "ideias", "ideias_projeto_id_fkey"):
                cur.execute(
                    """
                    ALTER TABLE ideias
                    ADD CONSTRAINT ideias_projeto_id_fkey
                    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL
                    """
                )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ideias_usuario_projeto
                ON ideias (usuario_id, projeto_id)
                """
            )
            conn.commit()
            print("✅ Estrutura de espaços e projetos verificada.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"⚠️  Não foi possível preparar espaços e projetos: {e}")
    finally:
        if conn:
            conn.close()


IDEIA_SELECT_FIELDS = """
    i.id,
    i.titulo,
    i.tag,
    i.ideia,
    i.data,
    i.created_at,
    i.updated_at,
    i.kanban_ativo,
    i.kanban_status,
    i.kanban_updated_at,
    i.agenda_data,
    i.agenda_observacao,
    i.projeto_id,
    p.nome AS projeto_nome,
    e.id AS espaco_id,
    e.nome AS espaco_nome
"""


def _fetch_workspace_tree(cur, usuario_id: int) -> List[dict]:
    cur.execute(
        """
        SELECT
            e.id,
            e.nome,
            e.descricao,
            e.cor,
            e.created_at,
            e.updated_at
        FROM espacos e
        WHERE e.usuario_id = %s
        ORDER BY lower(e.nome), e.id
        """,
        (usuario_id,),
    )
    espacos = {
        row["id"]: {
            **_serialize_datetime_fields(dict(row), ["created_at", "updated_at"]),
            "projetos": [],
        }
        for row in cur.fetchall()
    }

    cur.execute(
        """
        SELECT
            p.id,
            p.espaco_id,
            p.nome,
            p.descricao,
            p.created_at,
            p.updated_at,
            COUNT(i.id) AS ideias_count,
            COUNT(CASE WHEN i.kanban_ativo IS TRUE THEN 1 END) AS kanban_count
        FROM projetos p
        LEFT JOIN ideias i
            ON i.projeto_id = p.id
           AND i.usuario_id = p.usuario_id
        WHERE p.usuario_id = %s
        GROUP BY p.id, p.espaco_id, p.nome, p.descricao, p.created_at, p.updated_at
        ORDER BY lower(p.nome), p.id
        """,
        (usuario_id,),
    )
    for projeto in cur.fetchall():
        espaco = espacos.get(projeto["espaco_id"])
        if not espaco:
            continue
        espaco["projetos"].append(
            {
                **_serialize_datetime_fields(dict(projeto), ["created_at", "updated_at"]),
                "ideias_count": int(projeto.get("ideias_count") or 0),
                "kanban_count": int(projeto.get("kanban_count") or 0),
            }
        )

    return list(espacos.values())


def _fetch_idea_record(cur, ideia_id: int, usuario_id: int) -> Optional[dict]:
    cur.execute(
        f"""
        SELECT
            {IDEIA_SELECT_FIELDS}
        FROM ideias i
        LEFT JOIN projetos p
            ON p.id = i.projeto_id
           AND p.usuario_id = i.usuario_id
        LEFT JOIN espacos e
            ON e.id = p.espaco_id
        WHERE i.id = %s AND i.usuario_id = %s
        """,
        (ideia_id, usuario_id),
    )
    ideia = cur.fetchone()
    if not ideia:
        return None
    return _serialize_datetime_fields(
        dict(ideia),
        ["data", "created_at", "updated_at", "kanban_updated_at", "agenda_data"],
    )


def _fetch_ideas_for_user(cur, usuario_id: int) -> List[dict]:
    cur.execute(
        f"""
        SELECT
            {IDEIA_SELECT_FIELDS}
        FROM ideias i
        LEFT JOIN projetos p
            ON p.id = i.projeto_id
           AND p.usuario_id = i.usuario_id
        LEFT JOIN espacos e
            ON e.id = p.espaco_id
        WHERE i.usuario_id = %s
        ORDER BY i.kanban_updated_at DESC NULLS LAST, i.data DESC
        """,
        (usuario_id,),
    )
    return [
        _serialize_datetime_fields(
            dict(ideia),
            ["data", "created_at", "updated_at", "kanban_updated_at", "agenda_data"],
        )
        for ideia in cur.fetchall()
    ]


def _validate_project_access(cur, projeto_id: Optional[int], usuario_id: int) -> Optional[int]:
    if projeto_id in (None, ""):
        return None

    try:
        projeto_id = int(projeto_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Projeto inválido")

    cur.execute(
        """
        SELECT p.id
        FROM projetos p
        WHERE p.id = %s AND p.usuario_id = %s
        """,
        (projeto_id, usuario_id),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Projeto não encontrado para este usuário")
    return projeto_id


def _normalize_workspace_name(value: str, entity_label: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"Nome de {entity_label} é obrigatório")
    if len(normalized) > 160:
        raise HTTPException(status_code=400, detail=f"Nome de {entity_label} deve ter no máximo 160 caracteres")
    return normalized

def ensure_workspace_schema():
    """Garante as tabelas de espacos, projetos, kanbans e os vinculos das ideias."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    to_regclass('public.usuarios'),
                    to_regclass('public.ideias')
                """
            )
            usuarios_table, ideias_table = cur.fetchone()
            if not usuarios_table or not ideias_table:
                print("Tabelas public.usuarios/public.ideias ausentes; workspace nao foi inicializado.")
                return

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS espacos (
                    id BIGSERIAL PRIMARY KEY,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    nome VARCHAR(160) NOT NULL,
                    descricao TEXT,
                    cor VARCHAR(20),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS projetos (
                    id BIGSERIAL PRIMARY KEY,
                    espaco_id BIGINT NOT NULL REFERENCES espacos(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    nome VARCHAR(160) NOT NULL,
                    descricao TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS kanbans (
                    id BIGSERIAL PRIMARY KEY,
                    projeto_id BIGINT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
                    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    nome VARCHAR(160) NOT NULL,
                    descricao TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
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
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_espacos_usuario_nome
                ON espacos (usuario_id, lower(nome))
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_espaco_nome
                ON projetos (espaco_id, lower(nome))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_projetos_usuario_espaco
                ON projetos (usuario_id, espaco_id)
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_kanbans_projeto_nome
                ON kanbans (projeto_id, lower(nome))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_kanbans_usuario_projeto
                ON kanbans (usuario_id, projeto_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_kanban_cards_usuario_kanban
                ON kanban_cards (usuario_id, kanban_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_kanban_cards_usuario_projeto
                ON kanban_cards (usuario_id, projeto_id)
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS projeto_id BIGINT
                """
            )
            cur.execute(
                """
                ALTER TABLE ideias
                ADD COLUMN IF NOT EXISTS kanban_id BIGINT
                """
            )
            if not _constraint_exists(cur, "ideias", "ideias_projeto_id_fkey"):
                cur.execute(
                    """
                    ALTER TABLE ideias
                    ADD CONSTRAINT ideias_projeto_id_fkey
                    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL
                    """
                )
            if not _constraint_exists(cur, "ideias", "ideias_kanban_id_fkey"):
                cur.execute(
                    """
                    ALTER TABLE ideias
                    ADD CONSTRAINT ideias_kanban_id_fkey
                    FOREIGN KEY (kanban_id) REFERENCES kanbans(id) ON DELETE SET NULL
                    """
                )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ideias_usuario_projeto
                ON ideias (usuario_id, projeto_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ideias_usuario_kanban
                ON ideias (usuario_id, kanban_id)
                """
            )
            cur.execute(
                """
                INSERT INTO kanbans (projeto_id, usuario_id, nome, descricao)
                SELECT
                    p.id,
                    p.usuario_id,
                    %s,
                    'Quadro inicial criado automaticamente'
                FROM projetos p
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM kanbans k
                    WHERE k.projeto_id = p.id
                )
                """,
                (DEFAULT_KANBAN_NAME,),
            )
            cur.execute(
                """
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
                  AND i.kanban_id IS NULL
                """
            )
            conn.commit()
            print("Estrutura de espacos, projetos e kanbans verificada.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Nao foi possivel preparar espacos, projetos e kanbans: {e}")
    finally:
        if conn:
            conn.close()


IDEIA_SELECT_FIELDS = """
    i.id,
    i.titulo,
    i.tag,
    i.ideia,
    i.data,
    i.created_at,
    i.updated_at,
    i.kanban_id,
    k.nome AS kanban_nome,
    i.kanban_ativo,
    i.kanban_status,
    i.kanban_updated_at,
    i.agenda_data,
    i.agenda_observacao,
    i.projeto_id,
    p.nome AS projeto_nome,
    e.id AS espaco_id,
    e.nome AS espaco_nome
"""


def _serialize_kanban_record(record: dict) -> dict:
    serialized = _serialize_datetime_fields(dict(record), ["created_at", "updated_at"])
    serialized["cards_count"] = int(record.get("cards_count") or 0)
    return serialized


def _serialize_kanban_card_record(record: dict) -> dict:
    return _serialize_datetime_fields(dict(record), ["created_at", "updated_at"])


def _fetch_workspace_projects(cur, usuario_id: int, espaco_id: Optional[int] = None) -> List[dict]:
    filters = ["p.usuario_id = %s"]
    params: List[object] = [usuario_id, usuario_id, usuario_id]

    if espaco_id is not None:
        filters.append("p.espaco_id = %s")
        params.append(espaco_id)

    cur.execute(
        f"""
        WITH ideias_stats AS (
            SELECT
                projeto_id,
                COUNT(*) AS ideias_count,
                COUNT(CASE WHEN kanban_ativo IS TRUE THEN 1 END) AS ideias_no_kanban
            FROM ideias
            WHERE usuario_id = %s
            GROUP BY projeto_id
        ),
        cards_stats AS (
            SELECT
                projeto_id,
                COUNT(*) AS cards_count
            FROM kanban_cards
            WHERE usuario_id = %s
            GROUP BY projeto_id
        )
        SELECT
            p.id,
            p.espaco_id,
            p.nome,
            p.descricao,
            p.created_at,
            p.updated_at,
            COALESCE(ideias_stats.ideias_count, 0) AS ideias_count,
            COALESCE(ideias_stats.ideias_no_kanban, 0) + COALESCE(cards_stats.cards_count, 0) AS kanban_count
        FROM projetos p
        LEFT JOIN ideias_stats
            ON ideias_stats.projeto_id = p.id
        LEFT JOIN cards_stats
            ON cards_stats.projeto_id = p.id
        WHERE {' AND '.join(filters)}
        ORDER BY lower(p.nome), p.id
        """,
        tuple(params),
    )
    return cur.fetchall()


def _fetch_project_kanbans(cur, usuario_id: int) -> dict:
    cur.execute(
        """
        WITH ideias_stats AS (
            SELECT
                kanban_id,
                COUNT(*) AS cards_count
            FROM ideias
            WHERE usuario_id = %s
              AND kanban_ativo IS TRUE
            GROUP BY kanban_id
        ),
        cards_stats AS (
            SELECT
                kanban_id,
                COUNT(*) AS cards_count
            FROM kanban_cards
            WHERE usuario_id = %s
            GROUP BY kanban_id
        )
        SELECT
            k.id,
            k.projeto_id,
            k.nome,
            k.descricao,
            k.created_at,
            k.updated_at,
            COALESCE(ideias_stats.cards_count, 0) + COALESCE(cards_stats.cards_count, 0) AS cards_count
        FROM kanbans k
        LEFT JOIN ideias_stats
            ON ideias_stats.kanban_id = k.id
        LEFT JOIN cards_stats
            ON cards_stats.kanban_id = k.id
        WHERE k.usuario_id = %s
        ORDER BY lower(k.nome), k.id
        """,
        (usuario_id, usuario_id, usuario_id),
    )
    kanbans_by_project = {}
    for row in cur.fetchall():
        kanbans_by_project.setdefault(row["projeto_id"], []).append(_serialize_kanban_record(row))
    return kanbans_by_project


def _build_project_workspace_response(projeto: dict, kanbans_by_project: dict) -> dict:
    return {
        **_serialize_datetime_fields(dict(projeto), ["created_at", "updated_at"]),
        "ideias_count": int(projeto.get("ideias_count") or 0),
        "kanban_count": int(projeto.get("kanban_count") or 0),
        "kanbans": kanbans_by_project.get(projeto["id"], []),
    }


def _fetch_workspace_tree(cur, usuario_id: int) -> List[dict]:
    cur.execute(
        """
        SELECT
            e.id,
            e.nome,
            e.descricao,
            e.cor,
            e.created_at,
            e.updated_at
        FROM espacos e
        WHERE e.usuario_id = %s
        ORDER BY lower(e.nome), e.id
        """,
        (usuario_id,),
    )
    espacos = {
        row["id"]: {
            **_serialize_datetime_fields(dict(row), ["created_at", "updated_at"]),
            "projetos": [],
        }
        for row in cur.fetchall()
    }

    kanbans_by_project = _fetch_project_kanbans(cur, usuario_id)

    for projeto in _fetch_workspace_projects(cur, usuario_id):
        espaco = espacos.get(projeto["espaco_id"])
        if not espaco:
            continue
        espaco["projetos"].append(_build_project_workspace_response(projeto, kanbans_by_project))

    return list(espacos.values())


def _fetch_idea_record(cur, ideia_id: int, usuario_id: int) -> Optional[dict]:
    cur.execute(
        f"""
        SELECT
            {IDEIA_SELECT_FIELDS}
        FROM ideias i
        LEFT JOIN kanbans k
            ON k.id = i.kanban_id
           AND k.usuario_id = i.usuario_id
        LEFT JOIN projetos p
            ON p.id = i.projeto_id
           AND p.usuario_id = i.usuario_id
        LEFT JOIN espacos e
            ON e.id = p.espaco_id
        WHERE i.id = %s AND i.usuario_id = %s
        """,
        (ideia_id, usuario_id),
    )
    ideia = cur.fetchone()
    if not ideia:
        return None
    return _serialize_datetime_fields(
        dict(ideia),
        ["data", "created_at", "updated_at", "kanban_updated_at", "agenda_data"],
    )


def _fetch_ideas_for_user(cur, usuario_id: int) -> List[dict]:
    cur.execute(
        f"""
        SELECT
            {IDEIA_SELECT_FIELDS}
        FROM ideias i
        LEFT JOIN kanbans k
            ON k.id = i.kanban_id
           AND k.usuario_id = i.usuario_id
        LEFT JOIN projetos p
            ON p.id = i.projeto_id
           AND p.usuario_id = i.usuario_id
        LEFT JOIN espacos e
            ON e.id = p.espaco_id
        WHERE i.usuario_id = %s
        ORDER BY i.kanban_updated_at DESC NULLS LAST, i.data DESC
        """,
        (usuario_id,),
    )
    return [
        _serialize_datetime_fields(
            dict(ideia),
            ["data", "created_at", "updated_at", "kanban_updated_at", "agenda_data"],
        )
        for ideia in cur.fetchall()
    ]


def _fetch_kanban_card_record(cur, card_id: int, usuario_id: int) -> Optional[dict]:
    cur.execute(
        """
        SELECT
            kc.id,
            kc.kanban_id,
            kc.projeto_id,
            kc.titulo,
            kc.descricao,
            kc.kanban_status,
            kc.created_at,
            kc.updated_at
        FROM kanban_cards kc
        WHERE kc.id = %s AND kc.usuario_id = %s
        """,
        (card_id, usuario_id),
    )
    card = cur.fetchone()
    return _serialize_kanban_card_record(card) if card else None


def _fetch_kanban_cards_for_kanban(cur, kanban_id: int, usuario_id: int) -> List[dict]:
    cur.execute(
        """
        SELECT
            kc.id,
            kc.kanban_id,
            kc.projeto_id,
            kc.titulo,
            kc.descricao,
            kc.kanban_status,
            kc.created_at,
            kc.updated_at
        FROM kanban_cards kc
        WHERE kc.kanban_id = %s
          AND kc.usuario_id = %s
        ORDER BY kc.updated_at DESC, kc.id DESC
        """,
        (kanban_id, usuario_id),
    )
    return [_serialize_kanban_card_record(card) for card in cur.fetchall()]


def _validate_kanban_access(cur, kanban_id: Optional[int], usuario_id: int, projeto_id: Optional[int] = None) -> Optional[dict]:
    if kanban_id in (None, ""):
        return None

    try:
        kanban_id = int(kanban_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Kanban invalido")

    cur.execute(
        """
        SELECT k.id, k.projeto_id, k.nome
        FROM kanbans k
        WHERE k.id = %s AND k.usuario_id = %s
        """,
        (kanban_id, usuario_id),
    )
    kanban = cur.fetchone()
    if not kanban:
        raise HTTPException(status_code=404, detail="Kanban nao encontrado para este usuario")

    if projeto_id is not None and kanban["projeto_id"] != projeto_id:
        raise HTTPException(status_code=400, detail="Kanban nao pertence ao projeto informado")

    return dict(kanban)


app = FastAPI(title="Sacola de Ideias API")

# Evento de startup para verificar endpoints registrados e testar conexão
@app.on_event("startup")
async def startup_event():
    print("=" * 80)
    ensure_workspace_schema()
    ensure_ideias_kanban_columns()
    print("=" * 80)
    # Diagnóstico rápido do Stripe (não expõe segredos)
    try:
        from stripe import _version as _stripe_version
        print(f"💳 Stripe SDK: {_stripe_version.VERSION}")
        print(f"   stripe module: {getattr(stripe, '__file__', 'n/a')}")
        print(f"   checkout module: {getattr(stripe_checkout, '__file__', 'n/a')}")
        print(f"   has stripe.apps.Secret: {hasattr(getattr(stripe, 'apps', None), 'Secret')}")
    except Exception as e:
        print(f"⚠️  Falha ao inspecionar Stripe SDK: {e}")
    print("📋 TODOS OS ENDPOINTS REGISTRADOS:")
    total_routes = 0
    lembrancas_routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            total_routes += 1
            methods = getattr(route, 'methods', set())
            if 'lembrancas' in route.path:
                lembrancas_routes.append(f"{list(methods)} {route.path}")
                print(f"   ✅ {list(methods)} {route.path}")
    print(f"📊 Total de rotas: {total_routes}")
    if lembrancas_routes:
        print("✅ Endpoints de lembranças encontrados!")
    else:
        print("❌ NENHUM endpoint de lembranças encontrado!")
    print("=" * 80)
    
    # Testar conexão com o banco
    print("=" * 80)
    print("🔌 TESTANDO CONEXÃO COM O BANCO DE DADOS:")
    safe_db_config = sanitize_db_config(DB_CONFIG)
    print(f"   Source: {DB_CONFIG_SOURCE}")
    print(f"   Host: {safe_db_config['host']}")
    print(f"   Port: {safe_db_config['port']}")
    print(f"   Database: {safe_db_config['database']}")
    print(f"   User: {safe_db_config['user']}")
    print(f"   Password: {safe_db_config['password']}")
    print("=" * 80)
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            cur.execute(
                """
                SELECT
                    current_database(),
                    current_schema(),
                    to_regclass('public.usuarios'),
                    to_regclass('public.assinaturas')
                """
            )
            current_database, current_schema, usuarios_table, assinaturas_table = cur.fetchone()
            print(f"✅ Conexão com o banco estabelecida com sucesso!")
            print(f"   PostgreSQL version: {version[:50]}...")
            print(f"   current_database(): {current_database}")
            print(f"   current_schema(): {current_schema}")
            print(f"   public.usuarios: {usuarios_table or 'AUSENTE'}")
            print(f"   public.assinaturas: {assinaturas_table or 'AUSENTE'}")
            if not usuarios_table or not assinaturas_table:
                print("⚠️  O backend conectou, mas o schema esperado não está nesse banco/schema.")
        conn.close()
    except Exception as e:
        print(f"❌ ERRO ao conectar com o banco: {e}")
        print(f"   Verifique as credenciais no arquivo .env")
    print("=" * 80)
    print(f"🌐 CORS_ORIGINS: {CORS_ORIGINS}")
    print("=" * 80)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração do banco de dados (Supabase Postgres ou PostgreSQL direto)
# Aceita DATABASE_URL/SUPABASE_DB_URL para evitar divergência entre ambientes.
DB_CONFIG, DB_CONFIG_SOURCE = build_db_config(default_database="postgres")


def _extract_missing_relation_name(error: Exception) -> Optional[str]:
    match = re.search(r'relation "([^"]+)" does not exist', str(error), re.IGNORECASE)
    return match.group(1) if match else None


def _missing_relation_detail(table_name: Optional[str] = None) -> str:
    alvo = f'Tabela "{table_name}"' if table_name else "Uma tabela obrigatória"
    return (
        f"{alvo} não existe no banco configurado. "
        "Verifique DATABASE_URL/SUPABASE_DB_URL ou DB_HOST/DB_NAME/DB_USER/DB_PASSWORD "
        "no backend; a API provavelmente está conectada em outro banco ou schema."
    )

def get_db_connection():
    """Criar conexão com o banco de dados"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.OperationalError as e:
        safe_db_config = sanitize_db_config(DB_CONFIG)
        print(f"❌ Erro de conexão com o banco: {e}")
        print(f"   Source: {DB_CONFIG_SOURCE}")
        print(f"   Host: {safe_db_config.get('host', 'N/A')}")
        print(f"   Port: {safe_db_config.get('port', 'N/A')}")
        print(f"   Database: {safe_db_config.get('database', 'N/A')}")
        print(f"   User: {safe_db_config.get('user', 'N/A')}")
        print(f"   Password configurada: {'Sim' if DB_CONFIG.get('password') else 'NÃO'}")
        print(f"   SSL Mode: {safe_db_config.get('sslmode', 'não especificado')}")
        raise HTTPException(
            status_code=503, 
            detail=f"Erro ao conectar ao banco de dados. Verifique as credenciais no .env. Detalhes: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Erro inesperado ao conectar: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro inesperado ao conectar ao banco: {str(e)}"
        )

# Modelos Pydantic
class IdeiaBase(BaseModel):
    titulo: str
    tag: Optional[str] = None
    ideia: str
    projeto_id: Optional[int] = None

class IdeiaCreate(IdeiaBase):
    pass

class IdeiaUpdate(IdeiaBase):
    pass

class IdeiaResponse(IdeiaBase):
    id: int
    data: datetime
    created_at: datetime
    updated_at: datetime
    kanban_id: Optional[int] = None
    kanban_nome: Optional[str] = None
    kanban_ativo: Optional[bool] = False
    kanban_status: Optional[str] = None
    kanban_updated_at: Optional[datetime] = None
    agenda_data: Optional[datetime] = None
    agenda_observacao: Optional[str] = None
    projeto_nome: Optional[str] = None
    espaco_id: Optional[int] = None
    espaco_nome: Optional[str] = None
    
    class Config:
        from_attributes = True

class IdeiaComEmbedding(BaseModel):
    ideia: IdeiaCreate
    embedding: List[float]

class BuscaRequest(BaseModel):
    termo: str
    limite: Optional[int] = 10
    probes: Optional[int] = 15

class BuscaResponse(BaseModel):
    id: int
    titulo: str
    tag: Optional[str]
    ideia: str
    data: datetime
    similarity: float


class KanbanStatusUpdate(BaseModel):
    kanban_status: str


class KanbanStartRequest(BaseModel):
    kanban_id: int
    kanban_status: Optional[str] = None


class AgendaUpdate(BaseModel):
    agenda_data: Optional[datetime] = None
    agenda_observacao: Optional[str] = None


class EspacoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None


class EspacoUpdate(BaseModel):
    nome: str


class ProjetoCreate(BaseModel):
    espaco_id: int
    nome: str
    descricao: Optional[str] = None
    kanban_nome_inicial: Optional[str] = None


class ProjetoVinculoUpdate(BaseModel):
    projeto_id: Optional[int] = None
    kanban_id: Optional[int] = None


class KanbanCreate(BaseModel):
    projeto_id: int
    nome: str
    descricao: Optional[str] = None


class KanbanWorkspaceResponse(BaseModel):
    id: int
    projeto_id: int
    nome: str
    descricao: Optional[str] = None
    cards_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjetoWorkspaceResponse(BaseModel):
    id: int
    espaco_id: int
    nome: str
    descricao: Optional[str] = None
    ideias_count: int = 0
    kanban_count: int = 0
    kanbans: List[KanbanWorkspaceResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class EspacoWorkspaceResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    projetos: List[ProjetoWorkspaceResponse] = Field(default_factory=list)


class KanbanHistoryEntry(BaseModel):
    id: int
    ideia_id: int
    usuario_id: int
    de_status: Optional[str] = None
    para_status: str
    observacao: Optional[str] = None
    moved_at: datetime


class KanbanCardCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    kanban_status: Optional[str] = "novo"


class KanbanCardUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    kanban_status: Optional[str] = None


class KanbanCardResponse(BaseModel):
    id: int
    kanban_id: int
    projeto_id: int
    titulo: str
    descricao: Optional[str] = None
    kanban_status: str
    created_at: datetime
    updated_at: datetime

class BackfillEmbeddingsRequest(BaseModel):
    limite: Optional[int] = 50
    forcar: Optional[bool] = False


class AcessoCreate(BaseModel):
    usuario_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    pais: Optional[str] = None
    cidade: Optional[str] = None
    regiao: Optional[str] = None
    timezone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    endpoint: str
    metodo_http: str
    status_code: int
    tempo_resposta_ms: Optional[int] = None

class GoogleAuthRequest(BaseModel):
    code: str
    redirect_uri: str

class UserResponse(BaseModel):
    id: int
    email: str
    nome: Optional[str]
    foto_url: Optional[str]
    metodo_auth: str
    role: str
    token: str

class RegisterRequest(BaseModel):
    email: str
    senha: str
    nome: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    senha: str

class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str

# Função para obter usuário autenticado
async def obter_usuario_atual(request: Request) -> dict:
    """Extrair usuário do token JWT - LANÇA EXCEÇÃO se não autenticado"""
    import sys
    sys.stdout.flush()  # Forçar saída imediata
    print("=" * 80, flush=True)
    print("🔐 [obter_usuario_atual] Processando autenticação", flush=True)
    
    # Tentar obter o header Authorization de diferentes formas
    authorization = request.headers.get("Authorization") or request.headers.get("authorization")
    
    print(f"   Authorization header recebido: {bool(authorization)}")
    
    if not authorization:
        print("❌ ERRO: Authorization header não recebido!")
        print(f"   Headers disponíveis: {list(request.headers.keys())}")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token de autenticação não fornecido")
    
    print(f"   Authorization header: {authorization[:50]}..." if len(authorization) > 50 else f"   Authorization header: {authorization}")
    
    if not authorization.startswith("Bearer "):
        print(f"❌ ERRO: Authorization header inválido (não começa com 'Bearer '): {authorization[:30]}...")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Formato de token inválido. Use 'Bearer <token>'")
    
    token = authorization.split(" ")[1]
    print(f"   Token extraído: {token[:30]}...")
    
    payload = verificar_token_jwt(token)
    
    if not payload:
        print("❌ ERRO: Token inválido ou expirado - verificar_token_jwt retornou None")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    user_id = payload.get('user_id')
    email = payload.get('email', 'N/A')
    print(f"✅ Token válido decodificado!")
    print(f"   Payload completo: {payload}")
    print(f"   user_id extraído: {user_id}")
    print(f"   email extraído: {email}")
    
    if not user_id:
        print("❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo: {payload}")
        print(f"   Chaves disponíveis no payload: {list(payload.keys())}")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado no token")
    
    print("=" * 80)
    return payload

# -----------------------------------------------------
# Assinaturas / Trial (3 dias) - helpers
# -----------------------------------------------------
def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        text = str(value)
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _now_utc():
    return datetime.now(timezone.utc)


def _is_expired(dt_value: Optional[datetime]) -> bool:
    if not dt_value:
        return True
    if dt_value.tzinfo:
        return dt_value < _now_utc()
    return dt_value < datetime.utcnow()


def _get_assinatura_row(usuario_id: int) -> Optional[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM assinaturas WHERE usuario_id = %s ORDER BY id DESC LIMIT 1",
                (usuario_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def _trial_expira_em_from_row(row: Optional[dict]) -> Optional[datetime]:
    if not row:
        return None
    exp = _parse_datetime(row.get("trial_expira_em"))
    if exp:
        return exp
    criado = _parse_datetime(row.get("criado_em")) or _parse_datetime(row.get("created_at"))
    if criado:
        return criado + timedelta(days=TRIAL_DIAS)
    return None


def _assinatura_ativa(row: Optional[dict]) -> bool:
    if not row:
        return False
    plano = (row.get("plano") or "").lower()
    status = (row.get("status") or "").lower()
    if plano == "pro" and status in ("ativa", "active", "trialing"):
        return True
    if plano == "free":
        exp = _trial_expira_em_from_row(row)
        return exp is not None and not _is_expired(exp)
    return False


def _has_assinaturas_column(cur, column: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = %s",
        (column,),
    )
    return cur.fetchone() is not None


def _insert_trial_assinatura(cur, usuario_id: int) -> Optional[datetime]:
    """Cria assinatura free com trial configurável (se a coluna existir)."""
    trial_expira = _now_utc() + timedelta(days=TRIAL_DIAS)
    if _has_assinaturas_column(cur, "trial_expira_em"):
        cur.execute(
            """
            INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings, trial_expira_em)
            VALUES (%s, 'free', 'trial', %s, %s, %s)
            """,
            (usuario_id, FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS, trial_expira),
        )
        return trial_expira
    cur.execute(
        """
        INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings)
        VALUES (%s, 'free', 'trial', %s, %s)
        """,
        (usuario_id, FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS),
    )
    return None


async def obter_usuario_assinante(user: dict = Depends(obter_usuario_atual)) -> dict:
    """Permite acesso somente se assinatura estiver ativa (pro) ou trial válido."""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    role = (user.get("role") or "").lower()
    if role in ("admin", "superadmin"):
        return user

    usuario_id = user.get("user_id")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    assinatura = _get_assinatura_row(usuario_id)
    if _assinatura_ativa(assinatura):
        return user

    raise HTTPException(
        status_code=402,
        detail="Trial expirado. Ative o plano Pro para continuar.",
    )

# Rotas
@app.get("/")
def root():
    return {"message": "Sacola de Ideias API", "status": "online"}


@app.get("/api/workspace", response_model=List[EspacoWorkspaceResponse])
def buscar_workspace(user: dict = Depends(obter_usuario_atual)):
    """Retorna a árvore de espaços e projetos do usuário autenticado."""
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            return _fetch_workspace_tree(cur, usuario_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar workspace: {str(e)}")
    finally:
        conn.close()


@app.post("/api/espacos", response_model=EspacoWorkspaceResponse)
def criar_espaco(payload: EspacoCreate, user: dict = Depends(obter_usuario_atual)):
    """Cria um novo espaço para o usuário autenticado."""
    usuario_id = user["user_id"]
    nome = _normalize_workspace_name(payload.nome, "espaço")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO espacos (usuario_id, nome, descricao, cor)
                VALUES (%s, %s, %s, %s)
                RETURNING id, nome, descricao, cor, created_at, updated_at
                """,
                (
                    usuario_id,
                    nome,
                    payload.descricao.strip() if payload.descricao else None,
                    payload.cor.strip() if payload.cor else None,
                ),
            )
            espaco = cur.fetchone()
            conn.commit()
            return {
                **_serialize_datetime_fields(dict(espaco), ["created_at", "updated_at"]),
                "projetos": [],
            }
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Já existe um espaço com esse nome")
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar espaço: {str(e)}")
    finally:
        conn.close()


@app.patch("/api/espacos/{espaco_id}", response_model=EspacoWorkspaceResponse)
def atualizar_espaco(
    espaco_id: int,
    payload: EspacoUpdate,
    user: dict = Depends(obter_usuario_atual),
):
    """Renomeia um espaço do usuário autenticado."""
    usuario_id = user["user_id"]
    nome = _normalize_workspace_name(payload.nome, "espaço")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE espacos
                SET nome = %s,
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                RETURNING id, nome, descricao, cor, created_at, updated_at
                """,
                (nome, espaco_id, usuario_id),
            )
            espaco = cur.fetchone()
            if not espaco:
                raise HTTPException(status_code=404, detail="Espaço não encontrado")

            projetos_rows = _fetch_workspace_projects(cur, usuario_id, espaco_id)
            kanbans_by_project = _fetch_project_kanbans(cur, usuario_id)
            projetos = [
                _build_project_workspace_response(projeto, kanbans_by_project)
                for projeto in projetos_rows
            ]
            conn.commit()
            return {
                **_serialize_datetime_fields(dict(espaco), ["created_at", "updated_at"]),
                "projetos": projetos,
            }
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Já existe um espaço com esse nome")
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar espaço: {str(e)}")
    finally:
        conn.close()


@app.delete("/api/espacos/{espaco_id}")
def excluir_espaco(espaco_id: int, user: dict = Depends(obter_usuario_atual)):
    """Exclui um espaço do usuário autenticado."""
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                DELETE FROM espacos
                WHERE id = %s AND usuario_id = %s
                RETURNING id
                """,
                (espaco_id, usuario_id),
            )
            espaco = cur.fetchone()
            if not espaco:
                raise HTTPException(status_code=404, detail="Espaço não encontrado")
            conn.commit()
            return {"detail": "Espaço excluído com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir espaço: {str(e)}")
    finally:
        conn.close()


@app.post("/api/projetos", response_model=ProjetoWorkspaceResponse)
def criar_projeto(payload: ProjetoCreate, user: dict = Depends(obter_usuario_atual)):
    """Cria um novo projeto dentro de um espaço do usuário."""
    usuario_id = user["user_id"]
    nome = _normalize_workspace_name(payload.nome, "projeto")
    kanban_nome_inicial = _normalize_workspace_name(
        payload.kanban_nome_inicial or DEFAULT_KANBAN_NAME,
        "kanban",
    )
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM espacos
                WHERE id = %s AND usuario_id = %s
                """,
                (payload.espaco_id, usuario_id),
            )
            espaco = cur.fetchone()
            if not espaco:
                raise HTTPException(status_code=404, detail="Espaço não encontrado para este usuário")

            cur.execute(
                """
                INSERT INTO projetos (espaco_id, usuario_id, nome, descricao)
                VALUES (%s, %s, %s, %s)
                RETURNING id, espaco_id, nome, descricao, created_at, updated_at
                """,
                (
                    payload.espaco_id,
                    usuario_id,
                    nome,
                    payload.descricao.strip() if payload.descricao else None,
                ),
            )
            projeto = cur.fetchone()
            cur.execute(
                """
                INSERT INTO kanbans (projeto_id, usuario_id, nome, descricao)
                VALUES (%s, %s, %s, %s)
                RETURNING id, projeto_id, nome, descricao, created_at, updated_at
                """,
                (
                    projeto["id"],
                    usuario_id,
                    kanban_nome_inicial,
                    "Quadro inicial do projeto",
                ),
            )
            kanban = cur.fetchone()
            conn.commit()
            return {
                **_serialize_datetime_fields(dict(projeto), ["created_at", "updated_at"]),
                "ideias_count": 0,
                "kanban_count": 0,
                "kanbans": [_serialize_kanban_record(kanban)],
            }
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Já existe um projeto com esse nome neste espaço")
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar projeto: {str(e)}")
    finally:
        conn.close()


@app.post("/api/kanbans", response_model=KanbanWorkspaceResponse)
def criar_kanban(payload: KanbanCreate, user: dict = Depends(obter_usuario_atual)):
    """Cria um novo kanban dentro de um projeto do usuÃ¡rio."""
    usuario_id = user["user_id"]
    nome = _normalize_workspace_name(payload.nome, "kanban")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            projeto_id = _validate_project_access(cur, payload.projeto_id, usuario_id)
            if not projeto_id:
                raise HTTPException(status_code=400, detail="Projeto invÃ¡lido")

            cur.execute(
                """
                INSERT INTO kanbans (projeto_id, usuario_id, nome, descricao)
                VALUES (%s, %s, %s, %s)
                RETURNING id, projeto_id, nome, descricao, created_at, updated_at
                """,
                (
                    projeto_id,
                    usuario_id,
                    nome,
                    payload.descricao.strip() if payload.descricao else None,
                ),
            )
            kanban = cur.fetchone()
            conn.commit()
            return _serialize_kanban_record(kanban)
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="JÃ¡ existe um kanban com esse nome neste projeto")
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar kanban: {str(e)}")
    finally:
        conn.close()


@app.get("/api/kanbans/{kanban_id}/cards", response_model=List[KanbanCardResponse])
def listar_cards_kanban(kanban_id: int, user: dict = Depends(obter_usuario_atual)):
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _validate_kanban_access(cur, kanban_id, usuario_id)
            return _fetch_kanban_cards_for_kanban(cur, kanban_id, usuario_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar cards do kanban: {str(e)}")
    finally:
        conn.close()


@app.post("/api/kanbans/{kanban_id}/cards", response_model=KanbanCardResponse)
def criar_card_kanban(
    kanban_id: int,
    payload: KanbanCardCreate,
    user: dict = Depends(obter_usuario_atual),
):
    usuario_id = user["user_id"]
    titulo = _normalize_workspace_name(payload.titulo, "card")
    status_final = _validate_kanban_status(payload.kanban_status or "novo")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            kanban = _validate_kanban_access(cur, kanban_id, usuario_id)
            if not kanban:
                raise HTTPException(status_code=404, detail="Kanban nao encontrado")

            cur.execute(
                """
                INSERT INTO kanban_cards (kanban_id, projeto_id, usuario_id, titulo, descricao, kanban_status)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    kanban["id"],
                    kanban["projeto_id"],
                    usuario_id,
                    titulo,
                    payload.descricao.strip() if payload.descricao else None,
                    status_final,
                ),
            )
            card = cur.fetchone()
            card_completo = _fetch_kanban_card_record(cur, card["id"], usuario_id)
            conn.commit()
            return card_completo
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar card do kanban: {str(e)}")
    finally:
        conn.close()


@app.patch("/api/kanban-cards/{card_id}", response_model=KanbanCardResponse)
def atualizar_card_kanban(
    card_id: int,
    payload: KanbanCardUpdate,
    user: dict = Depends(obter_usuario_atual),
):
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            card_atual = _fetch_kanban_card_record(cur, card_id, usuario_id)
            if not card_atual:
                raise HTTPException(status_code=404, detail="Card do kanban nao encontrado")

            titulo = (
                _normalize_workspace_name(payload.titulo, "card")
                if payload.titulo is not None
                else card_atual["titulo"]
            )
            descricao = card_atual.get("descricao")
            if payload.descricao is not None:
                descricao = payload.descricao.strip() or None
            status_final = (
                _validate_kanban_status(payload.kanban_status)
                if payload.kanban_status is not None
                else card_atual["kanban_status"]
            )

            cur.execute(
                """
                UPDATE kanban_cards
                SET titulo = %s,
                    descricao = %s,
                    kanban_status = %s,
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                RETURNING id
                """,
                (titulo, descricao, status_final, card_id, usuario_id),
            )
            card = cur.fetchone()
            if not card:
                raise HTTPException(status_code=404, detail="Card do kanban nao encontrado")

            card_completo = _fetch_kanban_card_record(cur, card["id"], usuario_id)
            conn.commit()
            return card_completo
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar card do kanban: {str(e)}")
    finally:
        conn.close()


@app.patch("/api/ideias/{ideia_id}/projeto", response_model=IdeiaResponse)
def vincular_ideia_a_projeto(
    ideia_id: int,
    payload: ProjetoVinculoUpdate,
    user: dict = Depends(obter_usuario_atual),
):
    """Vincula ou remove o vínculo de uma ideia a um projeto do usuário."""
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, projeto_id, kanban_id, kanban_status, kanban_ativo
                FROM ideias
                WHERE id = %s AND usuario_id = %s
                """,
                (ideia_id, usuario_id),
            )
            ideia_existente = cur.fetchone()
            if not ideia_existente:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")

            projeto_id = _validate_project_access(cur, payload.projeto_id, usuario_id)
            kanban = _validate_kanban_access(cur, payload.kanban_id, usuario_id, projeto_id) if projeto_id else None
            projeto_anterior = ideia_existente.get("projeto_id")
            kanban_anterior = ideia_existente.get("kanban_id")
            status_anterior = (ideia_existente.get("kanban_status") or "").strip().lower() or None
            if status_anterior and status_anterior not in KANBAN_STATUS_SET:
                status_anterior = None

            possui_kanban = kanban is not None
            mudou_kanban = (
                projeto_id != projeto_anterior
                or kanban_anterior != (kanban["id"] if kanban else None)
            )

            if possui_kanban:
                kanban_status = (
                    "novo"
                    if mudou_kanban or not ideia_existente.get("kanban_ativo")
                    else (status_anterior or "novo")
                )
                kanban_ativo = True
                kanban_id_final = kanban["id"]
            else:
                kanban_status = None
                kanban_ativo = False
                kanban_id_final = None

            cur.execute(
                """
                UPDATE ideias
                SET projeto_id = %s,
                    kanban_id = %s,
                    kanban_ativo = %s,
                    kanban_status = %s,
                    kanban_updated_at = CASE
                        WHEN %s OR %s OR %s THEN NOW()
                        ELSE kanban_updated_at
                    END,
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                """,
                (
                    projeto_id,
                    kanban_id_final,
                    kanban_ativo,
                    kanban_status,
                    possui_kanban,
                    mudou_kanban,
                    ideia_existente.get("kanban_ativo") != kanban_ativo,
                    ideia_id,
                    usuario_id,
                ),
            )

            if possui_kanban and (
                mudou_kanban
                or not ideia_existente.get("kanban_ativo")
                or status_anterior != kanban_status
            ):
                _insert_kanban_history(
                    cur,
                    ideia_id=ideia_id,
                    usuario_id=usuario_id,
                    de_status=status_anterior if ideia_existente.get("kanban_ativo") else None,
                    para_status=kanban_status,
                    observacao=f"Card vinculado ao kanban {kanban['nome']}",
                )

            ideia_atualizada = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            if not ideia_atualizada:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")
            return ideia_atualizada
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao vincular ideia ao projeto: {str(e)}")
    finally:
        conn.close()

@app.get("/api/ideias", response_model=List[IdeiaResponse])
def buscar_todas_ideias(user: dict = Depends(obter_usuario_assinante)):
    """Buscar todas as ideias do usuário autenticado"""
    if not user:
        print("❌ ERRO: Tentativa de buscar ideias sem autenticação!")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id")
    usuario_email = user.get("email", "N/A")
    
    if not usuario_id:
        print(f"❌ ERRO: Token não contém 'user_id'! Payload: {user}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"🔍 Buscando ideias para usuario_id: {usuario_id} (email: {usuario_email})")
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Primeiro, verificar se existem ideias sem dono (para debug)
            cur.execute("SELECT COUNT(*) as total FROM ideias WHERE usuario_id IS NULL")
            sem_dono = cur.fetchone()["total"]
            if sem_dono > 0:
                print(f"⚠️  AVISO: Existem {sem_dono} ideia(s) sem dono (usuario_id IS NULL) no banco!")
            
            # Verificar total de ideias no banco (para debug)
            cur.execute("SELECT COUNT(*) as total FROM ideias")
            total_geral = cur.fetchone()["total"]
            print(f"📊 Total de ideias no banco: {total_geral}")

            ideias = _fetch_ideas_for_user(cur, usuario_id)
            print(f"✅ Encontradas {len(ideias)} ideia(s) para usuario_id: {usuario_id} (email: {usuario_email})")

            for ideia in ideias:
                print(f"   • ID {ideia['id']}: '{ideia['titulo']}' | Tag: '{ideia.get('tag', 'N/A')}'")

            print(f"✅ Retornando {len(ideias)} ideia(s) para o frontend")
            return ideias
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar ideias: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao buscar ideias: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/ideias/{ideia_id}", response_model=IdeiaResponse)
def buscar_ideia_por_id(ideia_id: int, user: dict = Depends(obter_usuario_assinante)):
    """Buscar ideia por ID (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            ideia = _fetch_idea_record(cur, ideia_id, usuario_id)
            if not ideia:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")
            return ideia
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar ideia: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias", response_model=IdeiaResponse)
async def criar_ideia(ideia: IdeiaCreate, request: Request, user: dict = Depends(obter_usuario_assinante)):
    """Criar nova ideia com embedding automático (associada ao usuário)"""
    import sys
    sys.stdout.flush()  # Forçar saída imediata
    print("=" * 80, flush=True)
    print("📝 NOVA REQUISIÇÃO: Criar Ideia", flush=True)
    print(f"   Payload recebido: titulo='{ideia.titulo}', tag='{ideia.tag}', ideia='{ideia.ideia[:50] if ideia.ideia else ''}...'")
    
    # Verificar headers diretamente
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    print(f"   Authorization header direto: {'Presente' if auth_header else 'AUSENTE!'}")
    
    print(f"   User object recebido: {user}")
    print(f"   Tipo do user: {type(user)}")
    print("=" * 80)
    
    if not user:
        print("❌ ERRO CRÍTICO: Tentativa de criar ideia sem autenticação!")
        print("   O header Authorization não foi enviado ou o token é inválido")
        print(f"   Headers recebidos: {list(request.headers.keys())}")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id") if isinstance(user, dict) else None
    usuario_email = user.get("email", "N/A") if isinstance(user, dict) else "N/A"
    
    if not usuario_id:
        print(f"❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo do token: {user}")
        print(f"   Tipo do user: {type(user)}")
        if isinstance(user, dict):
            print(f"   Chaves disponíveis no user: {list(user.keys())}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"✅ Autenticação OK: usuario_id={usuario_id}, email={usuario_email}")
    print(f"📝 Criando ideia para usuario_id: {usuario_id}, titulo: '{ideia.titulo}'")
    
    conn = get_db_connection()
    try:
        # Gerar embedding automaticamente se API Key estiver configurada
        embedding_str = None
        modelo = get_embeddings_model()
        if modelo:
            try:
                texto_completo = f"{ideia.titulo} {ideia.tag or ''} {ideia.ideia}".strip()
                embedding = gerar_embedding(texto_completo)
                if embedding:
                    embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                    print(f"   ✅ Embedding gerado: {len(embedding)} dimensões")
            except Exception as e:
                print(f"⚠️  Erro ao gerar embedding (salvando sem embedding): {e}")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            projeto_id = _validate_project_access(cur, ideia.projeto_id, usuario_id)

            # VALIDAÇÃO FINAL CRÍTICA: Garantir que usuario_id não é None antes do INSERT
            if usuario_id is None or usuario_id == "":
                error_msg = f"ERRO CRÍTICO: usuario_id é None ou vazio antes do INSERT! user={user}"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            # Garantir que é um número inteiro
            try:
                usuario_id = int(usuario_id)
            except (ValueError, TypeError):
                error_msg = f"ERRO CRÍTICO: usuario_id não é um número válido! usuario_id={usuario_id}, tipo={type(usuario_id)}"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            print(f"   💾 Executando INSERT com usuario_id={usuario_id} (tipo: {type(usuario_id)})", flush=True)
            print(f"   📋 Valores a inserir: titulo='{ideia.titulo}', tag='{ideia.tag}', usuario_id={usuario_id}", flush=True)
            
            # ÚLTIMA VERIFICAÇÃO ANTES DO INSERT - NUNCA PERMITIR NULL
            if usuario_id is None:
                import sys
                sys.stderr.write(f"❌ ERRO CRÍTICO: Tentativa de INSERT com usuario_id=None bloqueada!\n")
                sys.stderr.flush()
                conn.rollback()
                raise ValueError("usuario_id NÃO PODE SER None - operação bloqueada por segurança")
            
            # Garantir que é int
            usuario_id = int(usuario_id)
            
            if embedding_str:
                cur.execute(
                    """
                    INSERT INTO ideias (titulo, tag, ideia, embedding, usuario_id, projeto_id)
                    VALUES (%s, %s, %s, %s::vector, %s, %s)
                    RETURNING id
                    """,
                    (ideia.titulo, ideia.tag, ideia.ideia, embedding_str, usuario_id, projeto_id)
                )
            else:
                cur.execute(
                    """
                    INSERT INTO ideias (titulo, tag, ideia, usuario_id, projeto_id)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (ideia.titulo, ideia.tag, ideia.ideia, usuario_id, projeto_id)
                )
            
            nova_ideia = cur.fetchone()
            
            if not nova_ideia:
                error_msg = "ERRO: INSERT não retornou nenhum resultado!"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            # Verificar o que foi realmente salvo
            ideia_id = nova_ideia["id"]
            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            usuario_id_salvo = usuario_id
            print(f"   📊 Resultado do INSERT:")
            print(f"      • ID: {ideia_id}")
            print(f"      • Título: '{ideia.titulo}'")
            print(f"      • usuario_id SALVO: {usuario_id_salvo} (tipo: {type(usuario_id_salvo)})")
            
            if usuario_id_salvo is None:
                error_msg = "ERRO CRÍTICO: usuario_id foi salvo como NULL no banco apesar de validações!"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            if int(usuario_id_salvo) != int(usuario_id):
                print(f"   ⚠️  ATENÇÃO: usuario_id esperado ({usuario_id}) diferente do salvo ({usuario_id_salvo})")
            
            conn.commit()
            print(f"✅ Ideia criada com sucesso: ID {ideia_id}, usuario_id={usuario_id_salvo}")
            print("=" * 80)
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar ideia: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar ideia: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.post("/api/ideias/com-embedding", response_model=IdeiaResponse)
def criar_ideia_com_embedding(dados: IdeiaComEmbedding, user: dict = Depends(obter_usuario_assinante)):
    """Criar ideia com embedding (associada ao usuário)"""
    print("=" * 80)
    print("📝 NOVA REQUISIÇÃO: Criar Ideia COM Embedding")
    print(f"   Payload recebido: titulo='{dados.ideia.titulo}', tag='{dados.ideia.tag}'")
    print(f"   User object recebido: {user}")
    print("=" * 80)
    
    if not user:
        print("❌ ERRO CRÍTICO: Tentativa de criar ideia com embedding sem autenticação!")
        print("   O header Authorization não foi enviado ou o token é inválido")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id")
    usuario_email = user.get("email", "N/A")
    
    if not usuario_id:
        print(f"❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo do token: {user}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"✅ Autenticação OK: usuario_id={usuario_id}, email={usuario_email}")
    print(f"📝 Criando ideia com embedding para usuario_id: {usuario_id}, titulo: '{dados.ideia.titulo}'")
    
    conn = get_db_connection()
    try:
        embedding_str = "[" + ",".join(map(str, dados.embedding)) + "]"
        
        # Garantir que usuario_id não é None antes do INSERT
        if usuario_id is None:
            raise ValueError("usuario_id não pode ser None no momento do INSERT")
        
        print(f"   💾 Executando INSERT com usuario_id={usuario_id}")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            projeto_id = _validate_project_access(cur, dados.ideia.projeto_id, usuario_id)
            cur.execute(
                """
                INSERT INTO ideias (titulo, tag, ideia, embedding, usuario_id, projeto_id)
                VALUES (%s, %s, %s, %s::vector, %s, %s)
                RETURNING id
                """,
                (dados.ideia.titulo, dados.ideia.tag, dados.ideia.ideia, embedding_str, usuario_id, projeto_id)
            )
            nova_ideia = cur.fetchone()
            
            # Verificar o que foi realmente salvo
            ideia_id = nova_ideia["id"] if nova_ideia else None
            usuario_id_salvo = usuario_id
            print(f"   📊 Resultado do INSERT:")
            print(f"      • ID: {ideia_id if nova_ideia else 'N/A'}")
            print(f"      • Título: '{dados.ideia.titulo if nova_ideia else 'N/A'}'")
            print(f"      • usuario_id SALVO: {usuario_id_salvo}")
            
            if usuario_id_salvo is None:
                print("   ❌ ERRO: usuario_id foi salvo como NULL no banco!")
                conn.rollback()
                raise ValueError("usuario_id não pode ser NULL - problema no INSERT")
            
            if usuario_id_salvo != usuario_id:
                print(f"   ⚠️  ATENÇÃO: usuario_id esperado ({usuario_id}) diferente do salvo ({usuario_id_salvo})")
            
            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            print(f"✅ Ideia criada com embedding com sucesso: ID {ideia_id}, usuario_id={usuario_id_salvo}")
            print("=" * 80)
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar ideia: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar ideia: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.put("/api/ideias/{ideia_id}", response_model=IdeiaResponse)
def atualizar_ideia(ideia_id: int, ideia: IdeiaUpdate, user: dict = Depends(obter_usuario_assinante)):
    """Atualizar ideia existente (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a ideia existe e pertence ao usuário
            cur.execute("SELECT * FROM ideias WHERE id = %s AND usuario_id = %s", (ideia_id, usuario_id))
            ideia_existente = cur.fetchone()
            if not ideia_existente:
                raise HTTPException(status_code=404, detail="Ideia não encontrada ou você não tem permissão para editar")
            
            # Usar valores atualizados ou manter os existentes
            titulo_final = ideia.titulo if ideia.titulo is not None else ideia_existente['titulo']
            tag_final = ideia.tag if ideia.tag is not None else ideia_existente['tag']
            ideia_final = ideia.ideia if ideia.ideia is not None else ideia_existente['ideia']
            projeto_final = (
                _validate_project_access(cur, ideia.projeto_id, usuario_id)
                if ideia.projeto_id is not None
                else ideia_existente.get('projeto_id')
            )
            clear_kanban = projeto_final != ideia_existente.get("projeto_id")
            
            # Regenerar embedding automaticamente se API Key estiver configurada
            embedding_str = None
            modelo = get_embeddings_model()
            if modelo:
                try:
                    texto_completo = f"{titulo_final} {tag_final or ''} {ideia_final}".strip()
                    embedding = gerar_embedding(texto_completo)
                    if embedding:
                        embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                except Exception as e:
                    print(f"⚠️  Erro ao regenerar embedding (continuando sem atualizar embedding): {e}")
            
            # Atualizar ideia (verificar se pertence ao usuário)
            if embedding_str:
                cur.execute(
                    """
                    UPDATE ideias
                    SET titulo = %s,
                        tag = %s,
                        ideia = %s,
                        embedding = %s::vector,
                        projeto_id = %s,
                        kanban_id = CASE WHEN %s THEN NULL ELSE kanban_id END,
                        kanban_ativo = CASE WHEN %s THEN FALSE ELSE kanban_ativo END,
                        kanban_status = CASE WHEN %s THEN NULL ELSE kanban_status END,
                        kanban_updated_at = CASE WHEN %s THEN NOW() ELSE kanban_updated_at END,
                        updated_at = NOW()
                    WHERE id = %s AND usuario_id = %s
                    RETURNING id
                    """,
                    (
                        titulo_final,
                        tag_final,
                        ideia_final,
                        embedding_str,
                        projeto_final,
                        clear_kanban,
                        clear_kanban,
                        clear_kanban,
                        clear_kanban,
                        ideia_id,
                        usuario_id,
                    )
                )
            else:
                cur.execute(
                    """
                    UPDATE ideias
                    SET titulo = %s,
                        tag = %s,
                        ideia = %s,
                        projeto_id = %s,
                        kanban_id = CASE WHEN %s THEN NULL ELSE kanban_id END,
                        kanban_ativo = CASE WHEN %s THEN FALSE ELSE kanban_ativo END,
                        kanban_status = CASE WHEN %s THEN NULL ELSE kanban_status END,
                        kanban_updated_at = CASE WHEN %s THEN NOW() ELSE kanban_updated_at END,
                        updated_at = NOW()
                    WHERE id = %s AND usuario_id = %s
                    RETURNING id
                    """,
                    (
                        titulo_final,
                        tag_final,
                        ideia_final,
                        projeto_final,
                        clear_kanban,
                        clear_kanban,
                        clear_kanban,
                        clear_kanban,
                        ideia_id,
                        usuario_id,
                    )
                )
            
            ideia_atualizada = cur.fetchone()
            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar ideia: {str(e)}")
    finally:
        conn.close()


@app.patch("/api/ideias/{ideia_id}/kanban", response_model=IdeiaResponse)
def atualizar_kanban_ideia(
    ideia_id: int,
    payload: KanbanStatusUpdate,
    user: dict = Depends(obter_usuario_assinante),
):
    """Atualiza a coluna atual do Kanban e registra a data da movimentacao."""
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")

    usuario_id = user["user_id"]
    status_final = _validate_kanban_status(payload.kanban_status)
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, kanban_status, kanban_ativo
                FROM ideias
                WHERE id = %s AND usuario_id = %s
                """,
                (ideia_id, usuario_id),
            )
            ideia_existente = cur.fetchone()
            if not ideia_existente:
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nao encontrada ou voce nao tem permissao para move-la",
                )

            status_atual = (ideia_existente.get("kanban_status") or "").strip().lower() or None
            if status_atual and status_atual not in KANBAN_STATUS_SET:
                status_atual = None

            cur.execute(
                """
                UPDATE ideias
                SET kanban_ativo = TRUE,
                    kanban_status = %s,
                    kanban_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                RETURNING id
                """,
                (status_final, ideia_id, usuario_id),
            )
            ideia_atualizada = cur.fetchone()
            if not ideia_atualizada:
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nao encontrada ou voce nao tem permissao para move-la",
                )
            if status_atual != status_final or not ideia_existente.get("kanban_ativo"):
                observacao = None
                if not ideia_existente.get("kanban_ativo") and not status_atual:
                    observacao = "Entrada inicial no Kanban"
                _insert_kanban_history(
                    cur,
                    ideia_id=ideia_id,
                    usuario_id=usuario_id,
                    de_status=status_atual,
                    para_status=status_final,
                    observacao=observacao,
                )

            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao mover ideia no Kanban: {str(e)}")
    finally:
        conn.close()


@app.post("/api/ideias/{ideia_id}/kanban/start", response_model=IdeiaResponse)
def iniciar_ideia_no_kanban(
    ideia_id: int,
    payload: KanbanStartRequest,
    user: dict = Depends(obter_usuario_assinante),
):
    """Ativa a ideia no Kanban a partir da coluna Novo."""
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")

    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, projeto_id, kanban_id, kanban_status, kanban_ativo
                FROM ideias
                WHERE id = %s AND usuario_id = %s
                """,
                (ideia_id, usuario_id),
            )
            ideia_existente = cur.fetchone()
            if not ideia_existente:
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nao encontrada ou voce nao tem permissao para iniciar o Kanban",
                )

            projeto_id = ideia_existente.get("projeto_id")
            if not projeto_id:
                raise HTTPException(
                    status_code=400,
                    detail="Vincule a ideia a um projeto antes de iniciar no Kanban",
                )

            kanban = _validate_kanban_access(cur, payload.kanban_id, usuario_id, projeto_id)
            if not kanban:
                raise HTTPException(status_code=400, detail="Kanban invalido")

            status_atual = (ideia_existente.get("kanban_status") or "").strip().lower() or None
            if status_atual and status_atual not in KANBAN_STATUS_SET:
                status_atual = None
            status_inicial = _validate_kanban_status(payload.kanban_status or status_atual or "novo")

            cur.execute(
                """
                UPDATE ideias
                SET kanban_id = %s,
                    kanban_ativo = TRUE,
                    kanban_status = %s,
                    kanban_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                RETURNING id
                """,
                (kanban["id"], status_inicial, ideia_id, usuario_id),
            )
            ideia_atualizada = cur.fetchone()
            if not ideia_atualizada:
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nao encontrada ou voce nao tem permissao para iniciar o Kanban",
                )
            if (
                not ideia_existente.get("kanban_ativo")
                or status_atual != status_inicial
                or ideia_existente.get("kanban_id") != kanban["id"]
            ):
                _insert_kanban_history(
                    cur,
                    ideia_id=ideia_id,
                    usuario_id=usuario_id,
                    de_status=None if not ideia_existente.get("kanban_ativo") else status_atual,
                    para_status=status_inicial,
                    observacao=f"Entrada inicial no Kanban {kanban['nome']}",
                )

            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar ideia no Kanban: {str(e)}")
    finally:
        conn.close()


@app.get("/api/ideias/{ideia_id}/kanban/history", response_model=List[KanbanHistoryEntry])
def buscar_historico_kanban_ideia(
    ideia_id: int,
    user: dict = Depends(obter_usuario_assinante),
):
    """Retorna o histÃ³rico de movimentaÃ§Ãµes do Kanban da ideia."""
    if not user:
        raise HTTPException(status_code=401, detail="NÃ£o autenticado")

    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM ideias
                WHERE id = %s AND usuario_id = %s
                """,
                (ideia_id, usuario_id),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nÃ£o encontrada ou vocÃª nÃ£o tem permissÃ£o para ver o histÃ³rico",
                )

            cur.execute(
                """
                SELECT id, ideia_id, usuario_id, de_status, para_status, observacao, moved_at
                FROM ideias_kanban_historico
                WHERE ideia_id = %s
                ORDER BY moved_at DESC, id DESC
                """,
                (ideia_id,),
            )
            historico = cur.fetchall()
            return [dict(item) for item in historico]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar histÃ³rico do Kanban: {str(e)}")
    finally:
        conn.close()


@app.patch("/api/ideias/{ideia_id}/agenda", response_model=IdeiaResponse)
def atualizar_agenda_ideia(
    ideia_id: int,
    payload: AgendaUpdate,
    user: dict = Depends(obter_usuario_assinante),
):
    """Define ou remove a data planejada da ideia na agenda."""
    if not user:
        raise HTTPException(status_code=401, detail="NÃ£o autenticado")

    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE ideias
                SET agenda_data = %s,
                    agenda_observacao = %s,
                    updated_at = NOW()
                WHERE id = %s AND usuario_id = %s
                RETURNING id
                """,
                (
                    payload.agenda_data,
                    payload.agenda_observacao.strip() if payload.agenda_observacao else None,
                    ideia_id,
                    usuario_id,
                ),
            )
            ideia_atualizada = cur.fetchone()
            if not ideia_atualizada:
                raise HTTPException(
                    status_code=404,
                    detail="Ideia nÃ£o encontrada ou vocÃª nÃ£o tem permissÃ£o para alterar a agenda",
                )
            ideia_completa = _fetch_idea_record(cur, ideia_id, usuario_id)
            conn.commit()
            return ideia_completa
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar agenda da ideia: {str(e)}")
    finally:
        conn.close()

@app.put("/api/ideias/{ideia_id}/embedding")
def atualizar_embedding(ideia_id: int, embedding: List[float], user: dict = Depends(obter_usuario_assinante)):
    """Atualizar embedding de uma ideia"""
    conn = get_db_connection()
    try:
        embedding_str = "[" + ",".join(map(str, embedding)) + "]"
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE ideias SET embedding = %s::vector WHERE id = %s RETURNING *",
                (embedding_str, ideia_id)
            )
            ideia = cur.fetchone()
            if not ideia:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")
            conn.commit()
            return {"message": "Embedding atualizado com sucesso", "ideia": dict(ideia)}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar embedding: {str(e)}")
    finally:
        conn.close()

@app.delete("/api/ideias/{ideia_id}")
def deletar_ideia(ideia_id: int, user: dict = Depends(obter_usuario_assinante)):
    """Deletar ideia (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ideias WHERE id = %s AND usuario_id = %s RETURNING id", (ideia_id, usuario_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Ideia não encontrada ou você não tem permissão para deletar")
            conn.commit()
            return {"message": "Ideia deletada com sucesso", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar ideia: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias/buscar", response_model=List[BuscaResponse])
def buscar_por_similaridade(busca: BuscaRequest, user: dict = Depends(obter_usuario_assinante)):
    """Buscar ideias por similaridade (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    limite = busca.limite if busca.limite and busca.limite > 0 else 10
    limite = min(max(limite, 1), 50)  # guarda-chuva para evitar abusos
    probes = busca.probes if busca.probes and busca.probes > 0 else 10
    probes = min(max(probes, 1), 200)
    conn = get_db_connection()
    try:
        # Gerar embedding do termo de busca automaticamente
        modelo = get_embeddings_model()
        if not modelo:
            # Se não tiver API Key, fazer busca simples (apenas do usuário)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                termo = busca.termo.lower()
                cur.execute("""
                    SELECT 
                        id,
                        titulo,
                        tag,
                        ideia,
                        data,
                        0.0 AS similarity
                    FROM ideias
                    WHERE usuario_id = %s
                      AND (LOWER(titulo) LIKE %s 
                       OR LOWER(tag) LIKE %s 
                       OR LOWER(ideia) LIKE %s)
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, f'%{termo}%', f'%{termo}%', f'%{termo}%', limite))
                resultados = cur.fetchall()
                return [dict(resultado) for resultado in resultados]
        
        # Gerar embedding da busca
        embedding_busca = gerar_embedding(busca.termo)
        if not embedding_busca:
            raise HTTPException(status_code=500, detail="Erro ao gerar embedding da busca")
        
        embedding_str = "[" + ",".join(map(str, embedding_busca)) + "]"
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Ajusta probes para balancear precisão x velocidade no ivfflat
            cur.execute("SET LOCAL ivfflat.probes = %s", (probes,))
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM ideias
                WHERE usuario_id = %s AND embedding IS NOT NULL
                  AND (embedding <=> %s::vector) <= 0.7  -- equivalente a similarity >= 0.3
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (embedding_str, usuario_id, embedding_str, embedding_str, limite))
            resultados = cur.fetchall()
            if resultados:
                return [dict(resultado) for resultado in resultados]

            # Segunda passada semantica mais flexivel
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM ideias
                WHERE usuario_id = %s AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (embedding_str, usuario_id, embedding_str, limite))
            resultados = cur.fetchall()
            if resultados:
                return [dict(resultado) for resultado in resultados]

            # Fallback textual quando a busca semantica nao retorna nada
            termo = busca.termo.lower()
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    0.0 AS similarity
                FROM ideias
                WHERE usuario_id = %s
                  AND (LOWER(titulo) LIKE %s 
                   OR LOWER(tag) LIKE %s 
                   OR LOWER(ideia) LIKE %s)
                ORDER BY data DESC
                LIMIT %s
            """, (usuario_id, f'%{termo}%', f'%{termo}%', f'%{termo}%', limite))
            resultados = cur.fetchall()
            return [dict(resultado) for resultado in resultados]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na busca por similaridade: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias/embeddings/backfill")
def backfill_embeddings(payload: BackfillEmbeddingsRequest, user: dict = Depends(obter_usuario_assinante)):
    """Backfill embeddings das ideias sem vetor (apenas do usuario autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    
    usuario_id = user["user_id"]
    limite = payload.limite if payload.limite and payload.limite > 0 else 50
    limite = min(max(limite, 1), 200)
    forcar = bool(payload.forcar)

    modelo = get_embeddings_model()
    if not modelo:
        raise HTTPException(status_code=400, detail="Modelo de embeddings indisponivel (OPENAI_API_KEY nao configurada)")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if forcar:
                cur.execute("""
                    SELECT id, titulo, tag, ideia
                    FROM ideias
                    WHERE usuario_id = %s
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, limite))
            else:
                cur.execute("""
                    SELECT id, titulo, tag, ideia
                    FROM ideias
                    WHERE usuario_id = %s AND embedding IS NULL
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, limite))
            ideias = cur.fetchall()
            if not ideias:
                return {"total": 0, "updated": 0, "skipped": 0, "ids": []}

            updated_ids = []
            skipped = 0
            for ideia in ideias:
                texto = f"{ideia['titulo']} {ideia.get('tag') or ''} {ideia['ideia']}".strip()
                embedding = gerar_embedding(texto)
                if not embedding:
                    skipped += 1
                    continue
                embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                cur.execute(
                    "UPDATE ideias SET embedding = %s::vector, updated_at = NOW() WHERE id = %s AND usuario_id = %s",
                    (embedding_str, ideia["id"], usuario_id)
                )
                updated_ids.append(ideia["id"])
            conn.commit()
            return {
                "total": len(ideias),
                "updated": len(updated_ids),
                "skipped": skipped,
                "ids": updated_ids
            }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao fazer backfill de embeddings: {str(e)}")
    finally:
        conn.close()


# =============================
# Stripe - Checkout e Webhook
# =============================


def _parse_user_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _upsert_assinatura(cur, usuario_id, plano, status, limite_buscas, limite_embeddings):
    cur.execute("SELECT id FROM assinaturas WHERE usuario_id = %s", (usuario_id,))
    if cur.fetchone():
        cur.execute("""
            UPDATE assinaturas
            SET plano = %s, status = %s, limite_buscas = %s, limite_embeddings = %s
            WHERE usuario_id = %s
        """, (plano, status, limite_buscas, limite_embeddings, usuario_id))
    else:
        cur.execute("""
            INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings)
            VALUES (%s, %s, %s, %s, %s)
        """, (usuario_id, plano, status, limite_buscas, limite_embeddings))


def _map_stripe_status(status):
    if status in ("active", "trialing"):
        return ("pro", "ativa", PRO_LIMITE_BUSCAS, PRO_LIMITE_EMBEDDINGS)
    return ("free", "ativa", FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS)


def _get_first_assinaturas_column(cur, candidates):
    for column in candidates:
        if _has_assinaturas_column(cur, column):
            return column
    return None


def _from_unix_timestamp(value):
    try:
        if value is None:
            return None
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except Exception:
        return None


def _find_usuario_id_by_stripe_customer(cur, customer_id):
    if not customer_id:
        return None
    column = _get_first_assinaturas_column(cur, ["stripe_customer_id", "stripe_customer"])
    if not column:
        return None
    cur.execute(
        f"SELECT usuario_id FROM assinaturas WHERE {column} = %s ORDER BY id DESC LIMIT 1",
        (customer_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _update_assinatura_extras(cur, usuario_id, stripe_subscription_id=None, stripe_customer_id=None, data_inicio=None, data_fim=None):
    updates = []
    values = []

    subscription_column = _get_first_assinaturas_column(cur, ["stripe_subscription_id", "stripe_subscription"])
    if stripe_subscription_id and subscription_column:
        updates.append(f"{subscription_column} = %s")
        values.append(stripe_subscription_id)

    customer_column = _get_first_assinaturas_column(cur, ["stripe_customer_id", "stripe_customer"])
    if stripe_customer_id and customer_column:
        updates.append(f"{customer_column} = %s")
        values.append(stripe_customer_id)

    if data_inicio and _has_assinaturas_column(cur, "data_inicio"):
        updates.append("data_inicio = %s")
        values.append(data_inicio)

    if data_fim and _has_assinaturas_column(cur, "data_fim"):
        updates.append("data_fim = %s")
        values.append(data_fim)

    if not updates:
        return

    values.append(usuario_id)
    cur.execute(
        f"UPDATE assinaturas SET {', '.join(updates)} WHERE usuario_id = %s",
        tuple(values),
    )


@app.post("/api/stripe/checkout-session")
def criar_checkout_session(user: dict = Depends(obter_usuario_atual)):
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe nao configurado")
    if not stripe_checkout or not getattr(stripe_checkout, "Session", None):
        raise HTTPException(status_code=500, detail="Stripe SDK sem suporte a checkout")

    usuario_id = user.get("user_id")
    email = user.get("email") if isinstance(user, dict) else None
    usuario_id = _parse_user_id(usuario_id)
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Usuario invalido")

    success_url = STRIPE_SUCCESS_URL
    sep = "&" if "?" in success_url else "?"
    success_url = f"{success_url}{sep}session_id={{CHECKOUT_SESSION_ID}}"

    try:
        session_params = {
            "mode": "subscription",
            "line_items": [{"price": STRIPE_PRICE_ID, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": STRIPE_CANCEL_URL,
            "client_reference_id": str(usuario_id),
            "subscription_data": {"metadata": {"user_id": str(usuario_id)}},
            "metadata": {"user_id": str(usuario_id), "email": email or ""}
        }
        if email:
            session_params["customer_email"] = email

        session = stripe_checkout.Session.create(**session_params)
    except Exception as e:
        print("❌ Erro no checkout Stripe:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar checkout: {str(e)}")

    return {"url": session.url}


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret nao configurado")

    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature") or request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Stripe-Signature ausente")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook invalido: {str(e)}")

    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})

    usuario_id = None
    plano = None
    status = None
    limite_buscas = None
    limite_embeddings = None
    stripe_subscription_id = None
    stripe_customer_id = None
    data_inicio = None
    data_fim = None

    if event_type == "checkout.session.completed":
        usuario_id = data_obj.get("client_reference_id") or data_obj.get("metadata", {}).get("user_id")
        usuario_id = _parse_user_id(usuario_id)
        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status("active")
        stripe_subscription_id = data_obj.get("subscription")
        stripe_customer_id = data_obj.get("customer")
        data_inicio = _now_utc()
    elif event_type in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        usuario_id = data_obj.get("metadata", {}).get("user_id")
        usuario_id = _parse_user_id(usuario_id)
        stripe_subscription_id = data_obj.get("id")
        stripe_customer_id = data_obj.get("customer")
        data_inicio = _from_unix_timestamp(data_obj.get("current_period_start"))
        data_fim = _from_unix_timestamp(data_obj.get("current_period_end"))
        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status(data_obj.get("status"))

    if not usuario_id and stripe_customer_id and event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                usuario_id = _find_usuario_id_by_stripe_customer(cur, stripe_customer_id)
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            conn.close()

        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status(data_obj.get("status"))

    if usuario_id and plano and status:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                _upsert_assinatura(cur, usuario_id, plano, status, limite_buscas, limite_embeddings)
                _update_assinatura_extras(
                    cur,
                    usuario_id,
                    stripe_subscription_id=stripe_subscription_id,
                    stripe_customer_id=stripe_customer_id,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao atualizar assinatura: {str(e)}")
        finally:
            conn.close()

    return {"received": True}

@app.post("/api/auth/register", response_model=UserResponse)
def registrar_usuario(register_data: RegisterRequest):
    """Registrar novo usuário (email/senha)"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se email já existe
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (register_data.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email já cadastrado")
            
            # Criar hash da senha
            senha_hash = hash_senha(register_data.senha)
            
            # Criar usuário (verifica quais colunas existem)
            try:
                cur.execute("""
                    INSERT INTO usuarios (email, senha_hash, nome, metodo_auth, role)
                    VALUES (%s, %s, %s, 'email', 'user')
                    RETURNING id, email, nome, foto_url, metodo_auth, role
                """, (register_data.email, senha_hash, register_data.nome))
            except psycopg2.errors.UndefinedColumn:
                # Se colunas não existirem, criar sem elas
                cur.execute("""
                    INSERT INTO usuarios (email, senha_hash, nome)
                    VALUES (%s, %s, %s)
                    RETURNING id, email, nome
                """, (register_data.email, senha_hash, register_data.nome))
            
            usuario = cur.fetchone()
            usuario_id = usuario["id"]
            
            # Criar assinatura free com trial de 3 dias
            _insert_trial_assinatura(cur, usuario_id)
            
            conn.commit()
            
            # Gerar token (usar valores padrão se colunas não existirem)
            role = usuario.get("role", "user")
            token = criar_token_jwt(usuario_id, register_data.email, role)
            
            return UserResponse(
                id=usuario["id"],
                email=usuario["email"],
                nome=usuario.get("nome"),
                foto_url=usuario.get("foto_url"),
                metodo_auth=usuario.get("metodo_auth", "email"),
                role=role,
                token=token
            )
    except HTTPException:
        raise
    except psycopg2.errors.UndefinedTable as e:
        if conn:
            conn.rollback()
        table_name = _extract_missing_relation_name(e)
        print(f"Erro ao registrar usuário: tabela ausente ({table_name or 'desconhecida'})")
        raise HTTPException(status_code=503, detail=_missing_relation_detail(table_name))
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erro ao registrar usuário: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao registrar usuário: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.post("/api/auth/login", response_model=UserResponse)
def login_usuario(login_data: LoginRequest):
    """Login com email e senha"""
    import sys
    sys.stdout.flush()
    print("=" * 80, flush=True)
    print("🔐 [LOGIN] Nova tentativa de login", flush=True)
    print(f"   Email: {login_data.email}", flush=True)
    print("=" * 80, flush=True)
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar usuário - verifica quais colunas existem dinamicamente
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' 
                AND column_name IN ('foto_url', 'metodo_auth', 'role', 'ativo')
            """)
            # RealDictCursor retorna dicionários, não tuplas
            colunas_existentes = {row['column_name'] for row in cur.fetchall()}
            
            # Montar SELECT baseado nas colunas que existem
            colunas_base = ['id', 'email', 'senha_hash', 'nome']
            if 'foto_url' in colunas_existentes:
                colunas_base.append('foto_url')
            if 'metodo_auth' in colunas_existentes:
                colunas_base.append('metodo_auth')
            if 'role' in colunas_existentes:
                colunas_base.append('role')
            if 'ativo' in colunas_existentes:
                colunas_base.append('ativo')
            
            query = f"SELECT {', '.join(colunas_base)} FROM usuarios WHERE email = %s"
            cur.execute(query, (login_data.email,))
            
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            if colunas_existentes and 'ativo' in colunas_existentes and not usuario.get("ativo", True):
                raise HTTPException(status_code=403, detail="Usuário inativo")
            
            # Verificar senha
            print(f"🔐 Tentando login para: {login_data.email}")
            print(f"   Usuário encontrado: ID {usuario['id']}")
            print(f"   Tem senha_hash: {bool(usuario.get('senha_hash'))}")
            
            if not usuario.get("senha_hash"):
                print("❌ Usuário não tem senha_hash!")
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            senha_valida = verificar_senha(login_data.senha, usuario["senha_hash"])
            print(f"   Senha válida: {senha_valida}")
            
            if not senha_valida:
                print(f"❌ Senha incorreta para {login_data.email}")
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            print(f"✅ Login bem-sucedido para {login_data.email}")
            
            # Validar dados antes de criar resposta
            usuario_id = usuario["id"]
            usuario_email = usuario["email"]
            usuario_nome = usuario.get("nome")
            usuario_foto_url = usuario.get("foto_url")
            usuario_metodo_auth = usuario.get("metodo_auth", "email")
            usuario_role = usuario.get("role", "user")
            
            print(f"   Dados do usuário: id={usuario_id}, email={usuario_email}, role={usuario_role}")
            
            # Gerar token
            try:
                token = criar_token_jwt(usuario_id, usuario_email, usuario_role)
                print(f"   ✅ Token gerado com sucesso")
            except Exception as e:
                print(f"   ❌ Erro ao gerar token: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Erro ao gerar token: {str(e)}")
            
            # Criar resposta
            try:
                response = UserResponse(
                    id=usuario_id,
                    email=usuario_email,
                    nome=usuario_nome,
                    foto_url=usuario_foto_url,
                    metodo_auth=usuario_metodo_auth,
                    role=usuario_role,
                    token=token
                )
                print(f"   ✅ UserResponse criado com sucesso")
                return response
            except Exception as e:
                print(f"   ❌ Erro ao criar UserResponse: {e}")
                print(f"   Dados: id={usuario_id}, email={usuario_email}, nome={usuario_nome}, foto_url={usuario_foto_url}, metodo_auth={usuario_metodo_auth}, role={usuario_role}, token_len={len(token) if token else 0}")
                import traceback
                traceback.print_exc()
                raise
    except HTTPException:
        raise
    except psycopg2.errors.UndefinedTable as e:
        if conn:
            conn.rollback()
        table_name = _extract_missing_relation_name(e)
        print(f"❌ Tabela ausente durante login: {table_name or 'desconhecida'}")
        raise HTTPException(status_code=503, detail=_missing_relation_detail(table_name))
    except Exception as e:
        print(f"❌ Erro no login: {e}")
        import traceback
        print("📋 Traceback completo:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao fazer login: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/auth/google/login")
def login_google_redirect():
    """Gerar URL de login do Google"""
    if not GOOGLE_CLIENT_ID:
        # Se não configurado, retornar erro amigável
        raise HTTPException(
            status_code=503, 
            detail="Login com Google não está configurado. Configure GOOGLE_CLIENT_ID no backend/.env"
        )
    
    # URL de autorização do Google (usa variável global)
    redirect_uri = GOOGLE_REDIRECT_URI
    scope = "openid email profile"
    
    # Codificar redirect_uri para URL (usar urlencode para query parameters)
    from urllib.parse import urlencode
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent"
    }
    query_string = urlencode(params)
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
    
    # Log para debug (remover em produção)
    print(f"🔍 Redirect URI sendo usado: {redirect_uri}")
    print(f"🔍 URL completa gerada: {google_auth_url}")
    
    return {"auth_url": google_auth_url}

@app.post("/api/auth/google/callback", response_model=UserResponse)
async def google_callback(auth_request: GoogleAuthRequest):
    """Processar callback do Google OAuth"""
    try:
        # Obter informações do usuário do Google
        google_info = await obter_info_google_por_code(
            auth_request.code, 
            auth_request.redirect_uri
        )
        
        if not google_info:
            raise HTTPException(status_code=401, detail="Falha ao autenticar com Google")
        
        google_id = google_info["google_id"]
        email = google_info["email"]
        nome = google_info.get("nome")
        foto_url = google_info.get("foto_url")
        
        # Buscar ou criar usuário no banco
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verificar se usuário já existe (por google_id ou email)
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE google_id = %s OR email = %s
                    LIMIT 1
                """, (google_id, email))
                
                usuario = cur.fetchone()
                
                if usuario:
                    # Usuário existe, atualizar dados
                    usuario_id = usuario["id"]
                    cur.execute("""
                        UPDATE usuarios 
                        SET google_id = %s, nome = COALESCE(%s, nome), 
                            foto_url = COALESCE(%s, foto_url),
                            metodo_auth = 'google',
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (google_id, nome, foto_url, usuario_id))
                    
                    # Criar assinatura free se não tiver
                    cur.execute("""
                        SELECT id FROM assinaturas 
                        WHERE usuario_id = %s AND status IN ('ativa', 'trial', 'active', 'trialing')
                    """, (usuario_id,))
                    if not cur.fetchone():
                        _insert_trial_assinatura(cur, usuario_id)
                else:
                    # Criar novo usuário
                    cur.execute("""
                        INSERT INTO usuarios (email, nome, foto_url, google_id, metodo_auth, senha_hash)
                        VALUES (%s, %s, %s, %s, 'google', NULL)
                        RETURNING id
                    """, (email, nome, foto_url, google_id))
                    
                    usuario_id = cur.fetchone()["id"]
                    
                    # Criar assinatura free para novo usuário
                    _insert_trial_assinatura(cur, usuario_id)
                
                conn.commit()
                
                # Buscar dados atualizados
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE id = %s
                """, (usuario_id,))
                usuario = cur.fetchone()
                
                # Buscar role do usuário
                cur.execute("SELECT role FROM usuarios WHERE id = %s", (usuario_id,))
                role = cur.fetchone()["role"] or "user"
                
                # Gerar token JWT
                token = criar_token_jwt(usuario_id, email, role)
                
                return UserResponse(
                    id=usuario["id"],
                    email=usuario["email"],
                    nome=usuario["nome"],
                    foto_url=usuario["foto_url"],
                    metodo_auth=usuario["metodo_auth"],
                    role=role,
                    token=token
                )
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Erro no callback Google: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar autenticação: {str(e)}")

@app.get("/api/auth/google/callback")
async def google_callback_get(code: str = Query(...), error: Optional[str] = Query(None)):
    """Processar callback do Google OAuth (GET) e redirecionar para frontend"""
    if error:
        # Se houver erro, redirecionar para frontend com erro
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error={error}")
    
    try:
        # Obter informações do usuário do Google (usa variável global)
        google_info = await obter_info_google_por_code(code, GOOGLE_REDIRECT_URI)
        
        if not google_info:
            return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error=authentication_failed")
        
        google_id = google_info["google_id"]
        email = google_info["email"]
        nome = google_info.get("nome")
        foto_url = google_info.get("foto_url")
        
        # Buscar ou criar usuário no banco
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verificar se usuário já existe (por google_id ou email)
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE google_id = %s OR email = %s
                    LIMIT 1
                """, (google_id, email))
                
                usuario = cur.fetchone()
                
                if usuario:
                    # Usuário existe, atualizar dados
                    usuario_id = usuario["id"]
                    cur.execute("""
                        UPDATE usuarios 
                        SET google_id = %s, nome = COALESCE(%s, nome), 
                            foto_url = COALESCE(%s, foto_url),
                            metodo_auth = 'google',
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (google_id, nome, foto_url, usuario_id))
                    
                    # Criar assinatura free se não tiver
                    cur.execute("""
                        SELECT id FROM assinaturas 
                        WHERE usuario_id = %s AND status IN ('ativa', 'trial', 'active', 'trialing')
                    """, (usuario_id,))
                    if not cur.fetchone():
                        _insert_trial_assinatura(cur, usuario_id)
                else:
                    # Criar novo usuário
                    cur.execute("""
                        INSERT INTO usuarios (email, nome, foto_url, google_id, metodo_auth, senha_hash)
                        VALUES (%s, %s, %s, %s, 'google', NULL)
                        RETURNING id
                    """, (email, nome, foto_url, google_id))
                    
                    usuario_id = cur.fetchone()["id"]
                    
                    # Criar assinatura free para novo usuário
                    _insert_trial_assinatura(cur, usuario_id)
                
                conn.commit()
                
                # Buscar dados atualizados
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE id = %s
                """, (usuario_id,))
                usuario = cur.fetchone()
                
                # Buscar role do usuário
                cur.execute("SELECT role FROM usuarios WHERE id = %s", (usuario_id,))
                role = cur.fetchone()["role"] or "user"
                
                # Gerar token JWT
                token = criar_token_jwt(usuario_id, email, role)
                
        finally:
            conn.close()
        
        # Redirecionar para frontend com token (usa variável global)
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?code={code}&token={token}")
        
    except Exception as e:
        print(f"Erro no callback Google (GET): {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error=server_error")

@app.get("/api/auth/google/debug")
def debug_google_oauth():
    """Endpoint de debug para verificar configuração do Google OAuth"""
    redirect_uri = GOOGLE_REDIRECT_URI
    from urllib.parse import quote
    redirect_uri_encoded = quote(redirect_uri, safe='')
    
    return {
        "redirect_uri": redirect_uri,
        "redirect_uri_encoded": redirect_uri_encoded,
        "client_id": GOOGLE_CLIENT_ID[:30] + "..." if GOOGLE_CLIENT_ID else "Não configurado",
        "instrucoes": {
            "1": "Acesse: https://console.cloud.google.com/",
            "2": "Vá em: APIs & Services > Credentials",
            "3": "Clique no OAuth 2.0 Client ID",
            "4": f"Em 'Authorized redirect URIs', adicione EXATAMENTE: {redirect_uri}",
            "5": "Clique em Save"
        }
    }

@app.get("/api/auth/me")
async def obter_usuario_logado(user: dict = Depends(obter_usuario_atual)):
    """Obter informações do usuário logado"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    u.id,
                    u.email,
                    u.nome,
                    u.foto_url,
                    u.metodo_auth,
                    u.role,
                    a.plano,
                    a.status,
                    a.limite_buscas,
                    a.limite_embeddings
                FROM usuarios u
                LEFT JOIN LATERAL (
                    SELECT plano, status, limite_buscas, limite_embeddings
                    FROM assinaturas
                    WHERE usuario_id = u.id
                    ORDER BY id DESC
                    LIMIT 1
                ) a ON true
                WHERE u.id = %s
            """, (user["user_id"],))
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            # Buscar assinatura completa para checar trial (3 dias)
            cur.execute("""
                SELECT * FROM assinaturas
                WHERE usuario_id = %s
                ORDER BY id DESC
                LIMIT 1
            """, (user["user_id"],))
            assinatura_row = cur.fetchone()

            response = dict(usuario)
            if assinatura_row:
                # Sobrescrever com valores mais recentes
                response["plano"] = assinatura_row.get("plano", response.get("plano"))
                response["status"] = assinatura_row.get("status", response.get("status"))
                response["limite_buscas"] = assinatura_row.get("limite_buscas", response.get("limite_buscas"))
                response["limite_embeddings"] = assinatura_row.get("limite_embeddings", response.get("limite_embeddings"))

                trial_expira = _trial_expira_em_from_row(assinatura_row)
                plano_atual = (response.get("plano") or "").lower()
                trial_ativo = plano_atual == "free" and trial_expira and not _is_expired(trial_expira)
                response["trial_expira_em"] = trial_expira.isoformat() if trial_expira else None
                response["trial_ativo"] = trial_ativo
            else:
                response["trial_expira_em"] = None
                response["trial_ativo"] = False

            return response
    except psycopg2.errors.UndefinedTable as e:
        table_name = _extract_missing_relation_name(e)
        raise HTTPException(status_code=503, detail=_missing_relation_detail(table_name))
    finally:
        conn.close()

@app.post("/api/auth/alterar-senha")
async def alterar_senha(dados: AlterarSenhaRequest, user: dict = Depends(obter_usuario_atual)):
    """Alterar senha do usuário logado"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    if len(dados.nova_senha) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, email, senha_hash, metodo_auth
                FROM usuarios 
                WHERE id = %s
            """, (user["user_id"],))
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            if not usuario.get("senha_hash"):
                raise HTTPException(status_code=400, detail="Usuário não possui senha cadastrada (login apenas por Google)")
            
            if not verificar_senha(dados.senha_atual, usuario["senha_hash"]):
                raise HTTPException(status_code=401, detail="Senha atual incorreta")
            
            nova_senha_hash = hash_senha(dados.nova_senha)
            
            cur.execute("""
                UPDATE usuarios 
                SET senha_hash = %s
                WHERE id = %s
            """, (nova_senha_hash, user["user_id"]))
            
            conn.commit()
            return {"message": "Senha alterada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"Erro ao alterar senha: {e}")
        raise HTTPException(status_code=500, detail="Erro ao alterar senha")
    finally:
        conn.close()

@app.post("/api/acessos")
def registrar_acesso(acesso: AcessoCreate):
    """Registrar log de acesso com localização"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO acessos (
                    usuario_id, ip_address, user_agent, pais, cidade, regiao,
                    timezone, latitude, longitude, endpoint, metodo_http,
                    status_code, tempo_resposta_ms
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """, (
                acesso.usuario_id,
                acesso.ip_address,
                acesso.user_agent,
                acesso.pais,
                acesso.cidade,
                acesso.regiao,
                acesso.timezone,
                acesso.latitude,
                acesso.longitude,
                acesso.endpoint,
                acesso.metodo_http,
                acesso.status_code,
                acesso.tempo_resposta_ms
            ))
            acesso_id = cur.fetchone()[0]
            conn.commit()
            return {"id": acesso_id, "message": "Acesso registrado com sucesso"}
    except psycopg2.OperationalError:
        # Se tabela não existe ainda, não bloquear a aplicação
        if conn:
            conn.rollback()
        return {"message": "Tabela de acessos não encontrada (ignore se ainda não criou)"}
    except Exception as e:
        if conn:
            conn.rollback()
        # Não bloquear a aplicação se der erro ao registrar acesso
        print(f"⚠️ Erro ao registrar acesso (ignorado): {e}")
        return {"message": "Erro ao registrar acesso (ignorado)"}
    finally:
        if conn:
            conn.close()

@app.delete("/api/ideias/limpar")
def limpar_todas_ideias():
    """⚠️ LIMPAR TODAS AS IDEIAS - CUIDADO!"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE ideias RESTART IDENTITY CASCADE")
            conn.commit()
            return {"message": "Todas as ideias foram deletadas", "success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao limpar ideias: {str(e)}")
    finally:
        conn.close()

# =====================================================
# ENDPOINT: CONTATO (Fale Conosco)
# =====================================================

class ContatoCreate(BaseModel):
    nome: str
    email: str
    assunto: str
    mensagem: str
    email_destino: Optional[str] = None  # Será preenchido com CONTATO_EMAIL se não fornecido

class ContatoResponse(BaseModel):
    id: int
    message: str

async def obter_usuario_opcional(request: Request) -> Optional[dict]:
    """Extrair usuário do token JWT - Retorna None se não autenticado (para contato anônimo)"""
    try:
        authorization = request.headers.get("Authorization") or request.headers.get("authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return None
        
        token = authorization.replace("Bearer ", "").strip()
        if not token:
            return None
        
        user = verificar_token_jwt(token)
        return user if user else None
    except:
        return None

@app.post("/api/contato", response_model=ContatoResponse, status_code=201)
async def criar_contato(contato: ContatoCreate, request: Request):
    """Criar mensagem de contato (pode ser anônimo ou autenticado)"""
    print("=" * 80)
    print("📧 NOVA MENSAGEM DE CONTATO")
    print(f"   Nome: {contato.nome}")
    print(f"   Email: {contato.email}")
    print(f"   Assunto: {contato.assunto}")
    print("=" * 80)
    
    # Validar dados
    if not contato.nome.strip() or not contato.email.strip() or not contato.assunto.strip() or not contato.mensagem.strip():
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")
    
    # Tentar obter usuário (opcional)
    usuario_id = None
    try:
        user = await obter_usuario_opcional(request)
        if user:
            usuario_id = user.get("user_id")
            print(f"   ✅ Usuário autenticado: usuario_id={usuario_id}")
        else:
            print(f"   ℹ️  Mensagem anônima (sem autenticação)")
    except Exception as e:
        print(f"   ⚠️  Erro ao obter usuário (continuando como anônimo): {e}")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO contato (
                    usuario_id,
                    nome,
                    email,
                    assunto,
                    mensagem,
                    email_destino,
                    status,
                    criado_em
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                usuario_id,
                contato.nome.strip(),
                contato.email.strip(),
                contato.assunto.strip(),
                contato.mensagem.strip(),
                contato.email_destino or CONTATO_EMAIL,
                "pendente",
                datetime.now()
            ))
            
            resultado = cur.fetchone()
            contato_id = resultado["id"]
            conn.commit()
            
            print(f"✅ Mensagem de contato salva com sucesso: ID {contato_id}")
            print("=" * 80)
            
            return ContatoResponse(
                id=contato_id,
                message="Mensagem enviada com sucesso"
            )
            
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar contato: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Erro ao processar mensagem. Tente novamente mais tarde."
        )
    finally:
        if conn:
            conn.close()

# =====================================================
# ENDPOINT: SUGESTÕES DE LEMBRANÇA COM IA
# =====================================================
print("🔍 [DEBUG] Carregando módulo de lembranças...")

class LembrancaRequest(BaseModel):
    texto: str

class LembrancaResponse(BaseModel):
    sugestoes: List[str]

def get_chat_model():
    """Obter modelo de chat OpenAI para gerar sugestões"""
    if not OPENAI_API_KEY:
        return None
    try:
        return ChatOpenAI(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-4o-mini",
            temperature=0.7
        )
    except:
        return None

print("🔍 [DEBUG] Definindo endpoint GET /api/lembrancas/teste...")
@app.get("/api/lembrancas/teste")
async def teste_lembrancas():
    """Endpoint de teste para verificar se a rota está funcionando"""
    return {"status": "ok", "mensagem": "Endpoint de lembranças está funcionando"}

print("🔍 [DEBUG] Definindo endpoint POST /api/lembrancas/sugerir...")
@app.post("/api/lembrancas/sugerir", response_model=LembrancaResponse)
async def sugerir_lembranca(lembranca: LembrancaRequest, request: Request):
    """Gerar sugestões de lembrança usando IA baseado no texto descritivo"""
    print("=" * 80)
    print("💭 SUGESTÃO DE LEMBRANÇA - ENDPOINT CHAMADO!")
    print(f"   Texto recebido: {lembranca.texto[:100]}...")
    print("=" * 80)
    
    if not lembranca.texto.strip():
        return LembrancaResponse(sugestoes=[])
    
    modelo = get_chat_model()
    if not modelo:
        print("⚠️  OpenAI API Key não configurada")
        return LembrancaResponse(sugestoes=[])
    
    try:
        # Prompt para a IA gerar sugestões contextuais
        prompt = f"""Você é um assistente de memória. O usuário está tentando lembrar de algo e descreveu:

"{lembranca.texto}"

Com base nessa descrição, gere 3-5 sugestões curtas e específicas que possam ajudar a pessoa a lembrar. 
As sugestões devem ser:
- Curta (máximo 10 palavras)
- Específica e concreta
- Relacionada ao contexto descrito
- Em formato de pergunta ou afirmação curta

Exemplos de boas sugestões:
- "qual aquela fruta pequena roxa?"
- "a Torre Eiffel em Paris?"
- "o nome daquele restaurante italiano?"
- "aquela música que tocava na rádio?"

Retorne APENAS as sugestões, uma por linha, sem numeração ou marcadores."""

        resposta = modelo.invoke(prompt)
        print(f"📝 Resposta bruta da IA: {resposta.content[:200]}...")
        
        sugestoes_texto = resposta.content.strip()
        
        # Separar sugestões por linha e limpar
        sugestoes = [
            s.strip() 
            for s in sugestoes_texto.split('\n') 
            if s.strip() and not s.strip().startswith(('1.', '2.', '3.', '4.', '5.', '-', '*', '•'))
        ]
        
        # Limitar a 5 sugestões
        sugestoes = sugestoes[:5]
        
        print(f"✅ {len(sugestoes)} sugestões geradas")
        for i, sug in enumerate(sugestoes, 1):
            print(f"   {i}. {sug}")
        print("=" * 80)
        
        if not sugestoes:
            print("⚠️  Nenhuma sugestão foi gerada, retornando lista vazia")
        
        return LembrancaResponse(sugestoes=sugestoes)
        
    except Exception as e:
        print(f"❌ Erro ao gerar sugestões: {e}")
        import traceback
        traceback.print_exc()
        # Retornar lista vazia em caso de erro
        return LembrancaResponse(sugestoes=[])

if __name__ == "__main__":
    import uvicorn
    PORT = int(os.getenv("PORT") or os.getenv("BACKEND_PORT", "8002"))
    print(f"🚀 Servidor rodando na porta {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
