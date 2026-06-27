import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [],
  resolve: {
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          onnx: ['onnxruntime-web/wasm'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
