// Carregado antes do React para definir a URL da API.
(() => {
  const host = (window.location.hostname || '').toLowerCase();
  const localHosts = new Set(['localhost', '127.0.0.1']);
  const hostgatorHosts = new Set(['sacola-ideias.com', 'www.sacola-ideias.com']);
  const localApiUrl = 'http://localhost:8002/api';
  const productionApiUrl = 'https://sacola-ideias-api.onrender.com/api';

  const defaultUrl = localHosts.has(host)
    ? localApiUrl
    : hostgatorHosts.has(host)
      ? productionApiUrl
      : productionApiUrl;

  window.API_URL = window.API_URL || defaultUrl;
})();
