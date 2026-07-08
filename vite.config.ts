import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      clearScreen: false,
      envPrefix: ['VITE_', 'TAURI_'],
      server: {
        port: 3050,
        strictPort: true,
        host: '0.0.0.0',
        watch: {
          ignored: ['**/src-tauri/**'],
        },
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
