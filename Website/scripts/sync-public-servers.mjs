import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(websiteRoot, 'data', 'servers.json');
const apiBase = String(process.env.AURALIS_API_BASE || '').trim().replace(/\/$/, '');

function warn(message) {
  console.warn(`[Auralis server sync] WARNING: ${message}`);
  console.warn('[Auralis server sync] Keeping the existing Website/data/servers.json and continuing the static website deployment.');
}

async function main() {
  if (!apiBase) {
    warn('AURALIS_API_BASE is empty. Add the public HTTPS base URL as a GitHub Actions repository variable to enable live sync.');
    return;
  }

  let response;
  try {
    response = await fetch(`${apiBase}/public/api/servers`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    warn(`Could not reach ${apiBase}/public/api/servers (${error?.message || 'network error'}). Check that the backend is online and WispByte forwards to the app port.`);
    return;
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const body = await response.text();
  if (!response.ok) {
    warn(`Backend returned HTTP ${response.status} (${contentType || 'unknown content type'}).`);
    return;
  }

  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    const preview = body.replace(/\s+/g, ' ').slice(0, 180);
    warn(`Expected JSON from ${apiBase}/public/api/servers but received '${contentType || 'no content type'}'. Response begins: ${preview || '(empty response)'}. If this is a WispByte “Web server isn't running” page, set the WispByte PORT environment variable to the port assigned to the subdomain and ensure the app listens on 0.0.0.0.`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    warn(`Backend advertised JSON but returned invalid JSON from ${apiBase}/public/api/servers.`);
    return;
  }

  if (!Array.isArray(payload?.servers)) {
    warn('Backend JSON did not contain a `servers` array. The response was not written to the static fallback.');
    return;
  }

  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify({
    servers: payload.servers,
    generatedAt: payload.generatedAt || new Date().toISOString()
  }, null, 2) + '\n');
  console.log(`[Auralis server sync] Synced ${payload.servers.length} public server entries from ${apiBase}.`);
}

await main();
