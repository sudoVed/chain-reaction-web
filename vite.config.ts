import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          onnx: ['onnxruntime-web'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
