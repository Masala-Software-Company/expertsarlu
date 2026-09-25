/** Ouvre une URL externe (navigateur système) — requis sous Tauri où window.open est bloqué. */
export async function openExternalUrl(url: string) {
  const target = url?.trim();
  if (!target) return;
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(target);
    return;
  } catch {
    /* navigateur web ou plugin indisponible */
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}
