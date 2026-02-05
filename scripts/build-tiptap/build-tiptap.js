// Build script to create a Tiptap bundle for Granite
// Following the pattern from build-codemirror.js
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(__dirname, 'tiptap-bundle-entry.js');
const outFile = path.resolve(__dirname, '../../frontend/tiptap.bundle.js');

await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'iife',
  globalName: 'TiptapBundle',
  outfile: outFile,
  minify: true,
  sourcemap: true,
  external: []
});

console.log('Tiptap bundle created successfully!');
