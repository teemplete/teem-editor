import { isBlockTagName } from './formatHtml.js';

/** Private-use sentinels. They survive HTML escaping and are stripped before paint. */
const MARK_ANCHOR = '\uE000teem-caret-a\uE001';
const MARK_HEAD = '\uE000teem-caret-h\uE001';

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function clampOffset(node, offset) {
  if (!node) return 0;
  const max =
    node.nodeType === Node.TEXT_NODE ? (node.textContent || '').length : node.childNodes.length;
  return clamp(Number(offset) || 0, 0, max);
}

function childIndex(parent, node) {
  return [...parent.childNodes].indexOf(node);
}

function inEditor(editor, node) {
  try {
    return !!editor && !!node && (node === editor || editor.contains(node));
  } catch {
    return false;
  }
}

function isIgnorableWhitespace(text) {
  return !String(text || '').replace(/\u200b/g, '').trim();
}

/** Whitespace the source formatter inserts between block tags. It has no visual caret. */
function isPrettyGapText(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  if (!isIgnorableWhitespace(node.textContent)) return false;
  const parent = node.parentNode;
  if (!parent) return false;
  return [...parent.childNodes].some(
    (child) => child.nodeType === Node.ELEMENT_NODE && isBlockTagName(child.tagName)
  );
}

function caretAtStart(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const tag = el.tagName.toLowerCase();
  if (VOID_TAGS.has(tag)) {
    const parent = el.parentNode;
    if (!parent) return { node: el, offset: 0 };
    return { node: parent, offset: childIndex(parent, el) };
  }
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (isPrettyGapText(child)) continue;
      if ((child.textContent || '').length) return { node: child, offset: 0 };
      continue;
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') return { node: el, offset: childIndex(el, child) };
      const inner = caretAtStart(child);
      if (inner) return inner;
    }
  }
  return { node: el, offset: 0 };
}

function caretAtEnd(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const tag = el.tagName.toLowerCase();
  if (VOID_TAGS.has(tag)) {
    const parent = el.parentNode;
    if (!parent) return { node: el, offset: 0 };
    return { node: parent, offset: childIndex(parent, el) + 1 };
  }
  const children = el.childNodes;
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      if (isPrettyGapText(child)) continue;
      if ((child.textContent || '').length) {
        return { node: child, offset: child.textContent.length };
      }
      continue;
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') return { node: el, offset: childIndex(el, child) + 1 };
      const inner = caretAtEnd(child);
      if (inner) return inner;
    }
  }
  return { node: el, offset: children.length };
}

function siblingPoint(parent, index, direction) {
  const children = parent.childNodes;
  for (let i = index + direction; i >= 0 && i < children.length; i += direction) {
    const child = children[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      return direction > 0 ? caretAtStart(child) : caretAtEnd(child);
    }
    if (child.nodeType === Node.TEXT_NODE && !isPrettyGapText(child) && (child.textContent || '').length) {
      return direction > 0
        ? { node: child, offset: 0 }
        : { node: child, offset: child.textContent.length };
    }
  }
  return null;
}

/** Pull a caret out of formatter whitespace onto the nearest real text position. */
export function preferEditablePoint(point) {
  if (!point?.node || point.node.nodeType !== Node.TEXT_NODE) return point;
  if (!isPrettyGapText(point.node)) return point;
  const parent = point.node.parentNode;
  if (!parent) return point;
  const index = childIndex(parent, point.node);
  const text = point.node.textContent || '';
  const preferNext = point.offset >= text.length / 2;
  const next = siblingPoint(parent, index, 1);
  const prev = siblingPoint(parent, index, -1);
  if (preferNext) return next || prev || point;
  return prev || next || point;
}

function mapPoint(fromRoot, toRoot, node, offset) {
  if (!fromRoot || !toRoot || !node) return null;
  if (node === fromRoot) return { node: toRoot, offset: clampOffset(toRoot, offset) };
  const path = [];
  let current = node;
  while (current && current !== fromRoot) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.push(childIndex(parent, current));
    current = parent;
  }
  if (current !== fromRoot) return null;
  let target = toRoot;
  for (let i = path.length - 1; i >= 0; i -= 1) {
    target = target.childNodes[path[i]];
    if (!target) return null;
  }
  return { node: target, offset: clampOffset(target, offset) };
}

function pointDelta(aNode, aOff, bNode, bOff) {
  if (aNode === bNode) return clampOffset(bNode, bOff) - clampOffset(aNode, aOff);
  try {
    const range = document.createRange();
    range.setStart(aNode, clampOffset(aNode, aOff));
    range.collapse(true);
    return range.comparePoint(bNode, clampOffset(bNode, bOff));
  } catch {
    return 0;
  }
}

function insertTextMark(node, offset, mark) {
  const off = clampOffset(node, offset);
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    node.textContent = text.slice(0, off) + mark + text.slice(off);
    return;
  }
  node.insertBefore(document.createTextNode(mark), node.childNodes[off] || null);
}

/**
 * Live editor selection, preferring a real highlight over a collapsed caret
 * left behind when a control takes focus.
 */
export function readEditorSelection(editor, savedRange) {
  if (!editor) return null;
  const sel = window.getSelection();
  let live = null;
  if (
    sel &&
    sel.rangeCount > 0 &&
    inEditor(editor, sel.anchorNode) &&
    inEditor(editor, sel.focusNode)
  ) {
    live = {
      anchorNode: sel.anchorNode,
      anchorOffset: sel.anchorOffset,
      headNode: sel.focusNode,
      headOffset: sel.focusOffset,
      collapsed: sel.isCollapsed,
    };
  }

  let saved = null;
  if (savedRange && inEditor(editor, savedRange.startContainer) && inEditor(editor, savedRange.endContainer)) {
    saved = {
      anchorNode: savedRange.startContainer,
      anchorOffset: savedRange.startOffset,
      headNode: savedRange.endContainer,
      headOffset: savedRange.endOffset,
      collapsed: savedRange.collapsed,
    };
  }

  if (live && !live.collapsed) return live;
  if (saved && !saved.collapsed) return saved;
  return live || saved;
}

export function cloneWithCaretMarks(editor, selection) {
  const clone = editor.cloneNode(true);
  if (!selection) return clone;
  const anchor = mapPoint(editor, clone, selection.anchorNode, selection.anchorOffset);
  const head = mapPoint(editor, clone, selection.headNode, selection.headOffset);
  if (!anchor && !head) return clone;
  const a = anchor || head;
  const h = head || anchor;
  const delta = pointDelta(a.node, a.offset, h.node, h.offset);
  if (delta === 0) {
    insertTextMark(a.node, a.offset, MARK_ANCHOR);
    return clone;
  }
  if (delta > 0) {
    insertTextMark(h.node, h.offset, MARK_HEAD);
    insertTextMark(a.node, a.offset, MARK_ANCHOR);
  } else {
    insertTextMark(a.node, a.offset, MARK_ANCHOR);
    insertTextMark(h.node, h.offset, MARK_HEAD);
  }
  return clone;
}

function stripMarkChars(html) {
  return String(html || '').split(MARK_ANCHOR).join('').split(MARK_HEAD).join('');
}

/** Remove caret sentinels from formatted source and report offsets in the clean string. */
export function takeMarksFromHtml(html) {
  const source = String(html || '');
  const anchorAt = source.indexOf(MARK_ANCHOR);
  const headAt = source.indexOf(MARK_HEAD);
  const text = stripMarkChars(source);
  if (anchorAt === -1 && headAt === -1) return { html: text, selection: null };

  const marks = [];
  if (anchorAt !== -1) marks.push({ kind: 'anchor', at: anchorAt, len: MARK_ANCHOR.length });
  if (headAt !== -1) marks.push({ kind: 'head', at: headAt, len: MARK_HEAD.length });
  marks.sort((a, b) => a.at - b.at);
  const positions = {};
  let removed = 0;
  marks.forEach((mark) => {
    positions[mark.kind] = mark.at - removed;
    removed += mark.len;
  });
  const anchor = clamp(positions.anchor ?? positions.head ?? 0, 0, text.length);
  const head = clamp(positions.head ?? positions.anchor ?? anchor, 0, text.length);
  return { html: text, selection: { anchor, head } };
}

function findTagEnd(html, start) {
  let quote = '';
  for (let i = start + 1; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function tagCaretOffset(html, start, stop, pos) {
  const raw = html.slice(start, stop);
  const match = /^<\s*(\/?)\s*([a-zA-Z0-9:-]*)/.exec(raw);
  const closing = !!(match && match[1]);
  const name = match && match[2] ? match[2].toLowerCase() : '';
  const selfClose = /\/\s*>$/.test(raw);
  if (closing) return start;
  if (selfClose || VOID_TAGS.has(name)) {
    return pos - start < stop - pos ? start : stop;
  }
  return stop;
}

function snapEntity(html, regionStart, regionEnd, pos) {
  let i = regionStart;
  while (i < regionEnd) {
    if (html[i] !== '&') {
      i += 1;
      continue;
    }
    const semi = html.indexOf(';', i + 1);
    const body = semi === -1 || semi >= regionEnd ? '' : html.slice(i + 1, semi);
    const entity =
      /^#\d+$/.test(body) || /^#x[\da-f]+$/i.test(body) || /^[a-z][a-z0-9]+$/i.test(body);
    if (!entity || semi - i > 32) {
      i += 1;
      continue;
    }
    const stop = semi + 1;
    if (pos > i && pos < stop) return pos - i <= stop - pos ? i : stop;
    i = stop;
  }
  return pos;
}

/** Nearest source index where a text sentinel can be inserted for `index`. */
export function safeTextOffset(html, index) {
  const source = String(html || '');
  const n = source.length;
  const pos = clamp(index, 0, n);
  let i = 0;
  while (i < n) {
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3;
      if (pos >= i && pos < stop) return pos - i <= stop - pos ? i : stop;
      i = stop;
      continue;
    }
    if (source[i] === '<') {
      const gt = findTagEnd(source, i);
      const stop = gt === -1 ? n : gt + 1;
      if (pos >= i && pos < stop) return tagCaretOffset(source, i, stop, pos);
      i = stop;
      continue;
    }
    let next = i;
    while (next < n && source[next] !== '<') next += 1;
    if (pos >= i && pos <= next) {
      if (pos === next && next !== n) {
        i = next;
        continue;
      }
      return snapEntity(source, i, next, pos);
    }
    i = next;
  }
  return pos;
}

export function insertMarksInSource(html, anchor, head) {
  const source = String(html || '');
  const a = safeTextOffset(source, anchor);
  const h = safeTextOffset(source, head ?? anchor);
  if (a === h) return source.slice(0, a) + MARK_ANCHOR + source.slice(a);
  const lo = Math.min(a, h);
  const hi = Math.max(a, h);
  const loMark = a <= h ? MARK_ANCHOR : MARK_HEAD;
  const hiMark = a <= h ? MARK_HEAD : MARK_ANCHOR;
  return source.slice(0, lo) + loMark + source.slice(lo, hi) + hiMark + source.slice(hi);
}

function collectMarkHits(root) {
  const groups = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent || '';
    const anchor = text.indexOf(MARK_ANCHOR);
    const head = text.indexOf(MARK_HEAD);
    if (anchor !== -1 || head !== -1) groups.push({ node, text, anchor, head });
    node = walker.nextNode();
  }
  return groups;
}

/** Remove sentinels from a parsed tree and return live caret points inside `root`. */
export function takeMarksFromDom(root) {
  const groups = collectMarkHits(root);
  if (!groups.length) return null;

  groups.sort((a, b) => {
    if (a.node === b.node) return 0;
    const pos = a.node.compareDocumentPosition(b.node);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return -1;
    return 0;
  });

  const points = {};
  groups.forEach((group) => {
    const cuts = [];
    if (group.anchor !== -1) cuts.push({ kind: 'anchor', at: group.anchor, len: MARK_ANCHOR.length });
    if (group.head !== -1) cuts.push({ kind: 'head', at: group.head, len: MARK_HEAD.length });
    cuts.sort((a, b) => a.at - b.at);

    const adjusted = {};
    let removed = 0;
    cuts.forEach((cut) => {
      adjusted[cut.kind] = cut.at - removed;
      removed += cut.len;
    });

    let next = group.text;
    [...cuts].reverse().forEach((cut) => {
      next = next.slice(0, cut.at) + next.slice(cut.at + cut.len);
    });

    if (!next.length) {
      const parent = group.node.parentNode;
      const nextSibling = group.node.nextSibling;
      group.node.remove();
      const offset =
        parent && nextSibling && nextSibling.parentNode === parent
          ? childIndex(parent, nextSibling)
          : parent
            ? parent.childNodes.length
            : 0;
      cuts.forEach((cut) => {
        points[cut.kind] = { node: parent, offset };
      });
      return;
    }

    group.node.textContent = next;
    cuts.forEach((cut) => {
      points[cut.kind] = { node: group.node, offset: adjusted[cut.kind] };
    });
  });

  if (!points.anchor) points.anchor = points.head;
  if (!points.head) points.head = points.anchor;
  if (!points.anchor?.node) return null;
  return {
    anchor: preferEditablePoint(points.anchor),
    head: preferEditablePoint(points.head),
  };
}

export function restoreCaretPoints(anchor, head) {
  const sel = window.getSelection();
  if (!sel || !anchor?.node) return false;
  const headPoint = head?.node ? head : anchor;
  try {
    sel.setBaseAndExtent(
      anchor.node,
      clampOffset(anchor.node, anchor.offset),
      headPoint.node,
      clampOffset(headPoint.node, headPoint.offset)
    );
    return true;
  } catch {
    return false;
  }
}

export function scrollCaretIntoView(point) {
  const node = point?.node;
  if (!node) return;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  try {
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch {
    // ignore
  }
}

export function pointInEditor(editor, point) {
  return inEditor(editor, point?.node);
}
