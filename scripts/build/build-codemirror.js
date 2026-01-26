// Simple build script to create a CodeMirror 6 bundle
// Run with: node build-codemirror.js

import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(__dirname, 'codemirror-bundle-entry.js');
const outFile = path.resolve(__dirname, '../../frontend/codemirror6.bundle.js');

await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'iife',
  globalName: 'CM6',
  outfile: outFile,
  minify: true,
  sourcemap: true,
  external: []
});

console.log('CodeMirror 6 bundle created successfully!');
