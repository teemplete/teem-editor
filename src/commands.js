import { isEditorContentEmpty } from './content.js';
import { isSafeHref, isSafeImageSrc, flattenStyleSpans } from './sanitize.js';

export function focusEditor(editor) {
  if (!editor) return;
  editor.focus({ preventScroll: true });
}

export function saveSelection(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

export function restoreSelection(range) {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  try {
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

function exec(command, value = null) {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export function queryCommandState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export function queryCommandValue(command) {
  try {
    return document.queryCommandValue(command);
  } catch {
    return '';
  }
}

export function getBlockFormat() {
  const value = (queryCommandValue('formatBlock') || '').toLowerCase();
  if (!value) return 'p';
  return value.replace(/[<>]/g, '');
}

function ensureCssStyled() {
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch {
    // ignore
  }
}

function getSelectedRange(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return range;
}

export function getLinkAtSelection(editor, range = null) {
  const activeRange = range || getSelectedRange(editor);
  if (!activeRange || !editor) return null;

  let node = activeRange.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !editor.contains(node)) return null;

  const anchor = node.closest?.('a[href]');
  if (!anchor || !editor.contains(anchor)) return null;

  return {
    element: anchor,
    url: anchor.getAttribute('href') || '',
    text: anchor.textContent || '',
  };
}

export function getRangeText(range) {
  if (!range || range.collapsed) return '';
  return range.toString();
}

export function removeLink(editor) {
  focusEditor(editor);
  if (!getLinkAtSelection(editor)) return false;
  return exec('unlink');
}

export function selectAnchor(anchor) {
  if (!anchor) return false;
  const range = document.createRange();
  range.selectNodeContents(anchor);
  return restoreSelection(range);
}

function applyLinkAttributes(anchor, url) {
  anchor.setAttribute('href', url);
  anchor.setAttribute('rel', 'noopener noreferrer');
  if (/^https?:/i.test(url)) {
    anchor.setAttribute('target', '_blank');
  } else {
    anchor.removeAttribute('target');
  }
}

export const IMAGE_LINK_NONE = 'none';
export const IMAGE_LINK_URL = 'url';
export const IMAGE_LINK_FILE = 'file';
export const IMAGE_LINK_LIGHTBOX = 'lightbox';

function getImageLinkAnchor(img) {
  if (!img) return null;
  const parent = img.parentElement;
  if (parent?.tagName === 'A' && parent.classList.contains('te-figure__link')) {
    return parent;
  }
  return null;
}

export function getImageLinkInfo(img) {
  if (!img) return { mode: IMAGE_LINK_NONE, href: '' };

  const anchor = getImageLinkAnchor(img);
  if (!anchor) return { mode: IMAGE_LINK_NONE, href: '' };

  if (
    anchor.hasAttribute('data-te-lightbox') ||
    anchor.classList.contains('te-figure__link--lightbox')
  ) {
    return {
      mode: IMAGE_LINK_LIGHTBOX,
      href: anchor.getAttribute('href') || img.getAttribute('src') || '',
    };
  }

  const mode = anchor.getAttribute('data-te-link-mode');
  return {
    mode: mode === IMAGE_LINK_FILE ? IMAGE_LINK_FILE : IMAGE_LINK_URL,
    href: anchor.getAttribute('href') || '',
  };
}

function unwrapImageLink(img) {
  const anchor = getImageLinkAnchor(img);
  if (!anchor?.parentElement) return;
  anchor.replaceWith(img);
}

function wrapImageLink(img, anchor) {
  const parent = img.parentElement;
  if (!parent) return;
  parent.insertBefore(anchor, img);
  anchor.appendChild(img);
}

function resolveImageSrcHref(img, href) {
  const candidate = (href || img.getAttribute('src') || '').trim();
  if (!candidate) return null;
  if (isSafeImageSrc(candidate) || isSafeHref(candidate)) return candidate;
  return null;
}

export function applyImageLink(img, { mode, href } = {}, messages) {
  if (!img) return;
  unwrapImageLink(img);

  if (!mode || mode === IMAGE_LINK_NONE) return;

  const t = messages || {};
  const anchor = document.createElement('a');
  anchor.className = 'te-figure__link';

  if (mode === IMAGE_LINK_LIGHTBOX) {
    const linkHref = resolveImageSrcHref(img, href);
    if (!linkHref) {
      throw new Error(
        (messages && messages.imageLinkInvalid) || 'Invalid image link.'
      );
    }
    anchor.setAttribute('href', linkHref);
    anchor.classList.add('te-figure__link--lightbox');
    anchor.setAttribute('data-te-lightbox', 'true');
    anchor.setAttribute('data-te-link-mode', IMAGE_LINK_LIGHTBOX);
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.removeAttribute('target');
  } else if (mode === IMAGE_LINK_FILE) {
    const linkHref = resolveImageSrcHref(img, href);
    if (!linkHref) {
      throw new Error(
        (messages && messages.imageLinkInvalid) || 'Invalid image link.'
      );
    }
    anchor.setAttribute('href', linkHref);
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('data-te-link-mode', IMAGE_LINK_FILE);
  } else {
    const trimmed = (href || '').trim();
    if (!trimmed || !isSafeHref(trimmed)) {
      throw new Error((t.linkUnsafe) || 'The link URL is invalid or unsafe.');
    }
    applyLinkAttributes(anchor, trimmed);
    anchor.setAttribute('data-te-link-mode', IMAGE_LINK_URL);
  }

  wrapImageLink(img, anchor);
}

export function removeImageLink(img) {
  unwrapImageLink(img);
}

export function updateLink(editor, anchor, url, text, messages) {
  if (!editor || !anchor || !editor.contains(anchor)) return false;
  if (!isSafeHref(url)) {
    throw new Error((messages && messages.linkUnsafe) || 'The link URL is invalid or unsafe.');
  }
  applyLinkAttributes(anchor, url);
  if (text) anchor.textContent = text;
  return true;
}

export function removeLinkAt(editor, anchor) {
  if (!editor || !anchor || !editor.contains(anchor)) return false;
  selectAnchor(anchor);
  focusEditor(editor);
  return exec('unlink');
}

/**
 * Apply inline style via <span style="...">.
 * Avoids <font color> from execCommand('foreColor'), which sanitizer strips.
 * Updates an existing color span in place when possible to avoid nesting.
 */
function applyInlineStyle(editor, styles) {
  focusEditor(editor);

  let range = getSelectedRange(editor);
  if (!range) return false;

  if (range.collapsed) {
    const expanded = expandToWord(range);
    if (expanded) {
      restoreSelection(expanded);
      range = expanded;
    } else {
      const span = document.createElement('span');
      if (styles.color) span.style.color = styles.color;
      if (styles.backgroundColor) span.style.backgroundColor = styles.backgroundColor;
      span.appendChild(document.createTextNode('\u200b'));
      range.insertNode(span);
      const caret = document.createRange();
      caret.setStart(span.firstChild, 1);
      caret.collapse(true);
      restoreSelection(caret);
      return true;
    }
  }

  const updated = updateExistingInlineStyle(range, styles);
  if (updated) {
    flattenStyleSpans(editor);
    return true;
  }

  const ok = wrapSelectionWithSpan(editor, styles);
  flattenStyleSpans(editor);
  return ok;
}

function expandToWord(range) {
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent || '';
  if (!text.trim()) return null;

  let start = range.startOffset;
  let end = range.endOffset;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  if (start === end) return null;

  const next = range.cloneRange();
  next.setStart(node, start);
  next.setEnd(node, end);
  return next;
}

/**
 * If selection exactly matches a styled span's contents, mutate that span
 * instead of wrapping again (works for Google Docs spans with color + bold, etc.).
 */
function updateExistingInlineStyle(range, styles) {
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

  let candidate = null;
  let el = node;
  while (el) {
    if (el.tagName === 'SPAN' && el.hasAttribute('style')) {
      const spanRange = document.createRange();
      spanRange.selectNodeContents(el);
      if (
        range.compareBoundaryPoints(Range.START_TO_START, spanRange) === 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, spanRange) === 0
      ) {
        candidate = el;
        break;
      }
    }
    if (el.classList?.contains('te-editor')) break;
    el = el.parentElement;
  }

  if (!candidate) return false;

  if (styles.color) candidate.style.color = styles.color;
  if (styles.backgroundColor) {
    if (styles.backgroundColor === 'transparent') {
      candidate.style.backgroundColor = '';
    } else {
      candidate.style.backgroundColor = styles.backgroundColor;
    }
  }

  const sel = window.getSelection();
  if (sel) {
    const selectRange = document.createRange();
    selectRange.selectNodeContents(candidate);
    sel.removeAllRanges();
    sel.addRange(selectRange);
  }
  return true;
}

/** Remove inline properties from a detached fragment before re-wrapping. */
function stripInlineStylesFromRoot(root, properties) {
  root.querySelectorAll('[style]').forEach((el) => {
    properties.forEach((prop) => {
      el.style[prop] = '';
    });
    if (!el.getAttribute('style')?.trim() && !el.className) {
      el.removeAttribute('style');
    }
  });
}

function wrapSelectionWithSpan(editor, styles) {
  const range = getSelectedRange(editor);
  if (!range || range.collapsed) return false;

  const propsToStrip = [];
  if (styles.color) propsToStrip.push('color');
  if (styles.backgroundColor) propsToStrip.push('backgroundColor');

  const fragment = range.extractContents();
  const tmp = document.createElement('div');
  tmp.appendChild(fragment);

  if (propsToStrip.length) {
    stripInlineStylesFromRoot(tmp, propsToStrip);
  }
  flattenStyleSpans(tmp);

  const span = document.createElement('span');
  if (styles.color) span.style.color = styles.color;
  if (styles.backgroundColor) {
    span.style.backgroundColor = styles.backgroundColor;
  }

  while (tmp.firstChild) span.appendChild(tmp.firstChild);
  range.insertNode(span);

  const sel = window.getSelection();
  if (sel) {
    const selectRange = document.createRange();
    selectRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(selectRange);
  }

  return true;
}

function clearHighlight(editor) {
  focusEditor(editor);
  const range = getSelectedRange(editor);
  if (!range) return;

  ensureCssStyled();
  exec('hiliteColor', 'transparent');
  exec('backColor', 'transparent');

  editor.querySelectorAll('span[style]').forEach((span) => {
    if (!range.intersectsNode(span)) return;
    span.style.backgroundColor = '';
    if (!span.getAttribute('style')?.trim()) {
      span.removeAttribute('style');
    }
  });
  flattenStyleSpans(editor);
}

export function applyFormat(editor, type, value, options = {}) {
  focusEditor(editor);
  ensureCssStyled();

  switch (type) {
    case 'bold':
      exec('bold');
      break;
    case 'italic':
      exec('italic');
      break;
    case 'strikeThrough':
      exec('strikeThrough');
      break;
    case 'formatBlock': {
      const tag = value || 'p';
      exec('formatBlock', tag === 'p' ? 'p' : tag);
      break;
    }
    case 'insertUnorderedList':
      exec('insertUnorderedList');
      break;
    case 'insertOrderedList':
      exec('insertOrderedList');
      break;
    case 'justifyRight':
      alignContent(editor, 'right', options.selectedImage);
      break;
    case 'justifyCenter':
      alignContent(editor, 'center', options.selectedImage);
      break;
    case 'justifyLeft':
      alignContent(editor, 'left', options.selectedImage);
      break;
    case 'indent':
      changeIndent(editor, 1);
      break;
    case 'outdent':
      changeIndent(editor, -1);
      break;
    case 'insertHorizontalRule':
      exec('insertHorizontalRule');
      break;
    case 'insertTable':
      insertTable(editor, value?.rows ?? 3, value?.cols ?? 3);
      break;
    case 'foreColor':
      applyInlineStyle(editor, { color: value });
      break;
    case 'hiliteColor':
      if (!value || value === 'transparent') {
        clearHighlight(editor);
      } else {
        applyInlineStyle(editor, { backgroundColor: value });
      }
      break;
    case 'removeFormat':
      exec('removeFormat');
      break;
    default:
      break;
  }
}

function getClosestBlock(editor, node) {
  let block = node;
  if (block && block.nodeType === Node.TEXT_NODE) block = block.parentElement;
  while (block && block !== editor) {
    if (
      block.matches?.(
        'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,.te-figure'
      )
    ) {
      return block;
    }
    block = block.parentElement;
  }
  return null;
}

const INDENT_STEP_PX = 24;
const MAX_INDENT_PX = 240;

function readIndentPx(block) {
  const inline = block.style?.marginInlineStart;
  if (inline) {
    const n = parseFloat(inline);
    if (!Number.isNaN(n)) return n;
  }
  const computed = block.ownerDocument?.defaultView
    ?.getComputedStyle(block)
    ?.marginInlineStart;
  if (computed) {
    const n = parseFloat(computed);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

function collectBlocksInRange(editor, range) {
  const blocks = [];
  const seen = new Set();

  const push = (node) => {
    const block = getClosestBlock(editor, node);
    if (!block || block === editor || seen.has(block)) return;
    // Skip structural wrappers that indent shouldn't touch
    if (block.matches?.('figure,.te-figure')) return;
    seen.add(block);
    blocks.push(block);
  };

  push(range.startContainer);
  push(range.endContainer);

  if (!range.collapsed) {
    try {
      const walker = editor.ownerDocument.createTreeWalker(
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement || editor,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
            if (
              node.matches?.(
                'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre'
              )
            ) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          },
        }
      );
      let current = walker.currentNode;
      if (current?.nodeType === Node.ELEMENT_NODE) push(current);
      while ((current = walker.nextNode())) push(current);
    } catch {
      // intersectsNode can throw on detached nodes; start/end are enough
    }
  }

  return blocks;
}

/**
 * Indent/outdent via margin — never uses execCommand('indent'),
 * which browsers implement by wrapping in <blockquote>.
 * List items nest/unnest with DOM moves instead.
 */
function changeIndent(editor, direction) {
  focusEditor(editor);
  const range = getSelectedRange(editor);
  if (!range) return;

  const blocks = collectBlocksInRange(editor, range);
  if (!blocks.length) return;

  blocks.forEach((block) => {
    if (block.tagName === 'LI') {
      indentListItem(block, direction);
      return;
    }

    const current = readIndentPx(block);
    const next = Math.max(
      0,
      Math.min(MAX_INDENT_PX, current + direction * INDENT_STEP_PX)
    );
    if (next <= 0) {
      block.style.marginInlineStart = '';
      if (!block.getAttribute('style')?.trim()) block.removeAttribute('style');
    } else {
      block.style.marginInlineStart = `${next}px`;
    }
  });
}

function indentListItem(li, direction) {
  const list = li.parentElement;
  if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return;

  if (direction > 0) {
    const prev = li.previousElementSibling;
    if (!prev || prev.tagName !== 'LI') return;

    let nested = prev.querySelector(':scope > ul, :scope > ol');
    if (!nested) {
      nested = document.createElement(list.tagName.toLowerCase());
      prev.appendChild(nested);
    }
    nested.appendChild(li);
    return;
  }

  // outdent
  const parentLi = list.parentElement;
  if (!parentLi || parentLi.tagName !== 'LI') return;
  const parentList = parentLi.parentElement;
  if (!parentList) return;

  parentLi.after(li);
  if (!list.children.length) list.remove();
}

function alignContent(editor, align, selectedImage) {
  const image =
    selectedImage && editor.contains(selectedImage) ? selectedImage : null;

  if (image) {
    alignImage(image, align);
    return;
  }

  const range = getSelectedRange(editor);
  const node = range?.commonAncestorContainer;
  const maybeImg =
    node?.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG'
      ? node
      : node?.parentElement?.closest?.('img');

  if (maybeImg && editor.contains(maybeImg)) {
    alignImage(maybeImg, align);
    return;
  }

  if (align === 'right') exec('justifyRight');
  else if (align === 'center') exec('justifyCenter');
  else exec('justifyLeft');
}

function ensureFigure(img) {
  const existing = img.closest?.('.te-figure');
  if (existing) return existing;

  const figure = document.createElement('div');
  figure.className = 'te-figure';
  figure.setAttribute('contenteditable', 'false');
  const wrapTarget = getImageLinkAnchor(img) || img;
  wrapTarget.replaceWith(figure);
  figure.appendChild(wrapTarget);
  return figure;
}

function getImageAspectRatio(img, fallbackWidth) {
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (naturalW > 0 && naturalH > 0) return naturalH / naturalW;

  const attrW = parseInt(img.getAttribute('width') || '', 10);
  const attrH = parseInt(img.getAttribute('height') || '', 10);
  if (attrW > 0 && attrH > 0) return attrH / attrW;

  const rect = img.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return rect.height / rect.width;

  return 1;
}

/** Live preview while dragging — inline style only. */
function previewImageSize(img, width, height) {
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  img.style.maxWidth = '100%';
  img.style.display = 'block';
}

/** Persist size in exported HTML via inline px + width/height attributes. */
export function commitImageSize(img, width, height) {
  if (!img || width <= 0 || height <= 0) return;

  const w = Math.round(width);
  const h = Math.round(height);
  img.setAttribute('width', String(w));
  img.setAttribute('height', String(h));
  img.style.width = `${w}px`;
  img.style.height = `${h}px`;
  img.style.display = 'block';
  img.style.maxWidth = '100%';
}

export function whenImageReady(img) {
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

export function alignImage(img, align) {
  const figure = ensureFigure(img);
  figure.setAttribute('data-align', align);
  figure.style.textAlign = align;
  figure.style.width = 'fit-content';
  figure.style.maxWidth = '100%';

  img.style.display = 'block';
  img.style.float = 'none';
  img.style.marginLeft = '0';
  img.style.marginRight = '0';

  if (align === 'center') {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = 'auto';
  } else if (align === 'left') {
    figure.style.marginLeft = '0';
    figure.style.marginRight = 'auto';
  } else {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = '0';
  }
}

export function selectImage(img, editor, messages) {
  if (!img || !editor) return;
  clearImageSelection(editor);
  const figure = ensureFigure(img);
  figure.classList.add('is-selected');
  img.classList.add('is-selected');

  let altBtn = figure.querySelector('.te-figure__alt-btn');
  if (!altBtn) {
    altBtn = document.createElement('button');
    altBtn.type = 'button';
    altBtn.className = 'te-figure__alt-btn';
    altBtn.setAttribute('contenteditable', 'false');
    figure.appendChild(altBtn);
  }
  const t = messages || {};
  const currentAlt = img.getAttribute('alt') || '';
  altBtn.textContent = currentAlt
    ? `Alt: ${currentAlt.length > 28 ? `${currentAlt.slice(0, 28)}…` : currentAlt}`
    : t.editAlt || 'Edit Alt';
  altBtn.title = t.editAltTitle || 'Edit image alt text';

  let linkBtn = figure.querySelector('.te-figure__link-btn');
  if (!linkBtn) {
    linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'te-figure__link-btn';
    linkBtn.setAttribute('contenteditable', 'false');
    figure.appendChild(linkBtn);
  }
  const linkInfo = getImageLinkInfo(img);
  linkBtn.textContent =
    linkInfo.mode === IMAGE_LINK_NONE
      ? t.editImageLink || 'Link'
      : linkInfo.mode === IMAGE_LINK_LIGHTBOX
        ? t.imageLinkLightboxShort || 'Lightbox'
        : linkInfo.mode === IMAGE_LINK_FILE
          ? t.imageLinkFileShort || 'File'
          : t.imageLinkSet || 'Linked';
  linkBtn.title = t.editImageLinkTitle || 'Edit image link';

  let resizeHandle = figure.querySelector('.te-figure__resize-handle');
  if (!resizeHandle) {
    resizeHandle = document.createElement('span');
    resizeHandle.className = 'te-figure__resize-handle';
    resizeHandle.setAttribute('contenteditable', 'false');
    resizeHandle.setAttribute('role', 'presentation');
    resizeHandle.title = t.resizeImage || 'Resize image';
    figure.appendChild(resizeHandle);
  }

  const range = document.createRange();
  range.selectNode(figure);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  focusEditor(editor);
}

export function startImageResize(img, startEvent, { editor, onComplete } = {}) {
  if (!img || !editor || !startEvent) return;

  const figure = img.closest('.te-figure');
  const usePointer = startEvent.pointerId !== undefined;
  const pointerId = usePointer ? startEvent.pointerId : null;
  const startX = startEvent.clientX;
  const rectWidth = img.getBoundingClientRect().width;
  const attrWidth = parseInt(img.getAttribute('width') || '', 10);
  const startWidth = rectWidth > 0 ? rectWidth : attrWidth > 0 ? attrWidth : 200;
  const ratio = getImageAspectRatio(img, startWidth);
  const maxWidth = Math.max(48, editor.clientWidth - 16);
  const editorDir = getComputedStyle(editor).direction;
  let lastWidth = startWidth;
  let lastHeight = Math.round(startWidth * ratio);

  const onMove = (ev) => {
    if (usePointer && ev.pointerId !== pointerId) return;
    const delta = ev.clientX - startX;
    const signedDelta = editorDir === 'rtl' ? -delta : delta;
    lastWidth = Math.round(
      Math.max(48, Math.min(startWidth + signedDelta, maxWidth))
    );
    lastHeight = Math.round(lastWidth * ratio);
    previewImageSize(img, lastWidth, lastHeight);
    if (figure) figure.style.width = 'fit-content';
  };

  const onUp = (ev) => {
    if (usePointer && ev.pointerId !== pointerId) return;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    commitImageSize(img, lastWidth, lastHeight);
    onComplete?.();
  };

  startEvent.preventDefault();
  if (usePointer) {
    const captureTarget = startEvent.currentTarget || startEvent.target;
    if (captureTarget?.setPointerCapture) {
      try {
        captureTarget.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  } else {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
}

export function clearImageSelection(editor) {
  if (!editor) return;
  editor.querySelectorAll('.te-figure.is-selected, img.is-selected').forEach((el) => {
    el.classList.remove('is-selected');
  });
  editor.querySelectorAll('.te-figure__alt-btn, .te-figure__link-btn, .te-figure__resize-handle').forEach((btn) =>
    btn.remove()
  );
}

function placeCaretAfterNodeRemoval(editor, next, prev) {
  focusEditor(editor);
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();

  if (next && editor.contains(next)) {
    range.setStart(next, 0);
    range.collapse(true);
  } else if (prev && editor.contains(prev)) {
    range.selectNodeContents(prev);
    range.collapse(false);
  } else if (isEditorContentEmpty(editor.innerHTML)) {
    editor.innerHTML = '<p><br></p>';
    const p = editor.querySelector('p');
    range.setStart(p, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

export function removeSelectedImage(editor) {
  if (!editor) return false;

  const selected = editor.querySelector('.te-figure.is-selected, img.is-selected');
  if (!selected) return false;

  const figure = selected.classList?.contains('te-figure')
    ? selected
    : selected.closest?.('.te-figure');
  if (!figure || !editor.contains(figure)) return false;

  const next = figure.nextElementSibling;
  const prev = figure.previousElementSibling;

  figure.remove();
  clearImageSelection(editor);
  placeCaretAfterNodeRemoval(editor, next, prev);
  return true;
}

export function updateImageLink(img, linkOptions, messages) {
  if (!img) return;
  applyImageLink(img, linkOptions, messages);
  const figure = img.closest?.('.te-figure');
  const btn = figure?.querySelector('.te-figure__link-btn');
  if (btn) {
    const t = messages || {};
    const linkInfo = getImageLinkInfo(img);
    btn.textContent =
      linkInfo.mode === IMAGE_LINK_NONE
        ? t.editImageLink || 'Link'
        : linkInfo.mode === IMAGE_LINK_LIGHTBOX
          ? t.imageLinkLightboxShort || 'Lightbox'
          : linkInfo.mode === IMAGE_LINK_FILE
            ? t.imageLinkFileShort || 'File'
            : t.imageLinkSet || 'Linked';
  }
}

export function updateImageAlt(img, alt, messages) {
  if (!img) return;
  img.setAttribute('alt', alt || '');
  const figure = img.closest?.('.te-figure');
  const btn = figure?.querySelector('.te-figure__alt-btn');
  if (btn) {
    const t = messages || {};
    btn.textContent = alt
      ? `Alt: ${alt.length > 28 ? `${alt.slice(0, 28)}…` : alt}`
      : t.editAlt || 'Edit Alt';
  }
}

export function setDirection(editor, dir) {
  focusEditor(editor);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editor.setAttribute('dir', dir);
    return;
  }

  let node = sel.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;

  const block = getClosestBlock(editor, node);
  if (block && block !== editor) {
    block.setAttribute('dir', dir);
    block.style.direction = dir;
  } else {
    editor.setAttribute('dir', dir);
  }
}

export function insertLink(editor, url, text, messages) {
  focusEditor(editor);
  if (!isSafeHref(url)) {
    throw new Error((messages && messages.linkUnsafe) || 'The link URL is invalid or unsafe.');
  }

  const sel = window.getSelection();
  const hasSelection = sel && !sel.isCollapsed && editor.contains(sel.anchorNode);

  if (hasSelection) {
    exec('createLink', url);
    const anchors = editor.querySelectorAll('a[href]');
    const last = anchors[anchors.length - 1];
    if (last) applyLinkAttributes(last, url);
  } else {
    const label = text || url;
    const safe = document.createElement('a');
    safe.textContent = label;
    applyLinkAttributes(safe, url);
    insertNode(editor, safe);
  }
}

/** Strip leading dots and keep only valid CSS class tokens. */
export function normalizeClassList(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim().replace(/^\.+/, ''))
    .filter((token) => token && /^-?[_a-zA-Z][\w-]*$/.test(token))
    .join(' ');
}

export function isCtaAnchor(anchor) {
  if (!anchor || anchor.tagName !== 'A') return false;
  return !!(anchor.getAttribute('class') || '').trim();
}

export function getCtaAtSelection(editor, range = null) {
  const link = getLinkAtSelection(editor, range);
  if (!link || !isCtaAnchor(link.element)) return null;
  return {
    ...link,
    classes: link.element.getAttribute('class') || '',
  };
}

export function updateCta(editor, anchor, url, text, classes, messages) {
  if (!editor || !anchor || !editor.contains(anchor)) return false;
  if (!isSafeHref(url)) {
    throw new Error((messages && messages.linkUnsafe) || 'The link URL is invalid or unsafe.');
  }
  applyLinkAttributes(anchor, url);
  if (text) anchor.textContent = text;
  const classList = normalizeClassList(classes);
  anchor.className = classList || 'te-cta';
  return true;
}

export function insertCta(editor, url, text, classes, messages) {
  focusEditor(editor);
  if (!isSafeHref(url)) {
    throw new Error((messages && messages.linkUnsafe) || 'The link URL is invalid or unsafe.');
  }

  const classList = normalizeClassList(classes) || 'te-cta';
  const label = text || url;
  const anchor = document.createElement('a');
  anchor.textContent = label;
  applyLinkAttributes(anchor, url);
  anchor.className = classList;
  insertNode(editor, anchor);
}

function getTableCellContext(cell) {
  const row = cell?.closest?.('tr');
  const table = cell?.closest?.('table');
  if (!row || !table) return null;

  const rows = [...table.rows];
  const rowIndex = rows.indexOf(row);
  if (rowIndex < 0) return null;

  const cells = [...row.cells];
  const cellIndex = cells.indexOf(cell);
  if (cellIndex < 0) return null;

  let colIndex = 0;
  for (let i = 0; i < cellIndex; i += 1) {
    colIndex += cells[i].colSpan || 1;
  }

  let colCount = 0;
  rows.forEach((tr) => {
    let count = 0;
    [...tr.cells].forEach((c) => {
      count += c.colSpan || 1;
    });
    colCount = Math.max(colCount, count);
  });

  return {
    cell,
    row,
    table,
    rowIndex,
    colIndex,
    cellIndex,
    colCount,
    rowCount: rows.length,
  };
}

function findCellAtColIndex(row, targetCol) {
  let col = 0;
  for (const c of row.cells) {
    const span = c.colSpan || 1;
    if (targetCol >= col && targetCol < col + span) return c;
    col += span;
  }
  return null;
}

function focusCaretInCell(cell) {
  if (!cell) return;
  const range = document.createRange();
  if (!cell.childNodes.length) {
    cell.innerHTML = '<br>';
  }
  range.selectNodeContents(cell);
  range.collapse(true);
  restoreSelection(range);
}

function createTableRowLike(referenceRow) {
  const tr = document.createElement('tr');
  [...referenceRow.cells].forEach((refCell) => {
    const cell = document.createElement(refCell.tagName.toLowerCase());
    cell.innerHTML = '<br>';
    if (refCell.colSpan > 1) cell.colSpan = refCell.colSpan;
    tr.appendChild(cell);
  });
  return tr;
}

function insertTableRow(editor, cell, position) {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;

  const newRow = createTableRowLike(ctx.row);
  if (position === 'above') ctx.row.before(newRow);
  else ctx.row.after(newRow);

  focusEditor(editor);
  focusCaretInCell(newRow.cells[ctx.cellIndex] || newRow.cells[0]);
  return true;
}

function insertTableColumn(editor, cell, side) {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;

  [...ctx.table.rows].forEach((row) => {
    const target = findCellAtColIndex(row, ctx.colIndex);
    const sample = target || row.cells[row.cells.length - 1];
    const tag = sample?.tagName.toLowerCase() || 'td';
    const newCell = document.createElement(tag);
    newCell.innerHTML = '<br>';

    if (side === 'left' && target) row.insertBefore(newCell, target);
    else if (side === 'right' && target) target.after(newCell);
    else row.appendChild(newCell);
  });

  focusEditor(editor);
  const focusRow = ctx.table.rows[ctx.rowIndex];
  const focusCell = findCellAtColIndex(
    focusRow,
    side === 'right' ? ctx.colIndex + 1 : ctx.colIndex
  );
  focusCaretInCell(focusCell || focusRow.cells[ctx.cellIndex]);
  return true;
}

function deleteTableRow(editor, cell) {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;
  if (ctx.rowCount <= 1) return deleteTable(editor, cell);

  const nextRow = ctx.row.nextElementSibling;
  const prevRow = ctx.row.previousElementSibling;
  ctx.row.remove();
  focusEditor(editor);

  const focusCell =
    findCellAtColIndex(nextRow, ctx.colIndex) ||
    findCellAtColIndex(prevRow, ctx.colIndex) ||
    nextRow?.cells[0] ||
    prevRow?.cells[0];
  focusCaretInCell(focusCell);
  return true;
}

function deleteTableColumn(editor, cell) {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;
  if (ctx.colCount <= 1) return deleteTable(editor, cell);

  [...ctx.table.rows].forEach((row) => {
    const target = findCellAtColIndex(row, ctx.colIndex);
    if (target) target.remove();
  });

  focusEditor(editor);
  const focusRow = ctx.table.rows[Math.min(ctx.rowIndex, ctx.table.rows.length - 1)];
  const focusCell =
    findCellAtColIndex(focusRow, ctx.colIndex) ||
    focusRow?.cells[ctx.cellIndex] ||
    focusRow?.cells[0];
  focusCaretInCell(focusCell);
  return true;
}

export function deleteTable(editor, cell) {
  const table = cell?.closest?.('table');
  if (!table || !editor?.contains(table)) return false;

  const next = table.nextElementSibling;
  const prev = table.previousElementSibling;
  table.remove();
  focusEditor(editor);
  placeCaretAfterNodeRemoval(editor, next, prev);
  return true;
}

export function tableCommand(editor, action, cell) {
  if (!editor || !cell || !editor.contains(cell)) return false;

  switch (action) {
    case 'insertRowAbove':
      return insertTableRow(editor, cell, 'above');
    case 'insertRowBelow':
      return insertTableRow(editor, cell, 'below');
    case 'insertColumnLeft':
      return insertTableColumn(editor, cell, 'left');
    case 'insertColumnRight':
      return insertTableColumn(editor, cell, 'right');
    case 'deleteRow':
      return deleteTableRow(editor, cell);
    case 'deleteColumn':
      return deleteTableColumn(editor, cell);
    case 'deleteTable':
      return deleteTable(editor, cell);
    default:
      return false;
  }
}

export function insertTable(editor, rows = 3, cols = 3) {
  focusEditor(editor);

  const safeRows = Math.max(1, Math.min(20, Number(rows) || 3));
  const safeCols = Math.max(1, Math.min(20, Number(cols) || 3));

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  for (let r = 0; r < safeRows; r += 1) {
    const tr = document.createElement('tr');
    for (let c = 0; c < safeCols; c += 1) {
      const cell = document.createElement(r === 0 ? 'th' : 'td');
      cell.innerHTML = '<br>';
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  insertNode(editor, table);

  const p = document.createElement('p');
  p.innerHTML = '<br>';
  insertNode(editor, p);
}

export function insertImage(editor, src, alt = '', linkOptions = null, messages) {
  focusEditor(editor);
  if (!isSafeImageSrc(src)) {
    throw new Error((messages && messages.imageUnsafe) || 'The image URL is invalid or unsafe.');
  }

  const figure = document.createElement('div');
  figure.className = 'te-figure';
  figure.setAttribute('contenteditable', 'false');
  figure.setAttribute('data-align', 'center');
  figure.style.textAlign = 'center';
  figure.style.width = 'fit-content';
  figure.style.maxWidth = '100%';
  figure.style.marginLeft = 'auto';
  figure.style.marginRight = 'auto';

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  img.setAttribute('loading', 'lazy');
  img.draggable = false;
  img.style.display = 'block';
  img.style.maxWidth = '100%';

  figure.appendChild(img);
  insertNode(editor, figure);

  if (linkOptions?.mode && linkOptions.mode !== IMAGE_LINK_NONE) {
    applyImageLink(img, linkOptions, messages);
  }

  // Trailing paragraph for caret after image
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  insertNode(editor, p);

  return img;
}

function insertNode(editor, node) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editor.appendChild(node);
    return;
  }

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.appendChild(node);
    return;
  }

  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function getActiveStates(editor) {
  const selectedImage = editor?.querySelector?.('.te-figure.is-selected, img.is-selected');
  let imageAlign = null;
  if (selectedImage) {
    const figure = selectedImage.classList?.contains('te-figure')
      ? selectedImage
      : selectedImage.closest?.('.te-figure');
    imageAlign = figure?.getAttribute('data-align') || null;
  }

  return {
    bold: queryCommandState('bold'),
    italic: queryCommandState('italic'),
    strikeThrough: queryCommandState('strikeThrough'),
    unorderedList: queryCommandState('insertUnorderedList'),
    orderedList: queryCommandState('insertOrderedList'),
    justifyRight: imageAlign ? imageAlign === 'right' : queryCommandState('justifyRight'),
    justifyCenter: imageAlign ? imageAlign === 'center' : queryCommandState('justifyCenter'),
    justifyLeft: imageAlign ? imageAlign === 'left' : queryCommandState('justifyLeft'),
    format: getBlockFormat(),
    hasSelectedImage: !!selectedImage,
    link: !!getLinkAtSelection(editor) && !getCtaAtSelection(editor),
    cta: !!getCtaAtSelection(editor),
  };
}
