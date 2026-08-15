/** Download a PNG or JPEG for PDFKit. Returns null on failure or unsupported format. */

function freshImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}t=${Date.now()}`;
}

async function fetchImageBuffer(url) {
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
    const isPng =
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8;

    if (!isPng && !isJpeg) {
      console.warn('[imageFetch] unsupported image format for', url, '- skipping');
      return null;
    }

    return buffer;
  } catch (err) {
    console.warn('[imageFetch] failed to fetch', url, err.message);
    return null;
  }
}

module.exports = { fetchImageBuffer, freshImageUrl };
