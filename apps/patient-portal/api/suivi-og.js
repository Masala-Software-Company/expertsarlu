/**
 * Meta Open Graph pour /suivi/:token (bots WhatsApp / Facebook / Slack).
 * Les navigateurs humains ne passent PAS ici (voir vercel.json) —
 * ce fichier ne doit jamais faire échouer le partage ni bloquer la SPA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = (
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://expertsarlu-production.up.railway.app/api'
).replace(/\/$/, '');

const FETCH_MS = 2_500;
const PHOTO_MS = 1_500;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url, ms = FETCH_MS) {
  const t = withTimeout(ms);
  try {
    const res = await fetch(url, {
      signal: t.signal,
      headers: { 'User-Agent': 'eXpert-OG/1.0', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    t.clear();
  }
}

function readIndexHtml() {
  const candidates = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '_spa.html'),
  ];
  for (const file of candidates) {
    try {
      const html = fs.readFileSync(file, 'utf8');
      if (html && html.includes('<div id="root"')) return html;
    } catch {
      /* try next */
    }
  }
  return null;
}

function spaFallback(origin) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Carte d’assistance — eXpert SARLU</title>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(origin)}" />
  </head>
  <body>
    <p><a href="${escapeHtml(origin)}">Ouvrir le portail patient</a></p>
    <script>location.replace(${JSON.stringify(origin)})</script>
  </body>
</html>`;
}

function readPngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function readJpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

async function isPortraitPhoto(photoUrl) {
  const t = withTimeout(PHOTO_MS);
  try {
    const res = await fetch(photoUrl, {
      signal: t.signal,
      headers: { 'User-Agent': 'eXpert-OG/1.0', Range: 'bytes=0-65535' },
    });
    if (!res.ok && res.status !== 206) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const size = readPngSize(buf) || readJpegSize(buf);
    if (!size?.h) return false;
    return size.w / size.h <= 1.45;
  } catch {
    return false;
  } finally {
    t.clear();
  }
}

function injectMeta(html, { title, description, pageUrl, image, imageAlt }) {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');

  const tags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="eXpert SARLU" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
  `;

  if (out.includes('</head>')) {
    return out.replace('</head>', `${tags}\n  </head>`);
  }
  return tags + out;
}

function sendHtml(res, html, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(html);
}

export default async function handler(req, res) {
  try {
    const rawToken =
      (typeof req.query?.token === 'string' && req.query.token) ||
      (Array.isArray(req.query?.token) ? req.query.token[0] : '') ||
      '';
    const token = String(rawToken).trim().slice(0, 128);
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'patient.expert-evac.com';
    const host = String(hostHeader).split(',')[0].trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https')
      .split(',')[0]
      .trim();
    const origin = `${proto}://${host}`;
    const pageUrl = token ? `${origin}/suivi/${encodeURIComponent(token)}` : origin;

    let title = 'Carte d’assistance — eXpert SARLU';
    let description =
      'Suivi de prise en charge médicale · Évacuation & mobilité internationale.';
    let image = `${origin}/apple-touch-icon.png`;
    let imageAlt = 'eXpert SARLU';

    if (token) {
      const data = await fetchJson(`${API_BASE}/client/suivi/${encodeURIComponent(token)}`);
      if (data) {
        const name = data.patient
          ? `${data.patient.prenom || ''} ${data.patient.nom || ''}`.trim()
          : 'Patient';
        const numero = data.numero || '';
        title = numero
          ? `Carte d’assistance — ${name} · ${numero}`
          : `Carte d’assistance — ${name}`;
        description = numero
          ? `Suivi de dossier médical ${numero} — carte d’assistance eXpert SARLU.`
          : 'Suivi de dossier médical — carte d’assistance eXpert SARLU.';
        imageAlt = name || 'Patient';
        if (data.patient?.hasPhoto) {
          const photoUrl = `${API_BASE}/client/suivi/${encodeURIComponent(token)}/photo`;
          if (await isPortraitPhoto(photoUrl)) {
            image = photoUrl;
          }
        }
      }
    }

    const baseHtml = readIndexHtml() || spaFallback(pageUrl);
    const html = injectMeta(baseHtml, { title, description, pageUrl, image, imageAlt });
    sendHtml(res, html, 200);
  } catch (err) {
    console.error('[suivi-og]', err?.message || err);
    try {
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'patient.expert-evac.com')
        .split(',')[0]
        .trim();
      const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const origin = `${proto}://${host}`;
      sendHtml(res, spaFallback(origin), 200);
    } catch {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><body><p>eXpert SARLU</p></body></html>');
    }
  }
}
