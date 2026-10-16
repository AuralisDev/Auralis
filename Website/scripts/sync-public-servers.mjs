import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = String(process.env.AURALIS_API_BASE || '').trim().replace(/\/$/, '');
if (!apiBase) throw new Error('Set AURALIS_API_BASE to the public HTTPS URL of the running Auralis backend.');
const response = await fetch(`${apiBase}/public/api/servers`, { headers: { Accept: 'application/json' } });
if (!response.ok) throw new Error(`Auralis API returned HTTP ${response.status}.`);
const payload = await response.json();
if (!Array.isArray(payload?.servers)) throw new Error('Auralis API did not return a servers array.');
await fs.mkdir(path.join(websiteRoot, 'data'), { recursive: true });
await fs.writeFile(path.join(websiteRoot, 'data', 'servers.json'), JSON.stringify({ servers: payload.servers, generatedAt: payload.generatedAt || new Date().toISOString() }, null, 2) + '\n');
console.log(`Synced ${payload.servers.length} public server entries.`);
