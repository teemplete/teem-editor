const ZERO_WIDTH_RE = /[\u200b-\u200d\u2060\ufeff]/g;
const WORD_SPACE_RE = /[\u00a0\u2007\u202f]/g;

/**
 * Normalize plain text pasted into code blocks (Word, Google Docs, etc.).
 */
export function normalizePastedCodeText(text) {
  if (text == null) return '';
  let s = String(text);
  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(/\u2028/g, '\n').replace(/\u2029/g, '\n\n');
  s = s.replace(WORD_SPACE_RE, ' ');
  s = s.replace(ZERO_WIDTH_RE, '');
  s = s.replace(/\t/g, '  ');
  return s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function walkHtmlToPlain(node, parts) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    parts.push(node.nodeValue || '');
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName;
  if (tag === 'BR') {
    parts.push('\n');
    return;
  }

  const block = /^(P|DIV|LI|TR|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/i.test(tag);
  node.childNodes.forEach((child) => walkHtmlToPlain(child, parts));
  if (block) parts.push('\n');
}

/** Extract plain text from HTML clipboard payload (fallback when text/plain is empty). */
export function htmlClipboardToPlainText(html) {
  if (!html || typeof document === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts = [];
  walkHtmlToPlain(doc.body, parts);
  return normalizePastedCodeText(parts.join(''));
}

export function clipboardPlainForCode(clipboardData) {
  if (!clipboardData) return '';
  const plain = clipboardData.getData('text/plain') || '';
  const normalizedPlain = normalizePastedCodeText(plain);
  if (normalizedPlain.replace(/\s/g, '').length > 0) return normalizedPlain;

  const html = clipboardData.getData('text/html');
  if (html) return htmlClipboardToPlainText(html);
  return normalizedPlain;
}

export function getEditingCodeElement(editor) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !editor) return null;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !editor.contains(node)) return null;

  const pre = node.closest('pre');
  if (pre && editor.contains(pre)) return pre;

  const code = node.closest('code');
  if (code && editor.contains(code)) return code;

  return null;
}

/** Turn messy rich-text markup inside a code block into plain text. */
export function elementToPlainCodeText(root) {
  if (!root) return '';
  const parts = [];
  walkHtmlToPlain(root, parts);
  return normalizePastedCodeText(parts.join(''));
}

export function flattenCodeElement(el) {
  if (!el || typeof document === 'undefined') return;
  const pre = el.tagName === 'PRE' ? el : el.closest?.('pre');
  const target = pre || (el.tagName === 'CODE' ? el : null);
  if (!target) return;
  const text = elementToPlainCodeText(target);
  target.textContent = text;
}

export function flattenCodeBlocks(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('span, p, div, font, b, strong, i, em, u, s, a')) {
      flattenCodeElement(pre);
    }
  });
  root.querySelectorAll('code').forEach((code) => {
    if (code.closest('pre')) return;
    if (code.querySelector('span, font, b, strong, i, em, u, s, a')) {
      code.textContent = normalizePastedCodeText(code.textContent || '');
    }
  });
}

export const repairCodeBlocksInRoot = flattenCodeBlocks;

function unwrapNode(el) {
  const parent = el?.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function parseInlineStyle(styleValue) {
  const out = {};
  if (!styleValue) return out;
  styleValue.split(';').forEach((part) => {
    const colon = part.indexOf(':');
    if (colon === -1) return;
    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}

function isBlackColor(value) {
  if (!value) return true;
  const v = value.replace(/\s/g, '').toLowerCase();
  return v === '#000' || v === '#000000' || v === 'black' || v === 'rgb(0,0,0)';
}

function isTransparentBg(value) {
  if (!value) return true;
  const v = value.replace(/\s/g, '').toLowerCase();
  return v === 'transparent' || v === 'rgba(0,0,0,0)';
}

/** Convert Google Docs / Word spans into semantic tags and drop presentation noise. */
function semanticizeOfficeSpans(root) {
  [...root.querySelectorAll('span')].reverse().forEach((span) => {
    if (!span.isConnected) return;

    const parsed = parseInlineStyle(span.getAttribute('style'));
    const weight = parsed['font-weight'];
    const bold = weight === '700' || weight === 'bold' || weight === '600';
    const italic = parsed['font-style'] === 'italic';
    const deco = parsed['text-decoration'] || parsed['text-decoration-line'] || '';
    const underline = /underline/i.test(deco);

    const bg = parsed['background-color'];
    const keepBg = bg && !isTransparentBg(bg);
    const color = parsed['color'];
    const keepColor = color && !isBlackColor(color);

    const children = [...span.childNodes];
    if (!children.length) {
      span.remove();
      return;
    }

    const onlyDefaults =
      !bold &&
      !italic &&
      !underline &&
      !keepBg &&
      !keepColor &&
      !parsed['font-size'] &&
      !parsed['font-family'];

    if (onlyDefaults) {
      unwrapNode(span);
      return;
    }

    let node;
    if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
      node = children[0];
    } else {
      const frag = document.createDocumentFragment();
      children.forEach((c) => frag.appendChild(c));
      node = frag;
    }

    const wrap = (tag, inner) => {
      const el = document.createElement(tag);
      if (inner instanceof DocumentFragment) {
        el.append(...inner.childNodes);
      } else {
        el.appendChild(inner);
      }
      return el;
    };

    let out = node;
    if (bold) out = wrap('strong', out);
    if (italic) out = wrap('em', out);
    if (underline) out = wrap('u', out);

    if (keepBg || keepColor) {
      const styled = document.createElement('span');
      if (keepColor) styled.style.color = color;
      if (keepBg) styled.style.backgroundColor = bg;
      if (out instanceof DocumentFragment) styled.append(...out.childNodes);
      else styled.appendChild(out);
      out = styled;
    }

    span.replaceWith(out);
  });
}

function normalizePastedLists(root) {
  root.querySelectorAll('li').forEach((li) => {
    li.removeAttribute('style');
    li.removeAttribute('aria-level');
    [...li.querySelectorAll(':scope > p')].forEach((p) => {
      while (p.firstChild) li.insertBefore(p.firstChild, p);
      p.remove();
    });
  });
  root.querySelectorAll('ul, ol').forEach((list) => {
    list.removeAttribute('style');
  });
}

function normalizePastedBlocks(root) {
  root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div').forEach((el) => {
    if (el.closest('table')) return;
    if (el.classList?.contains('te-accordion__title') || el.classList?.contains('te-accordion__panel')) {
      return;
    }
    const align = el.style?.textAlign;
    el.removeAttribute('style');
    if (align === 'right' || align === 'center' || align === 'left') {
      el.style.textAlign = align;
    }
  });
}

function normalizePastedTables(root) {
  root.querySelectorAll('table').forEach((table) => {
    table.removeAttribute('style');
    table.style.borderCollapse = 'collapse';
    table.querySelectorAll('tr, colgroup, col').forEach((el) => {
      if (el.tagName === 'COLGROUP' || el.tagName === 'COL') el.remove();
      else el.removeAttribute('style');
    });
    table.querySelectorAll('td, th').forEach((cell) => {
      const align = cell.style.textAlign;
      cell.removeAttribute('style');
      if (align === 'right' || align === 'center' || align === 'left') {
        cell.style.textAlign = align;
      }
    });
  });
  root.querySelectorAll('div').forEach((div) => {
    if (div.childElementCount === 1 && div.firstElementChild?.tagName === 'TABLE') {
      unwrapNode(div);
    }
  });
}

function removeEmptyPasteBlocks(root) {
  root.querySelectorAll('p').forEach((p) => {
    const text = (p.textContent || '').replace(/\u200b/g, '').trim();
    if (!text && !p.querySelector('img, table, hr, br')) p.remove();
  });
}

/**
 * Strip Google Docs / Word markup before sanitizeHtml.
 * Keeps structure (headings, lists, tables, links) and semantic bold/italic/highlight.
 */
export function preparePastedHtml(html) {
  if (!html || typeof document === 'undefined') return html || '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;
  root.querySelectorAll('meta, link, style, script').forEach((n) => n.remove());

  for (let i = 0; i < 6; i += 1) {
    const before = root.innerHTML;
    semanticizeOfficeSpans(root);
    if (root.innerHTML === before) break;
  }

  normalizePastedLists(root);
  normalizePastedTables(root);
  normalizePastedBlocks(root);
  removeEmptyPasteBlocks(root);

  return root.innerHTML;
}
