/**
 * Copies the build output to the repository root, which is what GitHub Pages
 * serves from this branch. Kept explicit rather than pointing Vite's outDir at
 * '..' — emptyOutDir on the repo root would delete the source it was built from.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const root = path.join(here, '..', '..');

// The vanilla app's files, removed only at cutover so the two never half-mix.
const LEGACY = ['app.js', 'styles.css', 'icons.js', 'sync.js', 'firebase-config.js'];

if (!fs.existsSync(dist)) {
  console.error('No dist/ — run `npm run build` first.');
  process.exit(1);
}

for (const name of LEGACY) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) { fs.rmSync(p); console.log('removed legacy', name); }
}

for (const entry of fs.readdirSync(dist)) {
  const from = path.join(dist, entry);
  const to = path.join(root, entry);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log('deployed', entry);
}
console.log('\nDone. Commit the repo root and push to publish.');
