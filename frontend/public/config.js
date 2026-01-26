// Configuração da API
// Este arquivo será carregado antes do React e permite configurar a URL da API dinamicamente
// Ajuste a URL abaixo para apontar para o seu backend em produção

// Se window.API_URL não estiver definido, o código usará VITE_API_URL ou localhost:8002 como fallback
// Para produção, defina a URL do seu backend aqui:
window.API_URL = window.API_URL || 'https://sacola-ideias.onrender.com/api';

// Exemplo para produção (descomente e ajuste):
// window.API_URL = 'https://seu-backend.onrender.com/api';
// ou
// window.API_URL = 'https://api.seusite.com.br/api';

