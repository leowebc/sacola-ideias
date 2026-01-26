"""
Backend FastAPI para Sacola de Ideias
Conecta com PostgreSQL usando pgvector
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import stripe
import traceback
try:
    import stripe.checkout as stripe_checkout
except Exception:
    stripe_checkout = None
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from auth import (
    criar_token_jwt, 
    verificar_token_jwt, 
    obter_info_google_por_code,
    hash_senha,
    verificar_senha,
    GOOGLE_CLIENT_ID
)

load_dotenv()

# =====================================================
# CONFIGURAÇÕES DE AMBIENTE (URLs e Portas)
# =====================================================
# Todas as URLs e portas devem vir do .env para funcionar em local e produção
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8002"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"http://localhost:{BACKEND_PORT}/api/auth/google/callback")
CONTATO_EMAIL = os.getenv("CONTATO_EMAIL", "contato@sacoladeideias.com")

# Configurar embeddings (usa API Key do .env)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", f"{FRONTEND_URL}/app?checkout=success")
STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", f"{FRONTEND_URL}/app?checkout=cancel")
PRO_LIMITE_BUSCAS = int(os.getenv("PRO_LIMITE_BUSCAS", "1000"))
PRO_LIMITE_EMBEDDINGS = int(os.getenv("PRO_LIMITE_EMBEDDINGS", "1000"))
FREE_LIMITE_BUSCAS = int(os.getenv("FREE_LIMITE_BUSCAS", "10"))
FREE_LIMITE_EMBEDDINGS = int(os.getenv("FREE_LIMITE_EMBEDDINGS", "10"))
TRIAL_DIAS = int(os.getenv("TRIAL_DIAS", "3"))

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
embeddings_model = None

def get_embeddings_model():
    """Obter modelo de embeddings (singleton)"""
    global embeddings_model
    if embeddings_model is None and OPENAI_API_KEY:
        embeddings_model = OpenAIEmbeddings(
            openai_api_key=OPENAI_API_KEY,
            model="text-embedding-3-small"
        )
    return embeddings_model

def gerar_embedding(texto: str):
    """Gerar embedding para um texto"""
    model = get_embeddings_model()
    if not model:
        return None
    try:
        return model.embed_query(texto)
    except Exception as e:
        print(f"Erro ao gerar embedding: {e}")
        return None

app = FastAPI(title="Sacola de Ideias API")

# Evento de startup para verificar endpoints registrados e testar conexão
@app.on_event("startup")
async def startup_event():
    print("=" * 80)
    # Diagnóstico rápido do Stripe (não expõe segredos)
    try:
        from stripe import _version as _stripe_version
        print(f"💳 Stripe SDK: {_stripe_version.VERSION}")
        print(f"   stripe module: {getattr(stripe, '__file__', 'n/a')}")
        print(f"   checkout module: {getattr(stripe_checkout, '__file__', 'n/a')}")
        print(f"   has stripe.apps.Secret: {hasattr(getattr(stripe, 'apps', None), 'Secret')}")
    except Exception as e:
        print(f"⚠️  Falha ao inspecionar Stripe SDK: {e}")
    print("📋 TODOS OS ENDPOINTS REGISTRADOS:")
    total_routes = 0
    lembrancas_routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            total_routes += 1
            methods = getattr(route, 'methods', set())
            if 'lembrancas' in route.path:
                lembrancas_routes.append(f"{list(methods)} {route.path}")
                print(f"   ✅ {list(methods)} {route.path}")
    print(f"📊 Total de rotas: {total_routes}")
    if lembrancas_routes:
        print("✅ Endpoints de lembranças encontrados!")
    else:
        print("❌ NENHUM endpoint de lembranças encontrado!")
    print("=" * 80)
    
    # Testar conexão com o banco
    print("=" * 80)
    print("🔌 TESTANDO CONEXÃO COM O BANCO DE DADOS:")
    print(f"   Host: {DB_CONFIG['host']}")
    print(f"   Port: {DB_CONFIG['port']}")
    print(f"   Database: {DB_CONFIG['database']}")
    print(f"   User: {DB_CONFIG['user']}")
    print(f"   Password: {'***' if DB_CONFIG['password'] else 'NÃO CONFIGURADO'}")
    print("=" * 80)
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print(f"✅ Conexão com o banco estabelecida com sucesso!")
            print(f"   PostgreSQL version: {version[:50]}...")
        conn.close()
    except Exception as e:
        print(f"❌ ERRO ao conectar com o banco: {e}")
        print(f"   Verifique as credenciais no arquivo .env")
    print("=" * 80)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique os domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração do banco de dados (Supabase ou PostgreSQL local)
# Em produção: use as variáveis de ambiente do servidor
# Em local: configure no arquivo .env (veja ENV_SETUP.md)
# 
# NOTA: Você pode usar o mesmo Supabase em local e produção, ou criar um banco
# separado para desenvolvimento local. Basta mudar as variáveis DB_* no .env local.
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "postgres"),  # Supabase usa 'postgres' como database padrão
    "user": os.getenv("DB_USER", "postgres"),
    # Prioridade: SUPABASE_DB_PASSWORD > DB_PASSWORD > fallback
    "password": os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("DB_PASSWORD", "senha123"),
    "port": int(os.getenv("DB_PORT", "5432")),  # Converter para int
}

# Adicionar sslmode se especificado (importante para Supabase)
if os.getenv("DB_SSLMODE"):
    DB_CONFIG["sslmode"] = os.getenv("DB_SSLMODE")

def get_db_connection():
    """Criar conexão com o banco de dados"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ Erro de conexão com o banco: {e}")
        print(f"   Host: {DB_CONFIG.get('host', 'N/A')}")
        print(f"   Port: {DB_CONFIG.get('port', 'N/A')}")
        print(f"   Database: {DB_CONFIG.get('database', 'N/A')}")
        print(f"   User: {DB_CONFIG.get('user', 'N/A')}")
        print(f"   Password configurada: {'Sim' if DB_CONFIG.get('password') else 'NÃO'}")
        print(f"   SSL Mode: {DB_CONFIG.get('sslmode', 'não especificado')}")
        raise HTTPException(
            status_code=503, 
            detail=f"Erro ao conectar ao banco de dados. Verifique as credenciais no .env. Detalhes: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Erro inesperado ao conectar: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro inesperado ao conectar ao banco: {str(e)}"
        )

# Modelos Pydantic
class IdeiaBase(BaseModel):
    titulo: str
    tag: Optional[str] = None
    ideia: str

class IdeiaCreate(IdeiaBase):
    pass

class IdeiaUpdate(IdeiaBase):
    pass

class IdeiaResponse(IdeiaBase):
    id: int
    data: datetime
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class IdeiaComEmbedding(BaseModel):
    ideia: IdeiaCreate
    embedding: List[float]

class BuscaRequest(BaseModel):
    termo: str
    limite: Optional[int] = 10
    probes: Optional[int] = 15

class BuscaResponse(BaseModel):
    id: int
    titulo: str
    tag: Optional[str]
    ideia: str
    data: datetime
    similarity: float

class BackfillEmbeddingsRequest(BaseModel):
    limite: Optional[int] = 50
    forcar: Optional[bool] = False


class AcessoCreate(BaseModel):
    usuario_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    pais: Optional[str] = None
    cidade: Optional[str] = None
    regiao: Optional[str] = None
    timezone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    endpoint: str
    metodo_http: str
    status_code: int
    tempo_resposta_ms: Optional[int] = None

class GoogleAuthRequest(BaseModel):
    code: str
    redirect_uri: str

class UserResponse(BaseModel):
    id: int
    email: str
    nome: Optional[str]
    foto_url: Optional[str]
    metodo_auth: str
    role: str
    token: str

class RegisterRequest(BaseModel):
    email: str
    senha: str
    nome: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    senha: str

class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str

# Função para obter usuário autenticado
async def obter_usuario_atual(request: Request) -> dict:
    """Extrair usuário do token JWT - LANÇA EXCEÇÃO se não autenticado"""
    import sys
    sys.stdout.flush()  # Forçar saída imediata
    print("=" * 80, flush=True)
    print("🔐 [obter_usuario_atual] Processando autenticação", flush=True)
    
    # Tentar obter o header Authorization de diferentes formas
    authorization = request.headers.get("Authorization") or request.headers.get("authorization")
    
    print(f"   Authorization header recebido: {bool(authorization)}")
    
    if not authorization:
        print("❌ ERRO: Authorization header não recebido!")
        print(f"   Headers disponíveis: {list(request.headers.keys())}")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token de autenticação não fornecido")
    
    print(f"   Authorization header: {authorization[:50]}..." if len(authorization) > 50 else f"   Authorization header: {authorization}")
    
    if not authorization.startswith("Bearer "):
        print(f"❌ ERRO: Authorization header inválido (não começa com 'Bearer '): {authorization[:30]}...")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Formato de token inválido. Use 'Bearer <token>'")
    
    token = authorization.split(" ")[1]
    print(f"   Token extraído: {token[:30]}...")
    
    payload = verificar_token_jwt(token)
    
    if not payload:
        print("❌ ERRO: Token inválido ou expirado - verificar_token_jwt retornou None")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    user_id = payload.get('user_id')
    email = payload.get('email', 'N/A')
    print(f"✅ Token válido decodificado!")
    print(f"   Payload completo: {payload}")
    print(f"   user_id extraído: {user_id}")
    print(f"   email extraído: {email}")
    
    if not user_id:
        print("❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo: {payload}")
        print(f"   Chaves disponíveis no payload: {list(payload.keys())}")
        print("=" * 80)
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado no token")
    
    print("=" * 80)
    return payload

# -----------------------------------------------------
# Assinaturas / Trial (3 dias) - helpers
# -----------------------------------------------------
def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        text = str(value)
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _now_utc():
    return datetime.now(timezone.utc)


def _is_expired(dt_value: Optional[datetime]) -> bool:
    if not dt_value:
        return True
    if dt_value.tzinfo:
        return dt_value < _now_utc()
    return dt_value < datetime.utcnow()


def _get_assinatura_row(usuario_id: int) -> Optional[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM assinaturas WHERE usuario_id = %s ORDER BY id DESC LIMIT 1",
                (usuario_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def _trial_expira_em_from_row(row: Optional[dict]) -> Optional[datetime]:
    if not row:
        return None
    exp = _parse_datetime(row.get("trial_expira_em"))
    if exp:
        return exp
    criado = _parse_datetime(row.get("criado_em")) or _parse_datetime(row.get("created_at"))
    if criado:
        return criado + timedelta(days=TRIAL_DIAS)
    return None


def _assinatura_ativa(row: Optional[dict]) -> bool:
    if not row:
        return False
    plano = (row.get("plano") or "").lower()
    status = (row.get("status") or "").lower()
    if plano == "pro" and status in ("ativa", "active", "trialing"):
        return True
    if plano == "free":
        exp = _trial_expira_em_from_row(row)
        return exp is not None and not _is_expired(exp)
    return False


def _has_assinaturas_column(cur, column: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = %s",
        (column,),
    )
    return cur.fetchone() is not None


def _insert_trial_assinatura(cur, usuario_id: int) -> Optional[datetime]:
    """Cria assinatura free com trial configurável (se a coluna existir)."""
    trial_expira = _now_utc() + timedelta(days=TRIAL_DIAS)
    if _has_assinaturas_column(cur, "trial_expira_em"):
        cur.execute(
            """
            INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings, trial_expira_em)
            VALUES (%s, 'free', 'trial', %s, %s, %s)
            """,
            (usuario_id, FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS, trial_expira),
        )
        return trial_expira
    cur.execute(
        """
        INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings)
        VALUES (%s, 'free', 'trial', %s, %s)
        """,
        (usuario_id, FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS),
    )
    return None


async def obter_usuario_assinante(user: dict = Depends(obter_usuario_atual)) -> dict:
    """Permite acesso somente se assinatura estiver ativa (pro) ou trial válido."""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    role = (user.get("role") or "").lower()
    if role in ("admin", "superadmin"):
        return user

    usuario_id = user.get("user_id")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    assinatura = _get_assinatura_row(usuario_id)
    if _assinatura_ativa(assinatura):
        return user

    raise HTTPException(
        status_code=402,
        detail="Trial expirado. Ative o plano Pro para continuar.",
    )

# Rotas
@app.get("/")
def root():
    return {"message": "Sacola de Ideias API", "status": "online"}

@app.get("/api/ideias", response_model=List[IdeiaResponse])
def buscar_todas_ideias(user: dict = Depends(obter_usuario_assinante)):
    """Buscar todas as ideias do usuário autenticado"""
    if not user:
        print("❌ ERRO: Tentativa de buscar ideias sem autenticação!")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id")
    usuario_email = user.get("email", "N/A")
    
    if not usuario_id:
        print(f"❌ ERRO: Token não contém 'user_id'! Payload: {user}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"🔍 Buscando ideias para usuario_id: {usuario_id} (email: {usuario_email})")
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Primeiro, verificar se existem ideias sem dono (para debug)
            cur.execute("SELECT COUNT(*) as total FROM ideias WHERE usuario_id IS NULL")
            sem_dono = cur.fetchone()["total"]
            if sem_dono > 0:
                print(f"⚠️  AVISO: Existem {sem_dono} ideia(s) sem dono (usuario_id IS NULL) no banco!")
            
            # Verificar total de ideias no banco (para debug)
            cur.execute("SELECT COUNT(*) as total FROM ideias")
            total_geral = cur.fetchone()["total"]
            print(f"📊 Total de ideias no banco: {total_geral}")
            
            # Buscar apenas ideias do usuário (garantir que usuario_id não é NULL)
            cur.execute(
                "SELECT id, titulo, tag, ideia, data, created_at, updated_at FROM ideias WHERE usuario_id = %s ORDER BY data DESC",
                (usuario_id,)
            )
            ideias = cur.fetchall()
            print(f"✅ Encontradas {len(ideias)} ideia(s) para usuario_id: {usuario_id} (email: {usuario_email})")
            
            # Log detalhado de cada ideia retornada
            for ideia in ideias:
                print(f"   • ID {ideia['id']}: '{ideia['titulo']}' | Tag: '{ideia.get('tag', 'N/A')}'")
            
            # Converter para dict e garantir formato correto
            resultado = []
            for ideia in ideias:
                ideia_dict = dict(ideia)
                # Garantir que não retornamos ideias sem usuario_id (double-check)
                # Converter datetime para string ISO
                if 'data' in ideia_dict and ideia_dict['data']:
                    if hasattr(ideia_dict['data'], 'isoformat'):
                        ideia_dict['data'] = ideia_dict['data'].isoformat()
                if 'created_at' in ideia_dict and ideia_dict['created_at']:
                    if hasattr(ideia_dict['created_at'], 'isoformat'):
                        ideia_dict['created_at'] = ideia_dict['created_at'].isoformat()
                if 'updated_at' in ideia_dict and ideia_dict['updated_at']:
                    if hasattr(ideia_dict['updated_at'], 'isoformat'):
                        ideia_dict['updated_at'] = ideia_dict['updated_at'].isoformat()
                resultado.append(ideia_dict)
            
            print(f"✅ Retornando {len(resultado)} ideia(s) para o frontend")
            return resultado
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar ideias: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao buscar ideias: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/ideias/{ideia_id}", response_model=IdeiaResponse)
def buscar_ideia_por_id(ideia_id: int, user: dict = Depends(obter_usuario_assinante)):
    """Buscar ideia por ID (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM ideias WHERE id = %s AND usuario_id = %s", (ideia_id, usuario_id))
            ideia = cur.fetchone()
            if not ideia:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")
            return dict(ideia)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar ideia: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias", response_model=IdeiaResponse)
async def criar_ideia(ideia: IdeiaCreate, request: Request, user: dict = Depends(obter_usuario_assinante)):
    """Criar nova ideia com embedding automático (associada ao usuário)"""
    import sys
    sys.stdout.flush()  # Forçar saída imediata
    print("=" * 80, flush=True)
    print("📝 NOVA REQUISIÇÃO: Criar Ideia", flush=True)
    print(f"   Payload recebido: titulo='{ideia.titulo}', tag='{ideia.tag}', ideia='{ideia.ideia[:50] if ideia.ideia else ''}...'")
    
    # Verificar headers diretamente
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    print(f"   Authorization header direto: {'Presente' if auth_header else 'AUSENTE!'}")
    
    print(f"   User object recebido: {user}")
    print(f"   Tipo do user: {type(user)}")
    print("=" * 80)
    
    if not user:
        print("❌ ERRO CRÍTICO: Tentativa de criar ideia sem autenticação!")
        print("   O header Authorization não foi enviado ou o token é inválido")
        print(f"   Headers recebidos: {list(request.headers.keys())}")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id") if isinstance(user, dict) else None
    usuario_email = user.get("email", "N/A") if isinstance(user, dict) else "N/A"
    
    if not usuario_id:
        print(f"❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo do token: {user}")
        print(f"   Tipo do user: {type(user)}")
        if isinstance(user, dict):
            print(f"   Chaves disponíveis no user: {list(user.keys())}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"✅ Autenticação OK: usuario_id={usuario_id}, email={usuario_email}")
    print(f"📝 Criando ideia para usuario_id: {usuario_id}, titulo: '{ideia.titulo}'")
    
    conn = get_db_connection()
    try:
        # Gerar embedding automaticamente se API Key estiver configurada
        embedding_str = None
        modelo = get_embeddings_model()
        if modelo:
            try:
                texto_completo = f"{ideia.titulo} {ideia.tag or ''} {ideia.ideia}".strip()
                embedding = gerar_embedding(texto_completo)
                if embedding:
                    embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                    print(f"   ✅ Embedding gerado: {len(embedding)} dimensões")
            except Exception as e:
                print(f"⚠️  Erro ao gerar embedding (salvando sem embedding): {e}")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # VALIDAÇÃO FINAL CRÍTICA: Garantir que usuario_id não é None antes do INSERT
            if usuario_id is None or usuario_id == "":
                error_msg = f"ERRO CRÍTICO: usuario_id é None ou vazio antes do INSERT! user={user}"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            # Garantir que é um número inteiro
            try:
                usuario_id = int(usuario_id)
            except (ValueError, TypeError):
                error_msg = f"ERRO CRÍTICO: usuario_id não é um número válido! usuario_id={usuario_id}, tipo={type(usuario_id)}"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            print(f"   💾 Executando INSERT com usuario_id={usuario_id} (tipo: {type(usuario_id)})", flush=True)
            print(f"   📋 Valores a inserir: titulo='{ideia.titulo}', tag='{ideia.tag}', usuario_id={usuario_id}", flush=True)
            
            # ÚLTIMA VERIFICAÇÃO ANTES DO INSERT - NUNCA PERMITIR NULL
            if usuario_id is None:
                import sys
                sys.stderr.write(f"❌ ERRO CRÍTICO: Tentativa de INSERT com usuario_id=None bloqueada!\n")
                sys.stderr.flush()
                conn.rollback()
                raise ValueError("usuario_id NÃO PODE SER None - operação bloqueada por segurança")
            
            # Garantir que é int
            usuario_id = int(usuario_id)
            
            if embedding_str:
                cur.execute(
                    "INSERT INTO ideias (titulo, tag, ideia, embedding, usuario_id) VALUES (%s, %s, %s, %s::vector, %s) RETURNING *",
                    (ideia.titulo, ideia.tag, ideia.ideia, embedding_str, usuario_id)
                )
            else:
                cur.execute(
                    "INSERT INTO ideias (titulo, tag, ideia, usuario_id) VALUES (%s, %s, %s, %s) RETURNING *",
                    (ideia.titulo, ideia.tag, ideia.ideia, usuario_id)
                )
            
            nova_ideia = cur.fetchone()
            
            if not nova_ideia:
                error_msg = "ERRO: INSERT não retornou nenhum resultado!"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            # Verificar o que foi realmente salvo
            usuario_id_salvo = nova_ideia.get('usuario_id') if nova_ideia else None
            print(f"   📊 Resultado do INSERT:")
            print(f"      • ID: {nova_ideia['id']}")
            print(f"      • Título: '{nova_ideia['titulo']}'")
            print(f"      • usuario_id SALVO: {usuario_id_salvo} (tipo: {type(usuario_id_salvo)})")
            
            if usuario_id_salvo is None:
                error_msg = "ERRO CRÍTICO: usuario_id foi salvo como NULL no banco apesar de validações!"
                print(f"   ❌ {error_msg}")
                conn.rollback()
                raise ValueError(error_msg)
            
            if int(usuario_id_salvo) != int(usuario_id):
                print(f"   ⚠️  ATENÇÃO: usuario_id esperado ({usuario_id}) diferente do salvo ({usuario_id_salvo})")
            
            conn.commit()
            print(f"✅ Ideia criada com sucesso: ID {nova_ideia['id']}, usuario_id={usuario_id_salvo}")
            print("=" * 80)
            return dict(nova_ideia)
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar ideia: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar ideia: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.post("/api/ideias/com-embedding", response_model=IdeiaResponse)
def criar_ideia_com_embedding(dados: IdeiaComEmbedding, user: dict = Depends(obter_usuario_assinante)):
    """Criar ideia com embedding (associada ao usuário)"""
    print("=" * 80)
    print("📝 NOVA REQUISIÇÃO: Criar Ideia COM Embedding")
    print(f"   Payload recebido: titulo='{dados.ideia.titulo}', tag='{dados.ideia.tag}'")
    print(f"   User object recebido: {user}")
    print("=" * 80)
    
    if not user:
        print("❌ ERRO CRÍTICO: Tentativa de criar ideia com embedding sem autenticação!")
        print("   O header Authorization não foi enviado ou o token é inválido")
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user.get("user_id")
    usuario_email = user.get("email", "N/A")
    
    if not usuario_id:
        print(f"❌ ERRO CRÍTICO: Token não contém 'user_id'!")
        print(f"   Payload completo do token: {user}")
        raise HTTPException(status_code=401, detail="Token inválido: user_id não encontrado")
    
    print(f"✅ Autenticação OK: usuario_id={usuario_id}, email={usuario_email}")
    print(f"📝 Criando ideia com embedding para usuario_id: {usuario_id}, titulo: '{dados.ideia.titulo}'")
    
    conn = get_db_connection()
    try:
        embedding_str = "[" + ",".join(map(str, dados.embedding)) + "]"
        
        # Garantir que usuario_id não é None antes do INSERT
        if usuario_id is None:
            raise ValueError("usuario_id não pode ser None no momento do INSERT")
        
        print(f"   💾 Executando INSERT com usuario_id={usuario_id}")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO ideias (titulo, tag, ideia, embedding, usuario_id) VALUES (%s, %s, %s, %s::vector, %s) RETURNING *",
                (dados.ideia.titulo, dados.ideia.tag, dados.ideia.ideia, embedding_str, usuario_id)
            )
            nova_ideia = cur.fetchone()
            
            # Verificar o que foi realmente salvo
            usuario_id_salvo = nova_ideia.get('usuario_id') if nova_ideia else None
            print(f"   📊 Resultado do INSERT:")
            print(f"      • ID: {nova_ideia['id'] if nova_ideia else 'N/A'}")
            print(f"      • Título: '{nova_ideia['titulo'] if nova_ideia else 'N/A'}'")
            print(f"      • usuario_id SALVO: {usuario_id_salvo}")
            
            if usuario_id_salvo is None:
                print("   ❌ ERRO: usuario_id foi salvo como NULL no banco!")
                conn.rollback()
                raise ValueError("usuario_id não pode ser NULL - problema no INSERT")
            
            if usuario_id_salvo != usuario_id:
                print(f"   ⚠️  ATENÇÃO: usuario_id esperado ({usuario_id}) diferente do salvo ({usuario_id_salvo})")
            
            conn.commit()
            print(f"✅ Ideia criada com embedding com sucesso: ID {nova_ideia['id']}, usuario_id={usuario_id_salvo}")
            print("=" * 80)
            return dict(nova_ideia)
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar ideia: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar ideia: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.put("/api/ideias/{ideia_id}", response_model=IdeiaResponse)
def atualizar_ideia(ideia_id: int, ideia: IdeiaUpdate, user: dict = Depends(obter_usuario_assinante)):
    """Atualizar ideia existente (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a ideia existe e pertence ao usuário
            cur.execute("SELECT * FROM ideias WHERE id = %s AND usuario_id = %s", (ideia_id, usuario_id))
            ideia_existente = cur.fetchone()
            if not ideia_existente:
                raise HTTPException(status_code=404, detail="Ideia não encontrada ou você não tem permissão para editar")
            
            # Usar valores atualizados ou manter os existentes
            titulo_final = ideia.titulo if ideia.titulo is not None else ideia_existente['titulo']
            tag_final = ideia.tag if ideia.tag is not None else ideia_existente['tag']
            ideia_final = ideia.ideia if ideia.ideia is not None else ideia_existente['ideia']
            
            # Regenerar embedding automaticamente se API Key estiver configurada
            embedding_str = None
            modelo = get_embeddings_model()
            if modelo:
                try:
                    texto_completo = f"{titulo_final} {tag_final or ''} {ideia_final}".strip()
                    embedding = gerar_embedding(texto_completo)
                    if embedding:
                        embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                except Exception as e:
                    print(f"⚠️  Erro ao regenerar embedding (continuando sem atualizar embedding): {e}")
            
            # Atualizar ideia (verificar se pertence ao usuário)
            if embedding_str:
                cur.execute(
                    "UPDATE ideias SET titulo = %s, tag = %s, ideia = %s, embedding = %s::vector, updated_at = NOW() WHERE id = %s AND usuario_id = %s RETURNING *",
                    (titulo_final, tag_final, ideia_final, embedding_str, ideia_id, usuario_id)
                )
            else:
                cur.execute(
                    "UPDATE ideias SET titulo = %s, tag = %s, ideia = %s, updated_at = NOW() WHERE id = %s AND usuario_id = %s RETURNING *",
                    (titulo_final, tag_final, ideia_final, ideia_id, usuario_id)
                )
            
            ideia_atualizada = cur.fetchone()
            conn.commit()
            return dict(ideia_atualizada)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar ideia: {str(e)}")
    finally:
        conn.close()

@app.put("/api/ideias/{ideia_id}/embedding")
def atualizar_embedding(ideia_id: int, embedding: List[float], user: dict = Depends(obter_usuario_assinante)):
    """Atualizar embedding de uma ideia"""
    conn = get_db_connection()
    try:
        embedding_str = "[" + ",".join(map(str, embedding)) + "]"
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE ideias SET embedding = %s::vector WHERE id = %s RETURNING *",
                (embedding_str, ideia_id)
            )
            ideia = cur.fetchone()
            if not ideia:
                raise HTTPException(status_code=404, detail="Ideia não encontrada")
            conn.commit()
            return {"message": "Embedding atualizado com sucesso", "ideia": dict(ideia)}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar embedding: {str(e)}")
    finally:
        conn.close()

@app.delete("/api/ideias/{ideia_id}")
def deletar_ideia(ideia_id: int, user: dict = Depends(obter_usuario_assinante)):
    """Deletar ideia (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ideias WHERE id = %s AND usuario_id = %s RETURNING id", (ideia_id, usuario_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Ideia não encontrada ou você não tem permissão para deletar")
            conn.commit()
            return {"message": "Ideia deletada com sucesso", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar ideia: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias/buscar", response_model=List[BuscaResponse])
def buscar_por_similaridade(busca: BuscaRequest, user: dict = Depends(obter_usuario_assinante)):
    """Buscar ideias por similaridade (apenas do usuário autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    usuario_id = user["user_id"]
    limite = busca.limite if busca.limite and busca.limite > 0 else 10
    limite = min(max(limite, 1), 50)  # guarda-chuva para evitar abusos
    probes = busca.probes if busca.probes and busca.probes > 0 else 10
    probes = min(max(probes, 1), 200)
    conn = get_db_connection()
    try:
        # Gerar embedding do termo de busca automaticamente
        modelo = get_embeddings_model()
        if not modelo:
            # Se não tiver API Key, fazer busca simples (apenas do usuário)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                termo = busca.termo.lower()
                cur.execute("""
                    SELECT 
                        id,
                        titulo,
                        tag,
                        ideia,
                        data,
                        0.0 AS similarity
                    FROM ideias
                    WHERE usuario_id = %s
                      AND (LOWER(titulo) LIKE %s 
                       OR LOWER(tag) LIKE %s 
                       OR LOWER(ideia) LIKE %s)
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, f'%{termo}%', f'%{termo}%', f'%{termo}%', limite))
                resultados = cur.fetchall()
                return [dict(resultado) for resultado in resultados]
        
        # Gerar embedding da busca
        embedding_busca = gerar_embedding(busca.termo)
        if not embedding_busca:
            raise HTTPException(status_code=500, detail="Erro ao gerar embedding da busca")
        
        embedding_str = "[" + ",".join(map(str, embedding_busca)) + "]"
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Ajusta probes para balancear precisão x velocidade no ivfflat
            cur.execute("SET LOCAL ivfflat.probes = %s", (probes,))
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM ideias
                WHERE usuario_id = %s AND embedding IS NOT NULL
                  AND (embedding <=> %s::vector) <= 0.7  -- equivalente a similarity >= 0.3
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (embedding_str, usuario_id, embedding_str, embedding_str, limite))
            resultados = cur.fetchall()
            if resultados:
                return [dict(resultado) for resultado in resultados]

            # Segunda passada semantica mais flexivel
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM ideias
                WHERE usuario_id = %s AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (embedding_str, usuario_id, embedding_str, limite))
            resultados = cur.fetchall()
            if resultados:
                return [dict(resultado) for resultado in resultados]

            # Fallback textual quando a busca semantica nao retorna nada
            termo = busca.termo.lower()
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    0.0 AS similarity
                FROM ideias
                WHERE usuario_id = %s
                  AND (LOWER(titulo) LIKE %s 
                   OR LOWER(tag) LIKE %s 
                   OR LOWER(ideia) LIKE %s)
                ORDER BY data DESC
                LIMIT %s
            """, (usuario_id, f'%{termo}%', f'%{termo}%', f'%{termo}%', limite))
            resultados = cur.fetchall()
            return [dict(resultado) for resultado in resultados]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na busca por similaridade: {str(e)}")
    finally:
        conn.close()

@app.post("/api/ideias/embeddings/backfill")
def backfill_embeddings(payload: BackfillEmbeddingsRequest, user: dict = Depends(obter_usuario_assinante)):
    """Backfill embeddings das ideias sem vetor (apenas do usuario autenticado)"""
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    
    usuario_id = user["user_id"]
    limite = payload.limite if payload.limite and payload.limite > 0 else 50
    limite = min(max(limite, 1), 200)
    forcar = bool(payload.forcar)

    modelo = get_embeddings_model()
    if not modelo:
        raise HTTPException(status_code=400, detail="Modelo de embeddings indisponivel (OPENAI_API_KEY nao configurada)")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if forcar:
                cur.execute("""
                    SELECT id, titulo, tag, ideia
                    FROM ideias
                    WHERE usuario_id = %s
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, limite))
            else:
                cur.execute("""
                    SELECT id, titulo, tag, ideia
                    FROM ideias
                    WHERE usuario_id = %s AND embedding IS NULL
                    ORDER BY data DESC
                    LIMIT %s
                """, (usuario_id, limite))
            ideias = cur.fetchall()
            if not ideias:
                return {"total": 0, "updated": 0, "skipped": 0, "ids": []}

            updated_ids = []
            skipped = 0
            for ideia in ideias:
                texto = f"{ideia['titulo']} {ideia.get('tag') or ''} {ideia['ideia']}".strip()
                embedding = gerar_embedding(texto)
                if not embedding:
                    skipped += 1
                    continue
                embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                cur.execute(
                    "UPDATE ideias SET embedding = %s::vector, updated_at = NOW() WHERE id = %s AND usuario_id = %s",
                    (embedding_str, ideia["id"], usuario_id)
                )
                updated_ids.append(ideia["id"])
            conn.commit()
            return {
                "total": len(ideias),
                "updated": len(updated_ids),
                "skipped": skipped,
                "ids": updated_ids
            }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao fazer backfill de embeddings: {str(e)}")
    finally:
        conn.close()


# =============================
# Stripe - Checkout e Webhook
# =============================


def _parse_user_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _upsert_assinatura(cur, usuario_id, plano, status, limite_buscas, limite_embeddings):
    cur.execute("SELECT id FROM assinaturas WHERE usuario_id = %s", (usuario_id,))
    if cur.fetchone():
        cur.execute("""
            UPDATE assinaturas
            SET plano = %s, status = %s, limite_buscas = %s, limite_embeddings = %s
            WHERE usuario_id = %s
        """, (plano, status, limite_buscas, limite_embeddings, usuario_id))
    else:
        cur.execute("""
            INSERT INTO assinaturas (usuario_id, plano, status, limite_buscas, limite_embeddings)
            VALUES (%s, %s, %s, %s, %s)
        """, (usuario_id, plano, status, limite_buscas, limite_embeddings))


def _map_stripe_status(status):
    if status in ("active", "trialing"):
        return ("pro", "ativa", PRO_LIMITE_BUSCAS, PRO_LIMITE_EMBEDDINGS)
    return ("free", "ativa", FREE_LIMITE_BUSCAS, FREE_LIMITE_EMBEDDINGS)


def _get_first_assinaturas_column(cur, candidates):
    for column in candidates:
        if _has_assinaturas_column(cur, column):
            return column
    return None


def _from_unix_timestamp(value):
    try:
        if value is None:
            return None
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except Exception:
        return None


def _find_usuario_id_by_stripe_customer(cur, customer_id):
    if not customer_id:
        return None
    column = _get_first_assinaturas_column(cur, ["stripe_customer_id", "stripe_customer"])
    if not column:
        return None
    cur.execute(
        f"SELECT usuario_id FROM assinaturas WHERE {column} = %s ORDER BY id DESC LIMIT 1",
        (customer_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _update_assinatura_extras(cur, usuario_id, stripe_subscription_id=None, stripe_customer_id=None, data_inicio=None, data_fim=None):
    updates = []
    values = []

    subscription_column = _get_first_assinaturas_column(cur, ["stripe_subscription_id", "stripe_subscription"])
    if stripe_subscription_id and subscription_column:
        updates.append(f"{subscription_column} = %s")
        values.append(stripe_subscription_id)

    customer_column = _get_first_assinaturas_column(cur, ["stripe_customer_id", "stripe_customer"])
    if stripe_customer_id and customer_column:
        updates.append(f"{customer_column} = %s")
        values.append(stripe_customer_id)

    if data_inicio and _has_assinaturas_column(cur, "data_inicio"):
        updates.append("data_inicio = %s")
        values.append(data_inicio)

    if data_fim and _has_assinaturas_column(cur, "data_fim"):
        updates.append("data_fim = %s")
        values.append(data_fim)

    if not updates:
        return

    values.append(usuario_id)
    cur.execute(
        f"UPDATE assinaturas SET {', '.join(updates)} WHERE usuario_id = %s",
        tuple(values),
    )


@app.post("/api/stripe/checkout-session")
def criar_checkout_session(user: dict = Depends(obter_usuario_atual)):
    if not user:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe nao configurado")
    if not stripe_checkout or not getattr(stripe_checkout, "Session", None):
        raise HTTPException(status_code=500, detail="Stripe SDK sem suporte a checkout")

    usuario_id = user.get("user_id")
    email = user.get("email") if isinstance(user, dict) else None
    usuario_id = _parse_user_id(usuario_id)
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Usuario invalido")

    success_url = STRIPE_SUCCESS_URL
    sep = "&" if "?" in success_url else "?"
    success_url = f"{success_url}{sep}session_id={{CHECKOUT_SESSION_ID}}"

    try:
        session_params = {
            "mode": "subscription",
            "line_items": [{"price": STRIPE_PRICE_ID, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": STRIPE_CANCEL_URL,
            "client_reference_id": str(usuario_id),
            "subscription_data": {"metadata": {"user_id": str(usuario_id)}},
            "metadata": {"user_id": str(usuario_id), "email": email or ""}
        }
        if email:
            session_params["customer_email"] = email

        session = stripe_checkout.Session.create(**session_params)
    except Exception as e:
        print("❌ Erro no checkout Stripe:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar checkout: {str(e)}")

    return {"url": session.url}


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret nao configurado")

    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature") or request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Stripe-Signature ausente")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook invalido: {str(e)}")

    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})

    usuario_id = None
    plano = None
    status = None
    limite_buscas = None
    limite_embeddings = None
    stripe_subscription_id = None
    stripe_customer_id = None
    data_inicio = None
    data_fim = None

    if event_type == "checkout.session.completed":
        usuario_id = data_obj.get("client_reference_id") or data_obj.get("metadata", {}).get("user_id")
        usuario_id = _parse_user_id(usuario_id)
        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status("active")
        stripe_subscription_id = data_obj.get("subscription")
        stripe_customer_id = data_obj.get("customer")
        data_inicio = _now_utc()
    elif event_type in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        usuario_id = data_obj.get("metadata", {}).get("user_id")
        usuario_id = _parse_user_id(usuario_id)
        stripe_subscription_id = data_obj.get("id")
        stripe_customer_id = data_obj.get("customer")
        data_inicio = _from_unix_timestamp(data_obj.get("current_period_start"))
        data_fim = _from_unix_timestamp(data_obj.get("current_period_end"))
        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status(data_obj.get("status"))

    if not usuario_id and stripe_customer_id and event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                usuario_id = _find_usuario_id_by_stripe_customer(cur, stripe_customer_id)
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            conn.close()

        if usuario_id:
            plano, status, limite_buscas, limite_embeddings = _map_stripe_status(data_obj.get("status"))

    if usuario_id and plano and status:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                _upsert_assinatura(cur, usuario_id, plano, status, limite_buscas, limite_embeddings)
                _update_assinatura_extras(
                    cur,
                    usuario_id,
                    stripe_subscription_id=stripe_subscription_id,
                    stripe_customer_id=stripe_customer_id,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao atualizar assinatura: {str(e)}")
        finally:
            conn.close()

    return {"received": True}

@app.post("/api/auth/register", response_model=UserResponse)
def registrar_usuario(register_data: RegisterRequest):
    """Registrar novo usuário (email/senha)"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se email já existe
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (register_data.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email já cadastrado")
            
            # Criar hash da senha
            senha_hash = hash_senha(register_data.senha)
            
            # Criar usuário (verifica quais colunas existem)
            try:
                cur.execute("""
                    INSERT INTO usuarios (email, senha_hash, nome, metodo_auth, role)
                    VALUES (%s, %s, %s, 'email', 'user')
                    RETURNING id, email, nome, foto_url, metodo_auth, role
                """, (register_data.email, senha_hash, register_data.nome))
            except psycopg2.errors.UndefinedColumn:
                # Se colunas não existirem, criar sem elas
                cur.execute("""
                    INSERT INTO usuarios (email, senha_hash, nome)
                    VALUES (%s, %s, %s)
                    RETURNING id, email, nome
                """, (register_data.email, senha_hash, register_data.nome))
            
            usuario = cur.fetchone()
            usuario_id = usuario["id"]
            
            # Criar assinatura free com trial de 3 dias
            _insert_trial_assinatura(cur, usuario_id)
            
            conn.commit()
            
            # Gerar token (usar valores padrão se colunas não existirem)
            role = usuario.get("role", "user")
            token = criar_token_jwt(usuario_id, register_data.email, role)
            
            return UserResponse(
                id=usuario["id"],
                email=usuario["email"],
                nome=usuario.get("nome"),
                foto_url=usuario.get("foto_url"),
                metodo_auth=usuario.get("metodo_auth", "email"),
                role=role,
                token=token
            )
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erro ao registrar usuário: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao registrar usuário: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.post("/api/auth/login", response_model=UserResponse)
def login_usuario(login_data: LoginRequest):
    """Login com email e senha"""
    import sys
    sys.stdout.flush()
    print("=" * 80, flush=True)
    print("🔐 [LOGIN] Nova tentativa de login", flush=True)
    print(f"   Email: {login_data.email}", flush=True)
    print("=" * 80, flush=True)
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar usuário - verifica quais colunas existem dinamicamente
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' 
                AND column_name IN ('foto_url', 'metodo_auth', 'role', 'ativo')
            """)
            # RealDictCursor retorna dicionários, não tuplas
            colunas_existentes = {row['column_name'] for row in cur.fetchall()}
            
            # Montar SELECT baseado nas colunas que existem
            colunas_base = ['id', 'email', 'senha_hash', 'nome']
            if 'foto_url' in colunas_existentes:
                colunas_base.append('foto_url')
            if 'metodo_auth' in colunas_existentes:
                colunas_base.append('metodo_auth')
            if 'role' in colunas_existentes:
                colunas_base.append('role')
            if 'ativo' in colunas_existentes:
                colunas_base.append('ativo')
            
            query = f"SELECT {', '.join(colunas_base)} FROM usuarios WHERE email = %s"
            cur.execute(query, (login_data.email,))
            
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            if colunas_existentes and 'ativo' in colunas_existentes and not usuario.get("ativo", True):
                raise HTTPException(status_code=403, detail="Usuário inativo")
            
            # Verificar senha
            print(f"🔐 Tentando login para: {login_data.email}")
            print(f"   Usuário encontrado: ID {usuario['id']}")
            print(f"   Tem senha_hash: {bool(usuario.get('senha_hash'))}")
            
            if not usuario.get("senha_hash"):
                print("❌ Usuário não tem senha_hash!")
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            senha_valida = verificar_senha(login_data.senha, usuario["senha_hash"])
            print(f"   Senha válida: {senha_valida}")
            
            if not senha_valida:
                print(f"❌ Senha incorreta para {login_data.email}")
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            print(f"✅ Login bem-sucedido para {login_data.email}")
            
            # Validar dados antes de criar resposta
            usuario_id = usuario["id"]
            usuario_email = usuario["email"]
            usuario_nome = usuario.get("nome")
            usuario_foto_url = usuario.get("foto_url")
            usuario_metodo_auth = usuario.get("metodo_auth", "email")
            usuario_role = usuario.get("role", "user")
            
            print(f"   Dados do usuário: id={usuario_id}, email={usuario_email}, role={usuario_role}")
            
            # Gerar token
            try:
                token = criar_token_jwt(usuario_id, usuario_email, usuario_role)
                print(f"   ✅ Token gerado com sucesso")
            except Exception as e:
                print(f"   ❌ Erro ao gerar token: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Erro ao gerar token: {str(e)}")
            
            # Criar resposta
            try:
                response = UserResponse(
                    id=usuario_id,
                    email=usuario_email,
                    nome=usuario_nome,
                    foto_url=usuario_foto_url,
                    metodo_auth=usuario_metodo_auth,
                    role=usuario_role,
                    token=token
                )
                print(f"   ✅ UserResponse criado com sucesso")
                return response
            except Exception as e:
                print(f"   ❌ Erro ao criar UserResponse: {e}")
                print(f"   Dados: id={usuario_id}, email={usuario_email}, nome={usuario_nome}, foto_url={usuario_foto_url}, metodo_auth={usuario_metodo_auth}, role={usuario_role}, token_len={len(token) if token else 0}")
                import traceback
                traceback.print_exc()
                raise
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro no login: {e}")
        import traceback
        print("📋 Traceback completo:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao fazer login: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/auth/google/login")
def login_google_redirect():
    """Gerar URL de login do Google"""
    if not GOOGLE_CLIENT_ID:
        # Se não configurado, retornar erro amigável
        raise HTTPException(
            status_code=503, 
            detail="Login com Google não está configurado. Configure GOOGLE_CLIENT_ID no backend/.env"
        )
    
    # URL de autorização do Google (usa variável global)
    redirect_uri = GOOGLE_REDIRECT_URI
    scope = "openid email profile"
    
    # Codificar redirect_uri para URL (usar urlencode para query parameters)
    from urllib.parse import urlencode
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent"
    }
    query_string = urlencode(params)
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
    
    # Log para debug (remover em produção)
    print(f"🔍 Redirect URI sendo usado: {redirect_uri}")
    print(f"🔍 URL completa gerada: {google_auth_url}")
    
    return {"auth_url": google_auth_url}

@app.post("/api/auth/google/callback", response_model=UserResponse)
async def google_callback(auth_request: GoogleAuthRequest):
    """Processar callback do Google OAuth"""
    try:
        # Obter informações do usuário do Google
        google_info = await obter_info_google_por_code(
            auth_request.code, 
            auth_request.redirect_uri
        )
        
        if not google_info:
            raise HTTPException(status_code=401, detail="Falha ao autenticar com Google")
        
        google_id = google_info["google_id"]
        email = google_info["email"]
        nome = google_info.get("nome")
        foto_url = google_info.get("foto_url")
        
        # Buscar ou criar usuário no banco
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verificar se usuário já existe (por google_id ou email)
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE google_id = %s OR email = %s
                    LIMIT 1
                """, (google_id, email))
                
                usuario = cur.fetchone()
                
                if usuario:
                    # Usuário existe, atualizar dados
                    usuario_id = usuario["id"]
                    cur.execute("""
                        UPDATE usuarios 
                        SET google_id = %s, nome = COALESCE(%s, nome), 
                            foto_url = COALESCE(%s, foto_url),
                            metodo_auth = 'google',
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (google_id, nome, foto_url, usuario_id))
                    
                    # Criar assinatura free se não tiver
                    cur.execute("""
                        SELECT id FROM assinaturas 
                        WHERE usuario_id = %s AND status IN ('ativa', 'trial', 'active', 'trialing')
                    """, (usuario_id,))
                    if not cur.fetchone():
                        _insert_trial_assinatura(cur, usuario_id)
                else:
                    # Criar novo usuário
                    cur.execute("""
                        INSERT INTO usuarios (email, nome, foto_url, google_id, metodo_auth, senha_hash)
                        VALUES (%s, %s, %s, %s, 'google', NULL)
                        RETURNING id
                    """, (email, nome, foto_url, google_id))
                    
                    usuario_id = cur.fetchone()["id"]
                    
                    # Criar assinatura free para novo usuário
                    _insert_trial_assinatura(cur, usuario_id)
                
                conn.commit()
                
                # Buscar dados atualizados
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE id = %s
                """, (usuario_id,))
                usuario = cur.fetchone()
                
                # Buscar role do usuário
                cur.execute("SELECT role FROM usuarios WHERE id = %s", (usuario_id,))
                role = cur.fetchone()["role"] or "user"
                
                # Gerar token JWT
                token = criar_token_jwt(usuario_id, email, role)
                
                return UserResponse(
                    id=usuario["id"],
                    email=usuario["email"],
                    nome=usuario["nome"],
                    foto_url=usuario["foto_url"],
                    metodo_auth=usuario["metodo_auth"],
                    role=role,
                    token=token
                )
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Erro no callback Google: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar autenticação: {str(e)}")

@app.get("/api/auth/google/callback")
async def google_callback_get(code: str = Query(...), error: Optional[str] = Query(None)):
    """Processar callback do Google OAuth (GET) e redirecionar para frontend"""
    if error:
        # Se houver erro, redirecionar para frontend com erro
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error={error}")
    
    try:
        # Obter informações do usuário do Google (usa variável global)
        google_info = await obter_info_google_por_code(code, GOOGLE_REDIRECT_URI)
        
        if not google_info:
            return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error=authentication_failed")
        
        google_id = google_info["google_id"]
        email = google_info["email"]
        nome = google_info.get("nome")
        foto_url = google_info.get("foto_url")
        
        # Buscar ou criar usuário no banco
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verificar se usuário já existe (por google_id ou email)
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE google_id = %s OR email = %s
                    LIMIT 1
                """, (google_id, email))
                
                usuario = cur.fetchone()
                
                if usuario:
                    # Usuário existe, atualizar dados
                    usuario_id = usuario["id"]
                    cur.execute("""
                        UPDATE usuarios 
                        SET google_id = %s, nome = COALESCE(%s, nome), 
                            foto_url = COALESCE(%s, foto_url),
                            metodo_auth = 'google',
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (google_id, nome, foto_url, usuario_id))
                    
                    # Criar assinatura free se não tiver
                    cur.execute("""
                        SELECT id FROM assinaturas 
                        WHERE usuario_id = %s AND status IN ('ativa', 'trial', 'active', 'trialing')
                    """, (usuario_id,))
                    if not cur.fetchone():
                        _insert_trial_assinatura(cur, usuario_id)
                else:
                    # Criar novo usuário
                    cur.execute("""
                        INSERT INTO usuarios (email, nome, foto_url, google_id, metodo_auth, senha_hash)
                        VALUES (%s, %s, %s, %s, 'google', NULL)
                        RETURNING id
                    """, (email, nome, foto_url, google_id))
                    
                    usuario_id = cur.fetchone()["id"]
                    
                    # Criar assinatura free para novo usuário
                    _insert_trial_assinatura(cur, usuario_id)
                
                conn.commit()
                
                # Buscar dados atualizados
                cur.execute("""
                    SELECT id, email, nome, foto_url, metodo_auth 
                    FROM usuarios 
                    WHERE id = %s
                """, (usuario_id,))
                usuario = cur.fetchone()
                
                # Buscar role do usuário
                cur.execute("SELECT role FROM usuarios WHERE id = %s", (usuario_id,))
                role = cur.fetchone()["role"] or "user"
                
                # Gerar token JWT
                token = criar_token_jwt(usuario_id, email, role)
                
        finally:
            conn.close()
        
        # Redirecionar para frontend com token (usa variável global)
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?code={code}&token={token}")
        
    except Exception as e:
        print(f"Erro no callback Google (GET): {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/callback?error=server_error")

@app.get("/api/auth/google/debug")
def debug_google_oauth():
    """Endpoint de debug para verificar configuração do Google OAuth"""
    redirect_uri = GOOGLE_REDIRECT_URI
    from urllib.parse import quote
    redirect_uri_encoded = quote(redirect_uri, safe='')
    
    return {
        "redirect_uri": redirect_uri,
        "redirect_uri_encoded": redirect_uri_encoded,
        "client_id": GOOGLE_CLIENT_ID[:30] + "..." if GOOGLE_CLIENT_ID else "Não configurado",
        "instrucoes": {
            "1": "Acesse: https://console.cloud.google.com/",
            "2": "Vá em: APIs & Services > Credentials",
            "3": "Clique no OAuth 2.0 Client ID",
            "4": f"Em 'Authorized redirect URIs', adicione EXATAMENTE: {redirect_uri}",
            "5": "Clique em Save"
        }
    }

@app.get("/api/auth/me")
async def obter_usuario_logado(user: dict = Depends(obter_usuario_atual)):
    """Obter informações do usuário logado"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    u.id,
                    u.email,
                    u.nome,
                    u.foto_url,
                    u.metodo_auth,
                    u.role,
                    a.plano,
                    a.status,
                    a.limite_buscas,
                    a.limite_embeddings
                FROM usuarios u
                LEFT JOIN LATERAL (
                    SELECT plano, status, limite_buscas, limite_embeddings
                    FROM assinaturas
                    WHERE usuario_id = u.id
                    ORDER BY id DESC
                    LIMIT 1
                ) a ON true
                WHERE u.id = %s
            """, (user["user_id"],))
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            # Buscar assinatura completa para checar trial (3 dias)
            cur.execute("""
                SELECT * FROM assinaturas
                WHERE usuario_id = %s
                ORDER BY id DESC
                LIMIT 1
            """, (user["user_id"],))
            assinatura_row = cur.fetchone()

            response = dict(usuario)
            if assinatura_row:
                # Sobrescrever com valores mais recentes
                response["plano"] = assinatura_row.get("plano", response.get("plano"))
                response["status"] = assinatura_row.get("status", response.get("status"))
                response["limite_buscas"] = assinatura_row.get("limite_buscas", response.get("limite_buscas"))
                response["limite_embeddings"] = assinatura_row.get("limite_embeddings", response.get("limite_embeddings"))

                trial_expira = _trial_expira_em_from_row(assinatura_row)
                plano_atual = (response.get("plano") or "").lower()
                trial_ativo = plano_atual == "free" and trial_expira and not _is_expired(trial_expira)
                response["trial_expira_em"] = trial_expira.isoformat() if trial_expira else None
                response["trial_ativo"] = trial_ativo
            else:
                response["trial_expira_em"] = None
                response["trial_ativo"] = False

            return response
    finally:
        conn.close()

@app.post("/api/auth/alterar-senha")
async def alterar_senha(dados: AlterarSenhaRequest, user: dict = Depends(obter_usuario_atual)):
    """Alterar senha do usuário logado"""
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    if len(dados.nova_senha) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, email, senha_hash, metodo_auth
                FROM usuarios 
                WHERE id = %s
            """, (user["user_id"],))
            usuario = cur.fetchone()
            
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            if not usuario.get("senha_hash"):
                raise HTTPException(status_code=400, detail="Usuário não possui senha cadastrada (login apenas por Google)")
            
            if not verificar_senha(dados.senha_atual, usuario["senha_hash"]):
                raise HTTPException(status_code=401, detail="Senha atual incorreta")
            
            nova_senha_hash = hash_senha(dados.nova_senha)
            
            cur.execute("""
                UPDATE usuarios 
                SET senha_hash = %s
                WHERE id = %s
            """, (nova_senha_hash, user["user_id"]))
            
            conn.commit()
            return {"message": "Senha alterada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"Erro ao alterar senha: {e}")
        raise HTTPException(status_code=500, detail="Erro ao alterar senha")
    finally:
        conn.close()

@app.post("/api/acessos")
def registrar_acesso(acesso: AcessoCreate):
    """Registrar log de acesso com localização"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO acessos (
                    usuario_id, ip_address, user_agent, pais, cidade, regiao,
                    timezone, latitude, longitude, endpoint, metodo_http,
                    status_code, tempo_resposta_ms
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """, (
                acesso.usuario_id,
                acesso.ip_address,
                acesso.user_agent,
                acesso.pais,
                acesso.cidade,
                acesso.regiao,
                acesso.timezone,
                acesso.latitude,
                acesso.longitude,
                acesso.endpoint,
                acesso.metodo_http,
                acesso.status_code,
                acesso.tempo_resposta_ms
            ))
            acesso_id = cur.fetchone()[0]
            conn.commit()
            return {"id": acesso_id, "message": "Acesso registrado com sucesso"}
    except psycopg2.OperationalError:
        # Se tabela não existe ainda, não bloquear a aplicação
        if conn:
            conn.rollback()
        return {"message": "Tabela de acessos não encontrada (ignore se ainda não criou)"}
    except Exception as e:
        if conn:
            conn.rollback()
        # Não bloquear a aplicação se der erro ao registrar acesso
        print(f"⚠️ Erro ao registrar acesso (ignorado): {e}")
        return {"message": "Erro ao registrar acesso (ignorado)"}
    finally:
        if conn:
            conn.close()

@app.delete("/api/ideias/limpar")
def limpar_todas_ideias():
    """⚠️ LIMPAR TODAS AS IDEIAS - CUIDADO!"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE ideias RESTART IDENTITY CASCADE")
            conn.commit()
            return {"message": "Todas as ideias foram deletadas", "success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao limpar ideias: {str(e)}")
    finally:
        conn.close()

# =====================================================
# ENDPOINT: CONTATO (Fale Conosco)
# =====================================================

class ContatoCreate(BaseModel):
    nome: str
    email: str
    assunto: str
    mensagem: str
    email_destino: Optional[str] = None  # Será preenchido com CONTATO_EMAIL se não fornecido

class ContatoResponse(BaseModel):
    id: int
    message: str

async def obter_usuario_opcional(request: Request) -> Optional[dict]:
    """Extrair usuário do token JWT - Retorna None se não autenticado (para contato anônimo)"""
    try:
        authorization = request.headers.get("Authorization") or request.headers.get("authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return None
        
        token = authorization.replace("Bearer ", "").strip()
        if not token:
            return None
        
        user = verificar_token_jwt(token)
        return user if user else None
    except:
        return None

@app.post("/api/contato", response_model=ContatoResponse, status_code=201)
async def criar_contato(contato: ContatoCreate, request: Request):
    """Criar mensagem de contato (pode ser anônimo ou autenticado)"""
    print("=" * 80)
    print("📧 NOVA MENSAGEM DE CONTATO")
    print(f"   Nome: {contato.nome}")
    print(f"   Email: {contato.email}")
    print(f"   Assunto: {contato.assunto}")
    print("=" * 80)
    
    # Validar dados
    if not contato.nome.strip() or not contato.email.strip() or not contato.assunto.strip() or not contato.mensagem.strip():
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")
    
    # Tentar obter usuário (opcional)
    usuario_id = None
    try:
        user = await obter_usuario_opcional(request)
        if user:
            usuario_id = user.get("user_id")
            print(f"   ✅ Usuário autenticado: usuario_id={usuario_id}")
        else:
            print(f"   ℹ️  Mensagem anônima (sem autenticação)")
    except Exception as e:
        print(f"   ⚠️  Erro ao obter usuário (continuando como anônimo): {e}")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO contato (
                    usuario_id,
                    nome,
                    email,
                    assunto,
                    mensagem,
                    email_destino,
                    status,
                    criado_em
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                usuario_id,
                contato.nome.strip(),
                contato.email.strip(),
                contato.assunto.strip(),
                contato.mensagem.strip(),
                contato.email_destino or CONTATO_EMAIL,
                "pendente",
                datetime.now()
            ))
            
            resultado = cur.fetchone()
            contato_id = resultado["id"]
            conn.commit()
            
            print(f"✅ Mensagem de contato salva com sucesso: ID {contato_id}")
            print("=" * 80)
            
            return ContatoResponse(
                id=contato_id,
                message="Mensagem enviada com sucesso"
            )
            
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ ERRO ao criar contato: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Erro ao processar mensagem. Tente novamente mais tarde."
        )
    finally:
        if conn:
            conn.close()

# =====================================================
# ENDPOINT: SUGESTÕES DE LEMBRANÇA COM IA
# =====================================================
print("🔍 [DEBUG] Carregando módulo de lembranças...")

class LembrancaRequest(BaseModel):
    texto: str

class LembrancaResponse(BaseModel):
    sugestoes: List[str]

def get_chat_model():
    """Obter modelo de chat OpenAI para gerar sugestões"""
    if not OPENAI_API_KEY:
        return None
    try:
        return ChatOpenAI(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-4o-mini",
            temperature=0.7
        )
    except:
        return None

print("🔍 [DEBUG] Definindo endpoint GET /api/lembrancas/teste...")
@app.get("/api/lembrancas/teste")
async def teste_lembrancas():
    """Endpoint de teste para verificar se a rota está funcionando"""
    return {"status": "ok", "mensagem": "Endpoint de lembranças está funcionando"}

print("🔍 [DEBUG] Definindo endpoint POST /api/lembrancas/sugerir...")
@app.post("/api/lembrancas/sugerir", response_model=LembrancaResponse)
async def sugerir_lembranca(lembranca: LembrancaRequest, request: Request):
    """Gerar sugestões de lembrança usando IA baseado no texto descritivo"""
    print("=" * 80)
    print("💭 SUGESTÃO DE LEMBRANÇA - ENDPOINT CHAMADO!")
    print(f"   Texto recebido: {lembranca.texto[:100]}...")
    print("=" * 80)
    
    if not lembranca.texto.strip():
        return LembrancaResponse(sugestoes=[])
    
    modelo = get_chat_model()
    if not modelo:
        print("⚠️  OpenAI API Key não configurada")
        return LembrancaResponse(sugestoes=[])
    
    try:
        # Prompt para a IA gerar sugestões contextuais
        prompt = f"""Você é um assistente de memória. O usuário está tentando lembrar de algo e descreveu:

"{lembranca.texto}"

Com base nessa descrição, gere 3-5 sugestões curtas e específicas que possam ajudar a pessoa a lembrar. 
As sugestões devem ser:
- Curta (máximo 10 palavras)
- Específica e concreta
- Relacionada ao contexto descrito
- Em formato de pergunta ou afirmação curta

Exemplos de boas sugestões:
- "qual aquela fruta pequena roxa?"
- "a Torre Eiffel em Paris?"
- "o nome daquele restaurante italiano?"
- "aquela música que tocava na rádio?"

Retorne APENAS as sugestões, uma por linha, sem numeração ou marcadores."""

        resposta = modelo.invoke(prompt)
        print(f"📝 Resposta bruta da IA: {resposta.content[:200]}...")
        
        sugestoes_texto = resposta.content.strip()
        
        # Separar sugestões por linha e limpar
        sugestoes = [
            s.strip() 
            for s in sugestoes_texto.split('\n') 
            if s.strip() and not s.strip().startswith(('1.', '2.', '3.', '4.', '5.', '-', '*', '•'))
        ]
        
        # Limitar a 5 sugestões
        sugestoes = sugestoes[:5]
        
        print(f"✅ {len(sugestoes)} sugestões geradas")
        for i, sug in enumerate(sugestoes, 1):
            print(f"   {i}. {sug}")
        print("=" * 80)
        
        if not sugestoes:
            print("⚠️  Nenhuma sugestão foi gerada, retornando lista vazia")
        
        return LembrancaResponse(sugestoes=sugestoes)
        
    except Exception as e:
        print(f"❌ Erro ao gerar sugestões: {e}")
        import traceback
        traceback.print_exc()
        # Retornar lista vazia em caso de erro
        return LembrancaResponse(sugestoes=[])

if __name__ == "__main__":
    import uvicorn
    PORT = 8002  # Mudar para 8002 se 8001 estiver ocupada
    print(f"🚀 Servidor rodando na porta {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
