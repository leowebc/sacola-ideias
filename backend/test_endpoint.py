#!/usr/bin/env python3
"""
Script para testar se o endpoint de alterar senha está registrado
"""
import sys
import os

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app
    
    print("=" * 80)
    print("🔍 VERIFICANDO ENDPOINTS REGISTRADOS:")
    print("=" * 80)
    
    alterar_senha_encontrado = False
    total_endpoints = 0
    
    for route in app.routes:
        if hasattr(route, 'path'):
            total_endpoints += 1
            methods = getattr(route, 'methods', set())
            path = route.path
            
            if 'alterar-senha' in path:
                alterar_senha_encontrado = True
                print(f"✅ ENCONTRADO: {list(methods)} {path}")
            elif 'auth' in path:
                print(f"   🔐 {list(methods)} {path}")
    
    print("=" * 80)
    print(f"📊 Total de endpoints: {total_endpoints}")
    
    if alterar_senha_encontrado:
        print("✅ Endpoint /api/auth/alterar-senha está REGISTRADO!")
        sys.exit(0)
    else:
        print("❌ Endpoint /api/auth/alterar-senha NÃO foi encontrado!")
        print("   Verifique se o código foi salvo corretamente.")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Erro ao verificar endpoints: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

