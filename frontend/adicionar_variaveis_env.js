#!/usr/bin/env node
/**
 * Script para adicionar variáveis de ambiente ao arquivo .env.local
 * Execute: node adicionar_variaveis_env.js
 */

const fs = require('fs');
const path = require('path');

// Variáveis que precisam ser adicionadas/atualizadas
const VARIAVEIS_NOVAS = {
  "VITE_API_URL": "http://localhost:8002/api",
  "VITE_CONTATO_EMAIL": "contato@sacoladeideias.com"
};

function adicionarVariaveis() {
  const envFile = path.join(__dirname, '.env.local');
  
  let linhas = [];
  let variaveisExistentes = {};
  
  // Ler arquivo se existir
  if (fs.existsSync(envFile)) {
    const conteudo = fs.readFileSync(envFile, 'utf-8');
    linhas = conteudo.split('\n');
    
    // Verificar quais variáveis já existem
    linhas.forEach(linha => {
      const linhaLimpa = linha.trim();
      if (linhaLimpa && !linhaLimpa.startsWith('#') && linhaLimpa.includes('=')) {
        const [chave, ...valorParts] = linhaLimpa.split('=');
        const valor = valorParts.join('=').trim();
        variaveisExistentes[chave.trim()] = valor;
      }
    });
  }
  
  // Adicionar novas variáveis que não existem
  const variaveisAdicionadas = [];
  
  Object.entries(VARIAVEIS_NOVAS).forEach(([chave, valorPadrao]) => {
    if (!variaveisExistentes[chave]) {
      linhas.push(`${chave}=${valorPadrao}`);
      variaveisAdicionadas.push(chave);
    } else {
      console.log(`ℹ️  ${chave} já existe com valor: ${variaveisExistentes[chave]}`);
    }
  });
  
  // Escrever arquivo atualizado
  if (variaveisAdicionadas.length > 0) {
    // Adicionar comentário se arquivo estava vazio
    if (linhas.length === variaveisAdicionadas.length) {
      linhas.unshift(
        '# =====================================================',
        '# CONFIGURAÇÕES DO FRONTEND',
        '# =====================================================',
        ''
      );
    }
    
    fs.writeFileSync(envFile, linhas.join('\n') + '\n', 'utf-8');
    
    console.log('='.repeat(60));
    console.log('✅ Variáveis adicionadas ao .env.local:');
    variaveisAdicionadas.forEach(chave => {
      console.log(`   ✅ ${chave}=${VARIAVEIS_NOVAS[chave]}`);
    });
    console.log('='.repeat(60));
    console.log(`\n📝 Arquivo .env.local atualizado com sucesso!`);
  } else {
    console.log('ℹ️  Todas as variáveis já existem no arquivo .env.local');
  }
}

console.log('🔧 Adicionando variáveis de ambiente ao .env.local...');
console.log();
adicionarVariaveis();

