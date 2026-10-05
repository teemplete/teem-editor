const INDENT = '  ';

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'div',
  'dl',
  'dt',
  'dd',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function indent(depth) {
  return INDENT.repeat(depth);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function openTag(el) {
  const tag = el.tagName.toLowerCase();
  let attrs = '';
  [...el.attributes].forEach((attr) => {
    const name = attr.name;
    const value = attr.value;
    if (value === '') {
      attrs += ` ${name}`;
    } else {
      attrs += ` ${name}="${escapeAttr(value)}"`;
    }
  });
  return `<${tag}${attrs}>`;
}

function isBlockTag(tag) {
  return BLOCK_TAGS.has(tag);
}

function nodeIsBlock(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return isBlockTag(node.tagName.toLowerCase());
}

function childrenAreInline(node) {
  return [...node.childNodes].every((child) => {
    if (child.nodeType === Node.TEXT_NODE) return true;
    if (child.nodeType !== Node.ELEMENT_NODE) return true;
    return !isBlockTag(child.tagName.toLowerCase());
  });
}

function escapeText(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function serializeInline(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  if (VOID_TAGS.has(tag)) return openTag(node);

  let html = openTag(node);
  node.childNodes.forEach((child) => {
    html += serializeInline(child);
  });
  html += `</${tag}>`;
  return html;
}

function formatPre(el, depth, lines) {
  const text = el.textContent || '';
  lines.push(`${indent(depth)}<pre>`);
  if (text) {
    text.split('\n').forEach((line) => {
      lines.push(`${indent(depth + 1)}${line}`);
    });
  }
  lines.push(`${indent(depth)}</pre>`);
}

function formatElement(el, depth, lines) {
  const tag = el.tagName.toLowerCase();

  if (VOID_TAGS.has(tag)) {
    lines.push(`${indent(depth)}${openTag(el)}`);
    return;
  }

  if (tag === 'pre') {
    formatPre(el, depth, lines);
    return;
  }

  const block = isBlockTag(tag);
  const inlineChildren = childrenAreInline(el);

  if (!block || inlineChildren) {
    const line = `${indent(depth)}${serializeInline(el)}`;
    if (line.trim()) lines.push(line);
    return;
  }

  lines.push(`${indent(depth)}${openTag(el)}`);
  el.childNodes.forEach((child) => {
    formatNode(child, depth + 1, lines);
  });
  lines.push(`${indent(depth)}</${tag}>`);
}

function formatNode(node, depth, lines) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text.trim()) return;
    lines.push(`${indent(depth)}${text.trim()}`);
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    formatElement(node, depth, lines);
  }
}

/**
 * Pretty-print HTML for the source editor (2-space indent, block tags on separate lines).
 */
export function formatHtml(html) {
  if (!html || typeof document === 'undefined') return html || '';
  const trimmed = String(html).trim();
  if (!trimmed) return '';

  const root = document.createElement('div');
  root.innerHTML = trimmed;

  const lines = [];
  root.childNodes.forEach((child) => formatNode(child, 0, lines));
  return lines.join('\n');
}
