import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true // Lejon kërkesat nga localtunnel / ngrok
  },
  build: {
    chunkSizeWarningLimit: 1600, // Rrit limitin për të hequr paralajmërimin e 500kB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/jszip')) return 'excel';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/victory')) return 'charts';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react';
        }
      }
    }
  }
});