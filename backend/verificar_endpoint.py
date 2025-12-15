#!/usr/bin/env python3
"""
Script rápido para verificar se o endpoint está no código
"""
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Verificar se o endpoint está no código
if '@app.post("/api/auth/alterar-senha")' in content:
    print("✅ Endpoint encontrado no código!")
    
    # Verificar se a classe está definida
    if 'class AlterarSenhaRequest' in content:
        print("✅ Classe AlterarSenhaRequest encontrada!")
    else:
        print("❌ Classe AlterarSenhaRequest NÃO encontrada!")
    
    # Verificar se a função está definida
    if 'async def alterar_senha(' in content:
        print("✅ Função alterar_senha encontrada!")
    else:
        print("❌ Função alterar_senha NÃO encontrada!")
    
    # Contar quantas vezes aparece
    count = content.count('@app.post("/api/auth/alterar-senha")')
    print(f"📊 Endpoint aparece {count} vez(es) no código")
    
    if count > 1:
        print("⚠️  ATENÇÃO: Endpoint aparece mais de uma vez! Isso pode causar problemas.")
    
else:
    print("❌ Endpoint NÃO encontrado no código!")
    print("   Procure por: @app.post(\"/api/auth/alterar-senha\")")

