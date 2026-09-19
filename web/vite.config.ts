import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Relative base for standalone local opening or GitHub pages
  server: {
    port: 5173,
    open: false
  }
});
