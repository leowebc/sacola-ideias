"""
Exemplo de endpoint para /api/contato
Adapte este código ao seu framework e estrutura de backend
"""

# =====================================================
# EXEMPLO PARA FASTAPI (Python)
# =====================================================

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import asyncpg  # ou psycopg2, supabase, etc.

router = APIRouter(prefix="/api", tags=["contato"])

# Modelo de dados de entrada
class ContatoRequest(BaseModel):
    nome: str
    email: EmailStr
    assunto: str
    mensagem: str
    email_destino: Optional[str] = "contato@sacoladeideias.com"

# Modelo de resposta
class ContatoResponse(BaseModel):
    id: int
    message: str

# Função para obter usuário do token (se houver)
async def get_current_user_id(token: Optional[str] = None) -> Optional[int]:
    """
    Extrai o ID do usuário do token JWT
    Retorna None se não houver token ou usuário não autenticado
    """
    if not token:
        return None
    
    try:
        # Decodificar token JWT e extrair user_id
        # Adapte conforme sua implementação de autenticação
        # Exemplo: payload = jwt.decode(token, SECRET_KEY)
        # return payload.get("user_id")
        return None  # Placeholder
    except:
        return None

@router.post("/contato", response_model=ContatoResponse, status_code=status.HTTP_201_CREATED)
async def criar_contato(
    contato: ContatoRequest,
    # token: Optional[str] = Header(None)  # Se usar header Authorization
):
    """
    Endpoint para receber mensagens do formulário Fale Conosco
    """
    try:
        # 1. Obter ID do usuário (se estiver logado)
        # usuario_id = await get_current_user_id(token)
        usuario_id = None  # Por enquanto None, implemente a autenticação
        
        # 2. Validar dados
        if not contato.nome.strip() or not contato.email.strip() or not contato.assunto.strip() or not contato.mensagem.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todos os campos são obrigatórios"
            )
        
        # 3. Conectar ao banco de dados
        # Adapte conforme sua conexão (Supabase, PostgreSQL direto, etc.)
        # Exemplo com asyncpg:
        # conn = await asyncpg.connect(DATABASE_URL)
        
        # 4. Inserir no banco
        query = """
            INSERT INTO contato (
                usuario_id,
                nome,
                email,
                assunto,
                mensagem,
                email_destino,
                status,
                criado_em
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        """
        
        # Exemplo de execução (adaptar conforme seu ORM/banco):
        # result = await conn.fetchrow(
        #     query,
        #     usuario_id,
        #     contato.nome.strip(),
        #     contato.email.strip(),
        #     contato.assunto.strip(),
        #     contato.mensagem.strip(),
        #     contato.email_destino or "contato@sacoladeideias.com",
        #     "pendente",
        #     datetime.now()
        # )
        # contato_id = result["id"]
        # await conn.close()
        
        # PLACEHOLDER - substitua pela sua implementação real
        contato_id = 1  # Placeholder
        
        # 5. (Opcional) Enviar email
        # await enviar_email_contato(contato, contato_id)
        
        # 6. Retornar sucesso
        return ContatoResponse(
            id=contato_id,
            message="Mensagem enviada com sucesso"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao criar contato: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar mensagem. Tente novamente mais tarde."
        )


# =====================================================
# EXEMPLO PARA FLASK (Python)
# =====================================================

"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

contato_bp = Blueprint('contato', __name__)

@contato_bp.route('/api/contato', methods=['POST'])
def criar_contato():
    try:
        data = request.get_json()
        
        # Validar dados
        if not all([data.get('nome'), data.get('email'), data.get('assunto'), data.get('mensagem')]):
            return jsonify({'detail': 'Todos os campos são obrigatórios'}), 400
        
        # Obter usuario_id do token (se houver)
        usuario_id = None  # Implementar extração do token
        
        # Conectar ao banco
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Inserir
        cur.execute("""
            INSERT INTO contato (usuario_id, nome, email, assunto, mensagem, email_destino, status, criado_em)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            usuario_id,
            data['nome'].strip(),
            data['email'].strip(),
            data['assunto'].strip(),
            data['mensagem'].strip(),
            data.get('email_destino', 'contato@sacoladeideias.com'),
            'pendente',
            datetime.now()
        ))
        
        contato_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'id': contato_id, 'message': 'Mensagem enviada com sucesso'}), 201
        
    except Exception as e:
        return jsonify({'detail': 'Erro ao processar mensagem'}), 500
"""


# =====================================================
# EXEMPLO PARA EXPRESS (Node.js)
# =====================================================

"""
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

router.post('/api/contato', async (req, res) => {
  try {
    const { nome, email, assunto, mensagem, email_destino } = req.body;
    
    // Validar
    if (!nome || !email || !assunto || !mensagem) {
      return res.status(400).json({ detail: 'Todos os campos são obrigatórios' });
    }
    
    // Obter usuario_id do token (se houver)
    const usuario_id = null; // Implementar extração do token
    
    // Inserir
    const result = await pool.query(
      `INSERT INTO contato (usuario_id, nome, email, assunto, mensagem, email_destino, status, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        usuario_id,
        nome.trim(),
        email.trim(),
        assunto.trim(),
        mensagem.trim(),
        email_destino || 'contato@sacoladeideias.com',
        'pendente',
        new Date()
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      message: 'Mensagem enviada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao criar contato:', error);
    res.status(500).json({ detail: 'Erro ao processar mensagem' });
  }
});

module.exports = router;
"""

