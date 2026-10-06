// Production build: one self-contained ESM file per entrypoint, so workspace packages
// (which export TypeScript source) never need their own build step.
import { build } from 'esbuild';
import { cpSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    server: 'src/server.ts',
    migrate: 'src/scripts/migrate.ts',
    seed: 'src/scripts/seed.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // pg optionally requires the native binding; we never use it.
  external: ['pg-native'],
  // Some bundled CJS deps (pg) call require(); give ESM output a real require.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});

// SQL migrations travel with the build; scripts/migrate.ts resolves them next to itself.
cpSync('../../packages/db/drizzle', 'dist/drizzle', { recursive: true });
