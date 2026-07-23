import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [react()],
      root: 'demo',
    };
  }

  return {
    plugins: [react()],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'TeemEditor',
        formats: ['es', 'cjs'],
        fileName: (format) =>
          format === 'es' ? 'teem-editor.js' : 'teem-editor.cjs',
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime', 'dompurify'],
        output: {
          exports: 'named',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            dompurify: 'DOMPurify',
          },
          assetFileNames: 'teem-editor.[ext]',
        },
      },
      cssCodeSplit: false,
      sourcemap: true,
      emptyOutDir: true,
    },
  };
});
