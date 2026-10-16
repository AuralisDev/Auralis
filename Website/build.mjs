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

const requiredFiles = [
  'index.html', 'commands.html', 'features.html', 'faq.html', 'status.html', '404.html',
  'config.js', 'app.js', 'styles.css', 'setup.html', 'data/commands.json', 'data/servers.json',
  'docs/index.html', 'dashboard/index.html', 'assets/auralis-logo.png'
];

function verifySiteTree(treeRoot) {
  const missing = requiredFiles.filter(file => !fs.existsSync(path.join(treeRoot, file)));
  if (missing.length) throw new Error(`Website is missing required files: ${missing.join(', ')}`);
  // Verify every local href/src in HTML so a typo cannot silently ship a broken page.
  const htmlFiles = [];
  function collectHtml(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['dist', 'node_modules', '.git'].includes(item.name)) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) collectHtml(full);
      else if (item.isFile() && item.name.toLowerCase().endsWith('.html')) htmlFiles.push(full);
    }
  }
  collectHtml(treeRoot);
  const broken = [];
  for (const htmlFile of htmlFiles) {
    const source = fs.readFileSync(htmlFile, 'utf8');
    const refs = source.matchAll(/(?:href|src)=["']([^"']+)["']/gi);
    for (const match of refs) {
      const raw = match[1].trim();
      if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw)) continue;
      const pathname = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
      if (!pathname) continue;
      let target;
      if (pathname.startsWith('/Auralis/')) target = path.resolve(treeRoot, pathname.slice('/Auralis/'.length));
      else if (pathname.startsWith('/')) { broken.push(`${path.relative(treeRoot, htmlFile)} -> ${raw} (root-absolute URL is not compatible with the /Auralis/ project path)`); continue; }
      else target = path.resolve(path.dirname(htmlFile), pathname);
      if (!fs.existsSync(target)) broken.push(`${path.relative(treeRoot, htmlFile)} -> ${raw}`);
    }
  }
  if (broken.length) throw new Error(`Broken local HTML links:\n${broken.join('\n')}`);
  return htmlFiles.length;
}

if (check) {
  const htmlCount = verifySiteTree(root);
  console.log(`[Auralis Website] check passed (${htmlCount} HTML pages; required pages and local links verified)`);
} else {
  if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  copyDir(root, dist);
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
  verifySiteTree(dist);
  console.log(`[Auralis Website] built and verified to ${dist}`);
}
