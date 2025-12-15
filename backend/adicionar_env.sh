#!/bin/bash
# Script para adicionar variáveis ao .env do backend

ENV_FILE=".env"

# Verificar se .env existe
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Arquivo $ENV_FILE não encontrado!"
    exit 1
fi

echo "🔧 Adicionando variáveis ao $ENV_FILE..."
echo ""

# Verificar e adicionar BACKEND_PORT
if ! grep -q "^BACKEND_PORT=" "$ENV_FILE"; then
    echo "BACKEND_PORT=8002" >> "$ENV_FILE"
    echo "✅ BACKEND_PORT adicionado"
else
    echo "ℹ️  BACKEND_PORT já existe"
fi

# Verificar e adicionar FRONTEND_URL
if ! grep -q "^FRONTEND_URL=" "$ENV_FILE"; then
    echo "FRONTEND_URL=http://localhost:5173" >> "$ENV_FILE"
    echo "✅ FRONTEND_URL adicionado"
else
    echo "ℹ️  FRONTEND_URL já existe"
fi

# Verificar e adicionar GOOGLE_REDIRECT_URI
if ! grep -q "^GOOGLE_REDIRECT_URI=" "$ENV_FILE"; then
    echo "GOOGLE_REDIRECT_URI=http://localhost:8002/api/auth/google/callback" >> "$ENV_FILE"
    echo "✅ GOOGLE_REDIRECT_URI adicionado"
else
    echo "ℹ️  GOOGLE_REDIRECT_URI já existe"
fi

# Verificar e adicionar CONTATO_EMAIL
if ! grep -q "^CONTATO_EMAIL=" "$ENV_FILE"; then
    echo "CONTATO_EMAIL=contato@sacoladeideias.com" >> "$ENV_FILE"
    echo "✅ CONTATO_EMAIL adicionado"
else
    echo "ℹ️  CONTATO_EMAIL já existe"
fi

echo ""
echo "✅ Concluído! Verifique o arquivo $ENV_FILE"

