// Configuração da API
// Este arquivo será carregado antes do React e permite configurar a URL da API dinamicamente
// Ajuste a URL abaixo para apontar para o seu backend em produção

// Se window.API_URL não estiver definido, usa local em dev e produção em prod
// Para produção, defina a URL do seu backend aqui:
(() => {
  const host = window.location.hostname || '';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const defaultUrl = isLocal
    ? 'http://localhost:8002/api'
    : 'https://sacola-ideias.onrender.com/api';
  window.API_URL = window.API_URL || defaultUrl;
})();

// Exemplo para produção (descomente e ajuste):
// window.API_URL = 'https://seu-backend.onrender.com/api';
// ou
// window.API_URL = 'https://api.seusite.com.br/api';
