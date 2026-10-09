import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The page registers the worker itself (lib/pwa.ts), so index.html stays free of injected scripts under the CSP.
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        name: 'Sentinel',
        short_name: 'Sentinel',
        description: 'Report and follow incidents on your sites.',
        // "/" sends each person to their own home (HomeRedirect).
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F7F7F8',
        theme_color: '#111114',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // A custom worker: the generated one cannot handle push events.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], rollupFormat: 'iife' },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:4000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
        },
      },
    },
  },
});
