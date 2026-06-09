import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/search': 'http://localhost:3000',
      '/suggest': 'http://localhost:3000',
      '/document': 'http://localhost:3000',
      '/stats': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
    }
  }
})
