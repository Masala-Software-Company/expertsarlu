/**
 * Injecte les meta Open Graph pour /suivi/:token
 * (WhatsApp / Facebook / Slack lisent le HTML serveur, pas le React).
 */
const fs = require('fs');
const path = require('path');

const API_BASE = (
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://expertsarlu-production.up.railway.app/api'
).replace(/\/$/, '');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readIndexHtml() {
  const candidates = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];
  for (const file of candidates) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      /* try next */
    }
  }
  return null;
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
    i += 2 + len;
  }
  return null;
}

async function isPortraitPhoto(photoUrl) {
  try {
    const res = await fetch(photoUrl, {
      headers: { 'User-Agent': 'eXpert-OG/1.0', Range: 'bytes=0-65535' },
    });
    if (!res.ok && res.status !== 206) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const size = readPngSize(buf) || readJpegSize(buf);
    if (!size || !size.h) return false;
    return size.w / size.h <= 1.45;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  const token = String(req.query?.token || '').trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'patient.expert-evac.com';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = `${proto}://${host}`;
  const pageUrl = token ? `${origin}/suivi/${encodeURIComponent(token)}` : origin;

  let title = 'Carte d’assistance — eXpert SARLU';
  let description =
    'Suivi de prise en charge médicale · Évacuation & mobilité internationale.';
  let image = `${origin}/apple-touch-icon.png`;
  let imageAlt = 'eXpert SARLU';

  if (token) {
    try {
      const response = await fetch(`${API_BASE}/client/suivi/${encodeURIComponent(token)}`, {
        headers: { 'User-Agent': 'eXpert-OG/1.0', Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
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
    } catch {
      /* keep defaults */
    }
  }

  let html = readIndexHtml();
  if (!html) {
    html = `<!doctype html><html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div></body></html>`;
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');

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

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${tags}\n  </head>`);
  } else {
    html = tags + html;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).send(html);
};
