import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // allowedHosts : autorise l'adresse fournie par GitHub Codespaces (*.app.github.dev)
  server: { host: true, allowedHosts: ['.app.github.dev'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 8000 },
})
