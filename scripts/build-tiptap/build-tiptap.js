// Build script to create a Tiptap bundle for Granite
// Following the pattern from build-codemirror.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['tiptap-bundle-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'TiptapBundle',
  outfile: '../../frontend/static/tiptap.bundle.js',
  minify: true,
  sourcemap: true,
  external: []
});

console.log('Tiptap bundle created successfully!');
