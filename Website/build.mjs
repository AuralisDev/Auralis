import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const check = process.argv.includes('--check');
const ignored = new Set(['dist', 'node_modules', '.git', '.github', 'scripts', 'README.md', 'package.json', 'build.mjs']);

function copyDir(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (!check) fs.mkdirSync(to, { recursive: true });
      copyDir(from, to);
    } else if (!check) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

if (check) {
  // Lightweight static checks are performed by the repository checker; this command validates the tree only.
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('index.html is missing.');
  if (!fs.existsSync(path.join(root, 'dashboard', 'index.html'))) throw new Error('dashboard/index.html is missing.');
  console.log('[Auralis Website] check passed');
} else {
  if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  copyDir(root, dist);
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
  console.log(`[Auralis Website] built to ${dist}`);
}
