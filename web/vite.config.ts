import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// DEMO=1 : build statique autonome (GitHub Pages) publié dans ../docs.
const demo = process.env.DEMO === '1';

export default defineConfig({
  plugins: [react()],
  base: demo ? './' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { outDir: demo ? '../docs' : 'dist', emptyOutDir: true },
});
