"""
Helpers de configuração de banco para PostgreSQL/Supabase Postgres.
"""

import os
from typing import Dict, Tuple
from urllib.parse import parse_qsl, unquote, urlparse


DB_URL_ENV_KEYS = (
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "DB_URL",
    "POSTGRES_URL",
)


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def _build_config_from_url(url: str) -> Dict[str, object]:
    parsed = urlparse(_normalize_db_url(url))
    if not parsed.hostname:
        raise ValueError("URL de banco inválida: host ausente")

    config: Dict[str, object] = {
        "host": parsed.hostname,
        "database": parsed.path.lstrip("/") or "postgres",
        "user": unquote(parsed.username or "postgres"),
        "password": unquote(parsed.password or ""),
        "port": parsed.port or 5432,
    }

    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "sslmode" and value:
            config["sslmode"] = value

    return config


def build_db_config(default_database: str = "postgres") -> Tuple[Dict[str, object], str]:
    for env_key in DB_URL_ENV_KEYS:
        db_url = os.getenv(env_key)
        if db_url:
            return _build_config_from_url(db_url), env_key

    config: Dict[str, object] = {
        "host": os.getenv("DB_HOST") or os.getenv("PGHOST") or "localhost",
        "database": os.getenv("DB_NAME") or os.getenv("PGDATABASE") or default_database,
        "user": os.getenv("DB_USER") or os.getenv("PGUSER") or "postgres",
        "password": (
            os.getenv("SUPABASE_DB_PASSWORD")
            or os.getenv("DB_PASSWORD")
            or os.getenv("PGPASSWORD")
            or "senha123"
        ),
        "port": int(os.getenv("DB_PORT") or os.getenv("PGPORT") or "5432"),
    }

    sslmode = os.getenv("DB_SSLMODE") or os.getenv("PGSSLMODE")
    if sslmode:
        config["sslmode"] = sslmode

    return config, "DB_HOST/DB_NAME/DB_USER/DB_PASSWORD"


def sanitize_db_config(config: Dict[str, object]) -> Dict[str, object]:
    safe = dict(config)
    if "password" in safe:
        safe["password"] = "***" if safe["password"] else "NÃO CONFIGURADO"
    return safe
