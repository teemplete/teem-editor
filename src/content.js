const CONTENT_SELECTOR =
  'img, .te-figure, video, iframe, table, hr, blockquote, ul li, ol li, pre, code';

const CONTENT_HTML_RE =
  /<(?:img|video|iframe|table|hr)\b|te-figure\b|<blockquote\b|<(?:ul|ol)\b|<pre\b|<code\b/i;

/**
 * True when editor HTML has no visible text and no meaningful block/media nodes.
 */
export function isEditorContentEmpty(html) {
  const stripped = String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\u200b/g, '')
    .trim();
  if (stripped) return false;

  if (typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.innerHTML = html;
    return !root.querySelector(CONTENT_SELECTOR);
  }

  return !CONTENT_HTML_RE.test(String(html || ''));
}
