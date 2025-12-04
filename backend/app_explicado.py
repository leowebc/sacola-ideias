"""
Versão comentada e explicativa do backend/app.py
Use este arquivo para aprender como funciona a IA!
"""

# ============================================
# PARTE 1: CONFIGURAÇÃO DO MODELO DE EMBEDDINGS
# ============================================

from langchain_openai import OpenAIEmbeddings

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
embeddings_model = None  # Variável global para armazenar o modelo (singleton)

def get_embeddings_model():
    """
    Obtém o modelo de embeddings (padrão Singleton).
    
    Singleton = cria uma vez e reutiliza (economiza memória e tempo).
    
    Por que Singleton?
    - Criar o modelo é caro (precisa carregar na memória)
    - Não precisa criar toda vez que chamar
    - Reutiliza o mesmo modelo para todas as requisições
    """
    global embeddings_model
    
    # Se ainda não criou e tem API Key, cria agora
    if embeddings_model is None and OPENAI_API_KEY:
        # AQUI ESTÁ A MÁGICA! Cria o modelo da OpenAI
        embeddings_model = OpenAIEmbeddings(
            openai_api_key=OPENAI_API_KEY,  # Sua chave da OpenAI (do .env)
            model="text-embedding-3-small"   # Modelo: pequeno = rápido e barato
            # Outros modelos disponíveis:
            # - "text-embedding-3-large" (mais preciso, mais caro)
            # - "text-embedding-ada-002" (antigo, ainda funciona)
        )
    
    return embeddings_model  # Retorna o modelo (criado ou já existente)


def gerar_embedding(texto: str):
    """
    Transforma um texto em um vetor de números (embedding).
    
    O que acontece:
    1. Pega o texto: "comprar leite"
    2. Envia para a API da OpenAI
    3. OpenAI usa uma rede neural (treinada em milhões de textos)
    4. A rede "entende" o significado do texto
    5. Transforma em 1536 números que representam esse significado
    6. Retorna: [0.023, -0.045, 0.123, ..., 0.089]
    
    Cada número no vetor captura algum aspecto do texto:
    - Alguns números = tópico (compras, trabalho, etc)
    - Alguns números = sentimento (positivo, negativo)
    - Alguns números = contexto (formal, informal)
    - etc...
    
    Por que 1536 números?
    - É o tamanho fixo do modelo text-embedding-3-small
    - Mais números = mais informação capturada
    - Mas também = mais caro e mais lento
    """
    # Passo 1: Pegar o modelo (ou criar se for primeira vez)
    model = get_embeddings_model()
    
    # Passo 2: Se não tiver modelo (sem API Key), retorna None
    if not model:
        return None
    
    try:
        # Passo 3: AQUI ACONTECE A MÁGICA!
        # embed_query() = método que transforma texto em números
        embedding = model.embed_query(texto)
        
        # embedding agora é uma lista com 1536 números:
        # [0.023, -0.045, 0.123, 0.456, ..., 0.089]
        
        # OPÇÃO: Descomente para ver os embeddings sendo gerados:
        # print(f"🔍 Texto: '{texto}'")
        # print(f"📊 Embedding: {embedding[:5]}... (1536 números no total)")
        
        return embedding
    except Exception as e:
        print(f"❌ Erro ao gerar embedding: {e}")
        return None


# ============================================
# PARTE 2: SALVAR IDEIA COM EMBEDDING
# ============================================

@app.post("/api/ideias")
def criar_ideia(ideia: IdeiaCreate):
    """
    Salva uma ideia e gera seu embedding automaticamente.
    
    Fluxo:
    1. Recebe título, tag e ideia
    2. Junta tudo em um texto
    3. Gera embedding (1536 números)
    4. Salva no banco: texto + números
    """
    conn = get_db_connection()
    try:
        embedding_str = None  # Vai armazenar embedding como string
        
        # Passo 1: Pegar modelo (se tiver API Key configurada)
        modelo = get_embeddings_model()
        
        if modelo:
            try:
                # Passo 2: Juntar tudo em um texto
                texto_completo = f"{ideia.titulo} {ideia.tag or ''} {ideia.ideia}".strip()
                # Exemplo: "Comprar leite trabalho lembretes do mercado"
                
                # Passo 3: GERAR EMBEDDING (TEXTO → NÚMEROS)
                embedding = gerar_embedding(texto_completo)
                # embedding = [0.023, -0.045, ..., 0.089] (1536 números)
                
                if embedding:
                    # Passo 4: Converter lista Python para string SQL
                    # PostgreSQL precisa receber como string formatada
                    embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                    # Resultado: "[0.023,-0.045,0.123,...,0.089]"
                    
            except Exception as e:
                print(f"⚠️  Erro ao gerar embedding (salvando sem embedding): {e}")
                # Se der erro, continua salvando sem embedding
                # A busca simples ainda vai funcionar
        
        # Passo 5: Salvar no banco
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if embedding_str:
                # Salvar COM embedding (pode fazer busca semântica depois)
                cur.execute(
                    "INSERT INTO ideias (titulo, tag, ideia, embedding) VALUES (%s, %s, %s, %s::vector) RETURNING *",
                    (ideia.titulo, ideia.tag, ideia.ideia, embedding_str)
                    # %s::vector = converte string para tipo vector do PostgreSQL
                )
            else:
                # Salvar SEM embedding (só busca simples funciona)
                cur.execute(
                    "INSERT INTO ideias (titulo, tag, ideia) VALUES (%s, %s, %s) RETURNING *",
                    (ideia.titulo, ideia.tag, ideia.ideia)
                )
            
            nova_ideia = cur.fetchone()
            conn.commit()
            return dict(nova_ideia)


# ============================================
# PARTE 3: BUSCA POR SIMILARIDADE (A MÁGICA!)
# ============================================

@app.post("/api/ideias/buscar")
def buscar_por_similaridade(busca: BuscaRequest):
    """
    Busca ideias usando similaridade semântica (IA).
    
    Como funciona:
    1. Recebe termo de busca: "compras"
    2. Gera embedding da busca: [0.021, -0.043, ..., 0.087]
    3. Compara com todos embeddings salvos
    4. Calcula similaridade (0.0 a 1.0)
    5. Filtra e ordena por similaridade
    6. Retorna resultados com porcentagem
    """
    conn = get_db_connection()
    try:
        # Passo 1: Verificar se tem modelo (API Key configurada)
        modelo = get_embeddings_model()
        
        if not modelo:
            # FALLBACK: Se não tiver API Key, faz busca simples (texto)
            # Busca usando LIKE (contém o texto)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                termo = busca.termo.lower()
                cur.execute("""
                    SELECT *, 0.0 AS similarity
                    FROM ideias
                    WHERE LOWER(titulo) LIKE %s 
                       OR LOWER(tag) LIKE %s 
                       OR LOWER(ideia) LIKE %s
                    ORDER BY data DESC
                    LIMIT 20
                """, (f'%{termo}%', f'%{termo}%', f'%{termo}%'))
                return [dict(r) for r in cur.fetchall()]
        
        # Passo 2: GERAR EMBEDDING DA BUSCA
        # Usuário busca "compras" → vira [0.021, -0.043, ..., 0.087]
        embedding_busca = gerar_embedding(busca.termo)
        
        if not embedding_busca:
            raise HTTPException(status_code=500, detail="Erro ao gerar embedding da busca")
        
        # Passo 3: Converter para formato PostgreSQL
        embedding_str = "[" + ",".join(map(str, embedding_busca)) + "]"
        # Resultado: "[0.021,-0.043,0.123,...,0.087]"
        
        # Passo 4: BUSCAR NO BANCO USANDO pgvector
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    titulo,
                    tag,
                    ideia,
                    data,
                    -- CALCULAR SIMILARIDADE:
                    -- <=> = operador de distância do pgvector
                    -- Calcula quão "perto" estão dois vetores
                    -- Menor distância = mais similares
                    --
                    -- 1 - distância = converte distância em similaridade
                    -- Distância 0.0 (idênticos) → Similaridade 1.0 (100%)
                    -- Distância 1.0 (muito diferentes) → Similaridade 0.0 (0%)
                    1 - (embedding <=> %s::vector) AS similarity
                    
                FROM ideias
                
                -- Só busca ideias que têm embedding (foram salvas com IA)
                WHERE embedding IS NOT NULL
                
                -- FILTRAR: Só mostra resultados com 30%+ de similaridade
                -- Ajuste este valor:
                -- 0.2 = permissivo (mostra mais resultados)
                -- 0.3 = padrão (equilíbrio)
                -- 0.5 = rigoroso (só muito similares)
                -- 0.7 = muito rigoroso (quase idênticos)
                AND (1 - (embedding <=> %s::vector)) >= 0.3
                
                -- ORDENAR: Do mais similar ao menos similar
                -- embedding <=> busca = distância
                -- Menor distância = mais similar = aparece primeiro
                ORDER BY embedding <=> %s::vector
                
                -- LIMITAR: Máximo 20 resultados
                LIMIT 20
            """, (embedding_str, embedding_str, embedding_str))
            # Nota: passa embedding_str 3 vezes (uma para cada %s)
            # Porque usa 3 vezes na query: SELECT, WHERE, ORDER BY
            
            resultados = cur.fetchall()
            return [dict(resultado) for resultado in resultados]
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na busca: {str(e)}")
    finally:
        conn.close()


# ============================================
# RESUMO: COMO FUNCIONA A MÁGICA
# ============================================

"""
FLUXO COMPLETO:

SALVAR:
Texto → Embedding (1536 números) → Salva no banco

BUSCAR:
Termo → Embedding (1536 números) → Compara com todos → Retorna similares

POR QUE FUNCIONA:
- Textos similares geram vetores similares
- Comparar números é mais fácil que comparar textos
- Similaridade de cosseno mede "quão parecidos" são os vetores

EXEMPLO:
"comprar leite" e "ir às compras" têm vetores parecidos
"comprar leite" e "reunião de trabalho" têm vetores diferentes
"""

