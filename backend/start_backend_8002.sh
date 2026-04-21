#!/usr/bin/env bash
set -e

cd /home/leonardo4ia/projetos/sacola-ideias/backend
exec ./venv/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 8002
