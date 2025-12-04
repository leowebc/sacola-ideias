"""
Módulo de autenticação - Google OAuth e JWT
"""

import jwt
import httpx
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# Configurações JWT
JWT_SECRET = os.getenv("JWT_SECRET", "sua-chave-secreta-mude-em-producao")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 dias

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

def criar_token_jwt(user_id: int, email: str, role: str = "user") -> str:
    """Criar token JWT para o usuário"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def hash_senha(senha: str) -> str:
    """Criar hash da senha usando bcrypt"""
    return bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Verificar se a senha está correta"""
    try:
        return bcrypt.checkpw(senha.encode('utf-8'), senha_hash.encode('utf-8'))
    except Exception:
        return False

def verificar_token_jwt(token: str) -> Optional[dict]:
    """Verificar e decodificar token JWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        print(f"   ✅ Token decodificado com sucesso!")
        return payload
    except jwt.ExpiredSignatureError as e:
        print(f"   ❌ Token expirado: {e}")
        return None
    except jwt.InvalidTokenError as e:
        print(f"   ❌ Token inválido: {e}")
        return None
    except Exception as e:
        print(f"   ❌ Erro inesperado ao decodificar token: {e}")
        import traceback
        traceback.print_exc()
        return None

async def validar_token_google(token: str) -> Optional[dict]:
    """
    Validar token do Google e retornar informações do usuário
    """
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID não configurado no .env")
    
    try:
        # Verificar token com Google
        async with httpx.AsyncClient() as client:
            # Primeiro, obter informações do token
            response = await client.get(
                f"https://www.googleapis.com/oauth2/v1/userinfo",
                params={"access_token": token}
            )
            
            if response.status_code != 200:
                # Tentar validar com ID token
                response = await client.post(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": token}
                )
            
            if response.status_code == 200:
                user_info = response.json()
                
                # Validar se o token pertence ao nosso cliente
                if 'aud' in user_info and user_info['aud'] != GOOGLE_CLIENT_ID:
                    return None
                
                return {
                    "google_id": user_info.get("id") or user_info.get("sub"),
                    "email": user_info.get("email"),
                    "nome": user_info.get("name"),
                    "foto_url": user_info.get("picture"),
                    "verificado": user_info.get("verified_email", False)
                }
            
            return None
            
    except Exception as e:
        print(f"Erro ao validar token Google: {e}")
        return None

async def obter_info_google_por_code(code: str, redirect_uri: str) -> Optional[dict]:
    """
    Trocar authorization code por access token e obter informações do usuário
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise ValueError("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurado no .env")
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Trocar code por access token
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                print(f"Erro ao trocar code: {token_response.text}")
                return None
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            id_token = tokens.get("id_token")
            
            # 2. Obter informações do usuário
            if id_token:
                # Decodificar ID token (sem verificar por enquanto, vamos usar a API)
                user_response = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
            else:
                user_response = await client.get(
                    "https://www.googleapis.com/oauth2/v1/userinfo",
                    params={"access_token": access_token}
                )
            
            if user_response.status_code == 200:
                user_info = user_response.json()
                return {
                    "google_id": user_info.get("id") or user_info.get("sub"),
                    "email": user_info.get("email"),
                    "nome": user_info.get("name"),
                    "foto_url": user_info.get("picture"),
                    "verificado": user_info.get("verified_email", False),
                    "access_token": access_token,
                    "id_token": id_token
                }
            
            return None
            
    except Exception as e:
        print(f"Erro ao obter info Google: {e}")
        return None

