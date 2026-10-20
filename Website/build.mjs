import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const check = process.argv.includes('--check');
const ignored = new Set(['dist', 'node_modules', '.git', '.github', 'DiscordBot', 'Website', 'scripts', '.gitignore', '.env', '.env.example', 'README.md', 'package.json', 'package-lock.json', 'build.mjs']);


async function syncPublicServers() {
  const apiBase = String(process.env.AURALIS_API_BASE || '').trim().replace(/\/$/, '');
  const dataFile = path.join(root, 'data', 'servers.json');
  const warn = message => {
    console.warn(`[Auralis server sync] ${message}`);
    console.warn('[Auralis server sync] Existing data/servers.json will be kept.');
  };
  if (!apiBase) {
    warn('AURALIS_API_BASE is empty; using the last saved server directory.');
    return;
  }
  let response;
  try {
    response = await fetch(`${apiBase}/public/api/servers`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  } catch (error) {
    warn(`Could not reach ${apiBase}/public/api/servers (${error?.message || 'network error'}).`);
    return;
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const body = await response.text();
  if (!response.ok) {
    warn(`Backend returned HTTP ${response.status} (${contentType || 'unknown content type'}).`);
    return;
  }
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    warn(`Expected JSON from ${apiBase}/public/api/servers but received ${contentType || 'no content type'}.`);
    return;
  }
  let payload;
  try { payload = JSON.parse(body); }
  catch { warn('The public server API returned invalid JSON.'); return; }
  if (!Array.isArray(payload?.servers)) {
    warn('The API response did not contain a servers array.');
    return;
  }
  await fs.promises.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.promises.writeFile(dataFile, `${JSON.stringify({ servers: payload.servers, generatedAt: payload.generatedAt || new Date().toISOString() }, null, 2)}\n`);
  console.log(`[Auralis server sync] Updated ${payload.servers.length} public server entries.`);
}

function copyDir(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignored.has(entry.name) || /^README(?:\..*)?$/i.test(entry.name) || /\.md$/i.test(entry.name)) continue;
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
  'docs/index.html', 'dashboard/index.html', 'dashboard/panels.html', 'dashboard/settings.html', 'dashboard/applications.html', 'dashboard/logs.html', 'dashboard/admin.html', 'dashboard/brand.html', 'dashboard/automations.html', 'dashboard/preferences.html', 'dashboard/misc.html', 'dashboard/custom-commands.html', 'dashboard/embeds.html', 'dashboard/privacy.html', 'dashboard/responses.html', 'assets/auralis-logo.png'
];

function verifySiteTree(treeRoot) {
  const missing = requiredFiles.filter(file => !fs.existsSync(path.join(treeRoot, file)));
  if (missing.length) throw new Error(`Website is missing required files: ${missing.join(', ')}`);
  const htmlFiles = [];
  function collectHtml(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['dist', 'node_modules', '.git', '.github', 'DiscordBot', 'Website'].includes(item.name)) continue;
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

if (!check) await syncPublicServers();

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
