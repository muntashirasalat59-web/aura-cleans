/** Download the original branding file for PDF embedding (PNG, JPEG, or SVG). */

function freshImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  // Keep the stored object URL; only add a cache-buster. Do not use transform/thumbnail params.
  const stripped = raw.replace(/([?&])(width|height|resize|quality|format)=[^&]*/gi, '$1').replace(/[?&]$/, '');
  const sep = stripped.includes('?') ? '&' : '?';
  return `${stripped}${sep}t=${Date.now()}`;
}

function detectImageKind(buffer) {
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpeg';
  }
  const head = buffer.slice(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && /<svg/i.test(head))) {
    return 'svg';
  }
  return null;
}

/**
 * @returns {Promise<{ buffer: Buffer, kind: 'png'|'jpeg'|'svg' } | null>}
 */
async function fetchImageAsset(url) {
  const href = freshImageUrl(url);
  if (!href) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(href, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const kind = detectImageKind(buffer);
    if (!kind) {
      console.warn('[imageFetch] unsupported image format for', url, '- skipping');
      return null;
    }
    return { buffer, kind };
  } catch (err) {
    console.warn('[imageFetch] failed to fetch', url, err.message);
    return null;
  }
}

async function fetchImageBuffer(url) {
  const asset = await fetchImageAsset(url);
  return asset && asset.kind !== 'svg' ? asset.buffer : null;
}

module.exports = { fetchImageAsset, fetchImageBuffer, freshImageUrl };
