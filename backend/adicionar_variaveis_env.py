#!/usr/bin/env python3
"""
Script para adicionar variáveis de ambiente ao arquivo .env
Execute: python3 adicionar_variaveis_env.py
"""

import os

# Variáveis que precisam ser adicionadas/atualizadas
VARIAVEIS_NOVAS = {
    "BACKEND_PORT": "8002",
    "FRONTEND_URL": "http://localhost:5173",
    "GOOGLE_REDIRECT_URI": "http://localhost:8002/api/auth/google/callback",
    "CONTATO_EMAIL": "contato@sacoladeideias.com"
}

def adicionar_variaveis():
    env_file = ".env"
    
    if not os.path.exists(env_file):
        print(f"❌ Arquivo {env_file} não encontrado!")
        print(f"   Crie o arquivo {env_file} primeiro.")
        return
    
    # Ler arquivo atual
    with open(env_file, 'r', encoding='utf-8') as f:
        linhas = f.readlines()
    
    # Verificar quais variáveis já existem
    variaveis_existentes = {}
    linhas_para_manter = []
    
    for linha in linhas:
        linha_limpa = linha.strip()
        # Ignorar linhas vazias e comentários
        if not linha_limpa or linha_limpa.startswith('#'):
            linhas_para_manter.append(linha)
            continue
        
        # Verificar se é uma variável de ambiente
        if '=' in linha_limpa:
            chave = linha_limpa.split('=')[0].strip()
            valor = '='.join(linha_limpa.split('=')[1:]).strip()
            variaveis_existentes[chave] = valor
            linhas_para_manter.append(linha)
    
    # Adicionar novas variáveis que não existem
    variaveis_adicionadas = []
    variaveis_atualizadas = []
    
    for chave, valor_padrao in VARIAVEIS_NOVAS.items():
        if chave not in variaveis_existentes:
            # Adicionar nova variável
            linhas_para_manter.append(f"{chave}={valor_padrao}\n")
            variaveis_adicionadas.append(chave)
        else:
            # Variável já existe, não alterar
            print(f"ℹ️  {chave} já existe com valor: {variaveis_existentes[chave]}")
    
    # Escrever arquivo atualizado
    if variaveis_adicionadas:
        # Adicionar comentário antes das novas variáveis
        linhas_para_manter.append("\n# =====================================================\n")
        linhas_para_manter.append("# PORTAS E URLs - Configuradas automaticamente\n")
        linhas_para_manter.append("# =====================================================\n")
        
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(linhas_para_manter)
        
        print("=" * 60)
        print("✅ Variáveis adicionadas ao .env:")
        for chave in variaveis_adicionadas:
            print(f"   ✅ {chave}={VARIAVEIS_NOVAS[chave]}")
        print("=" * 60)
        print(f"\n📝 Arquivo {env_file} atualizado com sucesso!")
    else:
        print("ℹ️  Todas as variáveis já existem no arquivo .env")

if __name__ == "__main__":
    print("🔧 Adicionando variáveis de ambiente ao .env...")
    print()
    adicionar_variaveis()

