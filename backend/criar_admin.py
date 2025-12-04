#!/usr/bin/env python3
"""
Script para criar usuário admin inicial
Uso: python criar_admin.py
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from auth import hash_senha

load_dotenv()

# Configuração do banco
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "sacola_ideias"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "senha123"),
    "port": os.getenv("DB_PORT", "5432"),
}

def criar_admin():
    """Criar usuário admin"""
    
    print("🔐 Criando usuário administrador...")
    print()
    
    # Solicitar dados
    email = input("Email do admin: ").strip()
    if not email:
        print("❌ Email é obrigatório!")
        return
    
    nome = input("Nome do admin (opcional): ").strip() or None
    
    senha = input("Senha: ").strip()
    if len(senha) < 6:
        print("❌ Senha deve ter no mínimo 6 caracteres!")
        return
    
    confirmar_senha = input("Confirmar senha: ").strip()
    if senha != confirmar_senha:
        print("❌ Senhas não coincidem!")
        return
    
    # Conectar ao banco
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se email já existe
            cur.execute("SELECT id, role FROM usuarios WHERE email = %s", (email,))
            usuario_existente = cur.fetchone()
            
            if usuario_existente:
                # Perguntar se quer atualizar para admin
                resposta = input(f"Usuário {email} já existe. Atualizar para admin? (s/n): ").strip().lower()
                if resposta == 's':
                    cur.execute("""
                        UPDATE usuarios 
                        SET senha_hash = %s, nome = COALESCE(%s, nome), role = 'admin'
                        WHERE email = %s
                    """, (hash_senha(senha), nome, email))
                    conn.commit()
                    print(f"✅ Usuário {email} atualizado para admin!")
                else:
                    print("❌ Operação cancelada.")
            else:
                # Criar novo admin
                cur.execute("""
                    INSERT INTO usuarios (email, senha_hash, nome, metodo_auth, role)
                    VALUES (%s, %s, %s, 'email', 'admin')
                    RETURNING id
                """, (email, hash_senha(senha), nome))
                
                usuario_id = cur.fetchone()["id"]
                
                # Criar assinatura premium para admin
                cur.execute("""
                    INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings)
                    VALUES (%s, 'premium', 'ativa', NULL, NULL)
                """, (usuario_id,))
                
                conn.commit()
                print(f"✅ Admin criado com sucesso!")
                print(f"   ID: {usuario_id}")
                print(f"   Email: {email}")
                print(f"   Role: admin")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao criar admin: {e}")
        sys.exit(1)

if __name__ == "__main__":
    criar_admin()

