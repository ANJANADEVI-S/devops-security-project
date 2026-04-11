import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy to backend — avoids CORS issues during local development.
// In production, Nginx/Docker handles routing instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      // All /api/* calls → Flask backend
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Prometheus metrics endpoint (optional direct access)
      '/metrics': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
