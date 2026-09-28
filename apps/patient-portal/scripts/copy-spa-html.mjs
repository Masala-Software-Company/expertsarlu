import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const portal = path.join(root, '..');
const src = path.join(portal, 'dist', 'index.html');
const dest = path.join(portal, 'api', '_spa.html');

if (!fs.existsSync(src)) {
  console.error('[copy-spa-html] dist/index.html missing — build Vite first');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('[copy-spa-html] api/_spa.html updated');
