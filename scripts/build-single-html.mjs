// Crea un único archivo HTML con toda la app (lo usa Claude para publicar la vista previa).
// No es necesario para Vercel ni Netlify: allí se usa "npm run build".
// Uso: node scripts/build-single-html.mjs

import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  write: false,
  outdir: 'dist-single',
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logOverride: { 'empty-import-meta': 'silent' },
  nodePaths: process.env.EXTRA_NODE_PATH ? [process.env.EXTRA_NODE_PATH] : [],
});

let js = '';
let css = '';
for (const file of result.outputFiles) {
  if (file.path.endsWith('.js')) js = file.text;
  if (file.path.endsWith('.css')) css = file.text;
}

const template = readFileSync('index.html', 'utf8');
const html = template
  .replace('<script type="module" src="/src/main.tsx"></script>', () => '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace('</head>', () => '<style>' + css + '</style>\n  </head>');

mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/nebula.html', html);
console.log('dist-single/nebula.html', Math.round(html.length / 1024) + ' KB');
