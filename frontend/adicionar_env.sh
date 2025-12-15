#!/bin/bash
# Script para adicionar variáveis ao .env.local do frontend

ENV_FILE=".env.local"

echo "🔧 Adicionando variáveis ao $ENV_FILE..."
echo ""

# Verificar e adicionar VITE_API_URL
if [ ! -f "$ENV_FILE" ] || ! grep -q "^VITE_API_URL=" "$ENV_FILE"; then
    if [ ! -f "$ENV_FILE" ]; then
        echo "# Configurações do Frontend" > "$ENV_FILE"
        echo "" >> "$ENV_FILE"
    fi
    echo "VITE_API_URL=http://localhost:8002/api" >> "$ENV_FILE"
    echo "✅ VITE_API_URL adicionado"
else
    echo "ℹ️  VITE_API_URL já existe"
fi

# Verificar e adicionar VITE_CONTATO_EMAIL
if [ ! -f "$ENV_FILE" ] || ! grep -q "^VITE_CONTATO_EMAIL=" "$ENV_FILE"; then
    echo "VITE_CONTATO_EMAIL=contato@sacoladeideias.com" >> "$ENV_FILE"
    echo "✅ VITE_CONTATO_EMAIL adicionado"
else
    echo "ℹ️  VITE_CONTATO_EMAIL já existe"
fi

echo ""
echo "✅ Concluído! Verifique o arquivo $ENV_FILE"

