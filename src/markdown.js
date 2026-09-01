import { marked } from 'marked';
import { sanitizeHtml } from './sanitize.js';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Convert Markdown to sanitized HTML safe for the editor.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToHtml(markdown) {
  const raw = marked.parse(String(markdown || '').trim(), { async: false });
  return sanitizeHtml(raw);
}
