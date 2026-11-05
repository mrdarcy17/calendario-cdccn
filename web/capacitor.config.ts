import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.mrdarcy17.cdccn',
  appName: 'Sarger',
  webDir: 'dist',
  backgroundColor: '#0e0e0f',
  plugins: {
    SystemBars: {
      // Íconos claros en las barras del sistema, sobre el fondo oscuro de la app.
      style: 'DARK',
      // La app ocupa toda la pantalla y recibe --safe-area-inset-* para dejar margen.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
