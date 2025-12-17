// Simple build script to create a CodeMirror 6 bundle
// Run with: node build-codemirror.js

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['codemirror-bundle-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'CM6',
  outfile: 'frontend/static/codemirror6.bundle.js',
  minify: true,
  sourcemap: true,
  external: []
});

console.log('CodeMirror 6 bundle created successfully!');
