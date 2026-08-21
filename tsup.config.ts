import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', client: 'src/client.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', 'react', 'react-dom'],
  target: 'es2020',
  sourcemap: true,
  minify: true,
  splitting: false
})