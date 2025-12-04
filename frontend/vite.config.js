import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Garantir que arquivos da pasta public sejam copiados
    copyPublicDir: true,
  },
  // Configuração para desenvolvimento
  server: {
    port: 5173,
    open: true
  }
})

