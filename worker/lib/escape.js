export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

export const escapeAttr = escapeHtml;

export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function vcardEscape(value = '') {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}
