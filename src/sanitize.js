import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  's',
  'strike',
  'del',
  'blockquote',
  'pre',
  'a',
  'img',
  'hr',
  'u',
  'font',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'style',
  'dir',
  'class',
  'color',
  'face',
  'size',
  'contenteditable',
  'data-align',
  'loading',
  'draggable',
];

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|tel:|blob:)/i;
const SAFE_IMG_PROTOCOLS = /^(https?:|blob:|data:image\/(png|jpeg|jpg|gif|webp);base64,)/i;

function isSafeUrl(url, forImage = false) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
  return forImage
    ? SAFE_IMG_PROTOCOLS.test(trimmed)
    : SAFE_URL_PROTOCOLS.test(trimmed) || trimmed.startsWith('/');
}

function sanitizeStyles(styleValue) {
  if (!styleValue || typeof styleValue !== 'string') return '';

  const allowed = new Set([
    'color',
    'background-color',
    'text-align',
    'direction',
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'margin-inline-start',
    'margin-inline-end',
    'padding-right',
    'padding-left',
    'padding-inline-start',
    'padding-inline-end',
    'text-indent',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-decoration-line',
    'display',
    'float',
    'max-width',
    'width',
    'height',
    'box-sizing',
  ]);

  return styleValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':');
      if (colon === -1) return null;
      const prop = part.slice(0, colon).trim().toLowerCase();
      const value = part.slice(colon + 1).trim();
      if (!allowed.has(prop)) return null;
      if (/expression|url\s*\(|javascript|import/i.test(value)) return null;
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

/**
 * Sanitize HTML for safe rendering/storage.
 * Removes scripts, event handlers, and unsafe URLs.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return '';

  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
    ],
  });

  if (typeof document === 'undefined') return clean;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = clean;

  // Convert legacy <font color> (from older content / browsers) to <span style>
  wrapper.querySelectorAll('font').forEach((font) => {
    const span = document.createElement('span');
    const color = font.getAttribute('color');
    if (color) span.style.color = color;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
  });

  wrapper.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!isSafeUrl(href, false)) {
      a.removeAttribute('href');
    } else {
      a.setAttribute('rel', 'noopener noreferrer');
      if (/^https?:/i.test(href)) {
        a.setAttribute('target', '_blank');
      }
    }
  });

  wrapper.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!isSafeUrl(src, true)) {
      img.remove();
      return;
    }
    img.removeAttribute('onerror');
    img.removeAttribute('onload');

    // Keep images inside a selectable alignment wrapper
    if (!img.parentElement?.classList?.contains('te-figure')) {
      const figure = document.createElement('div');
      figure.className = 'te-figure';
      figure.setAttribute('contenteditable', 'false');
      const align =
        img.style.textAlign ||
        img.getAttribute('data-align') ||
        img.parentElement?.style?.textAlign ||
        'center';
      figure.setAttribute('data-align', align);
      figure.style.textAlign = align;
      img.replaceWith(figure);
      figure.appendChild(img);
    }
  });

  wrapper.querySelectorAll('.te-figure').forEach((figure) => {
    figure.setAttribute('contenteditable', 'false');
    if (!figure.getAttribute('data-align')) {
      figure.setAttribute('data-align', figure.style.textAlign || 'center');
    }
    figure.querySelectorAll('.te-figure__alt-btn, button').forEach((btn) => btn.remove());
    figure.classList.remove('is-selected');
  });

  wrapper.querySelectorAll('img.is-selected').forEach((img) => {
    img.classList.remove('is-selected');
  });

  wrapper.querySelectorAll('[style]').forEach((el) => {
    const next = sanitizeStyles(el.getAttribute('style'));
    if (next) el.setAttribute('style', next);
    else el.removeAttribute('style');
  });

  flattenStyleSpans(wrapper);

  return wrapper.innerHTML;
}

function unwrapElement(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function styleKeys(el) {
  const keys = [];
  for (let i = 0; i < el.style.length; i += 1) keys.push(el.style.item(i));
  return keys;
}

function isStyleSpan(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE || el.tagName !== 'SPAN') return false;
  const keys = styleKeys(el);
  if (!keys.length) return false;
  return keys.every((k) => k === 'color' || k === 'background-color');
}

/**
 * Collapse nested color/background spans into clean markup.
 * Turns hundreds of nested <span style="color"> into one span.
 */
export function flattenStyleSpans(root) {
  if (!root) return;

  let guard = 0;
  let changed = true;
  while (changed && guard < 80) {
    changed = false;
    guard += 1;

    [...root.querySelectorAll('span')].forEach((span) => {
      if (!span.isConnected) return;

      if (!span.getAttribute('style')?.trim() && !span.className) {
        unwrapElement(span);
        changed = true;
        return;
      }

      if (!isStyleSpan(span)) return;

      const parent = span.parentElement;
      if (
        parent &&
        isStyleSpan(parent) &&
        parent.childNodes.length === 1 &&
        parent.firstChild === span
      ) {
        if (span.style.color) parent.style.color = span.style.color;
        if (span.style.backgroundColor) {
          parent.style.backgroundColor = span.style.backgroundColor;
        }
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        span.remove();
        changed = true;
        return;
      }

      if (parent && isStyleSpan(parent)) {
        if (span.style.color) parent.style.color = span.style.color;
        if (span.style.backgroundColor) {
          parent.style.backgroundColor = span.style.backgroundColor;
        }
        unwrapElement(span);
        changed = true;
      }
    });
  }

  root.querySelectorAll('span').forEach((span) => {
    if (!span.getAttribute('style')?.trim() && !span.className) {
      unwrapElement(span);
    }
  });
}

export function isSafeHref(url) {
  return isSafeUrl(url, false);
}

export function isSafeImageSrc(url) {
  return isSafeUrl(url, true);
}
