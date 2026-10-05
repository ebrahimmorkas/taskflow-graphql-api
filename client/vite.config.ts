import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3001';

// Queries, mutations and the graphql-ws subscription socket share one endpoint,
// proxied in development so the browser only talks to the Vite origin.
const proxy = {
  '/graphql': { target: API_TARGET, ws: true },
  '/health': API_TARGET,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5176, proxy },
  preview: { port: 4176, proxy },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\/](react|react-dom|scheduler|react-router)[\/]/,
            },
            {
              name: 'data',
              test: /node_modules[\/](@tanstack|zod|react-hook-form|@hookform)[\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
