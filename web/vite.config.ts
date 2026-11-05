/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { datosLocales } from './servidor/plugin-datos.ts';

export default defineConfig({
  plugins: [datosLocales()],
  server: {
    host: 'localhost', // solo accesible desde esta PC
    port: 5180,
    strictPort: true,
    fs: { allow: ['..'] }, // permite importar ../esquema/
  },
  preview: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
});
