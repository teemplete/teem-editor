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
      if (getAccordionTitleElement(editor)) {
        setAccordionTitleTag(editor, tag);
        break;
      }
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
    case 'insertAccordion':
      insertAccordion(editor, value);
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

const ACCORDION_TITLE_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6', 'div']);

const ACCORDION_SAMPLE_DEFAULTS = [
  ['What is your return policy?', 'You can return most items within 30 days of purchase.'],
  ['How long does shipping take?', 'Most orders arrive within 3 to 5 business days.'],
  ['Do you offer technical support?', 'Yes. Contact support and we will help you with setup and troubleshooting.'],
];

function accordionSamples(messages) {
  const pairs = [
    [messages?.accordionQ1, messages?.accordionA1],
    [messages?.accordionQ2, messages?.accordionA2],
    [messages?.accordionQ3, messages?.accordionA3],
  ];
  return pairs.map((pair, index) => [
    pair[0] || ACCORDION_SAMPLE_DEFAULTS[index][0],
    pair[1] || ACCORDION_SAMPLE_DEFAULTS[index][1],
  ]);
}

function createAccordionItem(tag, question, answer) {
  const item = document.createElement('div');
  item.className = 'te-accordion__item';

  const title = document.createElement(ACCORDION_TITLE_TAGS.has(tag) ? tag : 'h3');
  title.className = 'te-accordion__title';
  if (question) title.textContent = question;
  else title.innerHTML = '<br>';

  const panel = document.createElement('div');
  panel.className = 'te-accordion__panel';
  const paragraph = document.createElement('p');
  if (answer) paragraph.textContent = answer;
  else paragraph.innerHTML = '<br>';
  panel.appendChild(paragraph);

  item.append(title, panel);
  return item;
}

function elementFromRange(range) {
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node;
}

function textBeforeCaret(container, range) {
  const probe = range.cloneRange();
  probe.selectNodeContents(container);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().replace(/\u200b/g, '');
}

function textAfterCaret(container, range) {
  const probe = range.cloneRange();
  probe.selectNodeContents(container);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().replace(/\u200b/g, '');
}

function placeCaret(el, atStart) {
  if (!el) return;
  const target = el.matches?.('p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, div')
    ? el
    : el.querySelector('p, li, h1, h2, h3, h4, h5, h6, pre, blockquote') || el;
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(atStart);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function directAccordionPart(item, className) {
  return [...item.children].find((el) => el.classList.contains(className)) || null;
}

function accordionTitleTag(item) {
  const title = directAccordionPart(item, 'te-accordion__title');
  const tag = title?.tagName.toLowerCase();
  return ACCORDION_TITLE_TAGS.has(tag) ? tag : 'h3';
}

function itemHasText(el) {
  return !!((el?.textContent || '').replace(/\u200b/g, '').trim());
}

export function getAccordionTitleElement(editor, range = null) {
  const active = range || getSelectedRange(editor);
  if (!active || !editor) return null;
  const node = elementFromRange(active);
  const title = node?.closest?.('.te-accordion__title');
  if (!title || !editor.contains(title)) return null;
  return title;
}

export function setAccordionTitleTag(editor, tag) {
  const title = getAccordionTitleElement(editor);
  const nextTag = String(tag || '').toLowerCase();
  if (!title || !ACCORDION_TITLE_TAGS.has(nextTag)) return false;
  if (title.tagName.toLowerCase() === nextTag) return true;

  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const startNode = range && title.contains(range.startContainer) ? range.startContainer : null;
  const startOffset = range ? range.startOffset : 0;

  const next = document.createElement(nextTag);
  next.className = 'te-accordion__title';
  while (title.firstChild) next.appendChild(title.firstChild);
  title.replaceWith(next);

  const caret = document.createRange();
  if (startNode && next.contains(startNode)) {
    const max =
      startNode.nodeType === Node.TEXT_NODE ? startNode.length : startNode.childNodes.length;
    caret.setStart(startNode, Math.min(startOffset, max));
    caret.collapse(true);
  } else {
    caret.selectNodeContents(next);
    caret.collapse(false);
  }
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(caret);
  }
  return true;
}

function topLevelBlock(editor, node) {
  let block = node;
  if (!block || block === editor) return null;
  if (block.nodeType === Node.TEXT_NODE) block = block.parentElement;
  while (block && block.parentElement && block.parentElement !== editor) {
    block = block.parentElement;
  }
  return block && block.parentElement === editor ? block : null;
}

function blockHasContent(el) {
  if (!el) return false;
  const text = (el.textContent || '').replace(/\u200b/g, '').trim();
  if (text) return true;
  return !!el.querySelector('img, table, hr, ul, ol');
}

function placeAccordion(editor, root) {
  const range = getSelectedRange(editor);
  const anchor = range ? elementFromRange(range) : null;
  const host = anchor?.closest?.('.te-accordion');
  if (host && editor.contains(host)) {
    host.after(root);
    return;
  }

  const block = topLevelBlock(editor, anchor);
  const canSplit =
    block &&
    range?.collapsed &&
    block.contains(range.startContainer) &&
    block.matches('p, h1, h2, h3, h4, h5, h6, blockquote, pre');

  if (!canSplit) {
    if (block) block.after(root);
    else insertNode(editor, root);
    return;
  }

  const after = range.cloneRange();
  after.selectNodeContents(block);
  after.setStart(range.endContainer, range.endOffset);
  const fragment = after.extractContents();
  const keepBefore = blockHasContent(block);
  block.after(root);

  const holder = document.createElement('div');
  holder.appendChild(fragment);
  if (blockHasContent(holder)) {
    const afterBlock = document.createElement(block.tagName.toLowerCase());
    while (holder.firstChild) afterBlock.appendChild(holder.firstChild);
    root.after(afterBlock);
  }

  if (!keepBefore) block.remove();
}

export function insertAccordion(editor, messages) {
  if (!editor) return;
  focusEditor(editor);

  const root = document.createElement('div');
  root.className = 'te-accordion';
  accordionSamples(messages).forEach(([question, answer]) => {
    root.appendChild(createAccordionItem('h3', question, answer));
  });

  placeAccordion(editor, root);

  if (!root.nextElementSibling) {
    const trail = document.createElement('p');
    trail.innerHTML = '<br>';
    root.after(trail);
  }

  const title = root.querySelector('.te-accordion__title');
  if (title) placeCaret(title, true);
}

function insertAccordionItemAfter(item) {
  const next = createAccordionItem(accordionTitleTag(item), '', '');
  item.after(next);
  placeCaret(directAccordionPart(next, 'te-accordion__title'), true);
}

function isEntireElementSelected(el, range) {
  if (!el || !range || range.collapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(el);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, probe) === 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, probe) === 0
  );
}

function selectionAnchorInTitle(title) {
  const sel = window.getSelection();
  if (!sel) return true;
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  return title.contains(anchor) || title.contains(focus);
}

function applyControlledRangeEdit(range, event) {
  const type = event.inputType || '';
  if (type.startsWith('delete')) {
    range.deleteContents();
    return;
  }
  if ((type === 'insertText' || type === 'insertReplacementText') && event.data != null) {
    range.deleteContents();
    const text = document.createTextNode(event.data);
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

export function repairAccordionItem(item) {
  if (!item) return false;
  let changed = false;

  let title = directAccordionPart(item, 'te-accordion__title');
  let panel = directAccordionPart(item, 'te-accordion__panel');

  const nestedPanel = title?.querySelector(':scope > .te-accordion__panel');
  if (nestedPanel && title) {
    title.after(nestedPanel);
    panel = nestedPanel;
    changed = true;
  }

  if (title) {
    title
      .querySelectorAll(
        ':scope > p, :scope > div:not(.te-accordion__panel), :scope > ul, :scope > ol, :scope > blockquote, :scope > pre, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
      )
      .forEach((node) => {
        if (!panel) {
          panel = document.createElement('div');
          panel.className = 'te-accordion__panel';
          panel.innerHTML = '<p><br></p>';
          item.appendChild(panel);
        }
        panel.insertBefore(node, panel.firstChild);
        changed = true;
      });
  }

  const tag = accordionTitleTag(item);
  if (!title) {
    title = document.createElement(tag);
    title.className = 'te-accordion__title';
    title.innerHTML = '<br>';
    item.insertBefore(title, item.firstChild);
    changed = true;
  } else if (!title.classList.contains('te-accordion__title')) {
    title.classList.add('te-accordion__title');
    changed = true;
  }

  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'te-accordion__panel';
    panel.innerHTML = '<p><br></p>';
    title.after(panel);
    changed = true;
  } else if (!panel.classList.contains('te-accordion__panel')) {
    panel.classList.add('te-accordion__panel');
    changed = true;
  }

  [...item.children].forEach((child) => {
    if (child !== title && child !== panel) {
      panel.appendChild(child);
      changed = true;
    }
  });

  if (title.nextElementSibling !== panel) {
    title.after(panel);
    changed = true;
  }

  const titleEmpty = !(title.textContent || '').replace(/\u200b/g, '').trim();
  if (titleEmpty && !title.querySelector('br')) {
    title.innerHTML = '<br>';
    changed = true;
  }

  return changed;
}

export function repairAccordionStructure(editor) {
  if (!editor) return false;
  let changed = false;
  editor.querySelectorAll('.te-accordion__item').forEach((item) => {
    if (repairAccordionItem(item)) changed = true;
  });
  return changed;
}

export function clampAccordionSelection(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editor) return false;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return false;

  const item = elementFromRange(range)?.closest?.('.te-accordion__item');
  if (!item) return false;

  const title = directAccordionPart(item, 'te-accordion__title');
  const panel = directAccordionPart(item, 'te-accordion__panel');
  if (!title || !panel) return false;

  const crosses = range.intersectsNode(title) && range.intersectsNode(panel);
  if (!crosses) return false;

  const clipped = range.cloneRange();
  if (selectionAnchorInTitle(title)) {
    clipped.setEnd(title, title.childNodes.length);
  } else {
    clipped.setStart(panel, 0);
  }

  sel.removeAllRanges();
  sel.addRange(clipped);
  return true;
}

export function handleAccordionBeforeInput(editor, event) {
  if (!editor || event.isComposing) return false;
  const range = getSelectedRange(editor);
  if (!range) return false;

  const item = elementFromRange(range)?.closest?.('.te-accordion__item');
  if (!item) return false;

  const title = directAccordionPart(item, 'te-accordion__title');
  const panel = directAccordionPart(item, 'te-accordion__panel');
  if (!title || !panel) return false;

  if (range.intersectsNode(title) && range.intersectsNode(panel)) {
    event.preventDefault();
    const clipped = range.cloneRange();
    if (selectionAnchorInTitle(title)) {
      clipped.setEnd(title, title.childNodes.length);
    } else {
      clipped.setStart(panel, 0);
    }
    applyControlledRangeEdit(clipped, event);
    repairAccordionItem(item);
    return true;
  }

  if (title.contains(range.commonAncestorContainer) && isEntireElementSelected(title, range)) {
    const type = event.inputType || '';
    if (type === 'insertText' || type === 'insertReplacementText') {
      event.preventDefault();
      const text = event.data ?? '';
      if (text) title.textContent = text;
      else title.innerHTML = '<br>';
      placeCaret(title, false);
      return true;
    }
    if (type.startsWith('delete')) {
      event.preventDefault();
      title.innerHTML = '<br>';
      placeCaret(title, true);
      return true;
    }
  }

  if (panel.contains(range.commonAncestorContainer) && isEntireElementSelected(panel, range)) {
    const type = event.inputType || '';
    if (type === 'insertText' || type === 'insertReplacementText') {
      event.preventDefault();
      panel.innerHTML = '<p><br></p>';
      const paragraph = panel.querySelector('p');
      if (event.data) paragraph.textContent = event.data;
      placeCaret(paragraph || panel, false);
      return true;
    }
    if (type.startsWith('delete')) {
      event.preventDefault();
      panel.innerHTML = '<p><br></p>';
      placeCaret(panel.querySelector('p') || panel, true);
      return true;
    }
  }

  return false;
}

function deleteAccordionItem(editor, item) {
  const accordion = item.closest('.te-accordion');
  if (!accordion) return false;

  const items = [...accordion.children].filter((el) => el.classList.contains('te-accordion__item'));
  const index = items.indexOf(item);
  const focusItem = items[index + 1] || items[index - 1];
  item.remove();

  if (!accordion.querySelector('.te-accordion__item')) {
    const after = accordion.nextElementSibling;
    accordion.remove();
    if (after && editor.contains(after)) placeCaret(after, true);
    else focusEditor(editor);
    return true;
  }

  const focus =
    focusItem?.querySelector('.te-accordion__title') ||
    focusItem?.querySelector('.te-accordion__panel p');
  placeCaret(focus, true);
  return true;
}

export function accordionCommand(editor, action, item) {
  if (!editor || !item || !editor.contains(item)) return false;
  focusEditor(editor);

  switch (action) {
    case 'addItem':
      insertAccordionItemAfter(item);
      return true;
    case 'duplicateItem': {
      const clone = item.cloneNode(true);
      item.after(clone);
      repairAccordionItem(clone);
      placeCaret(directAccordionPart(clone, 'te-accordion__title'), true);
      return true;
    }
    case 'deleteItem':
      return deleteAccordionItem(editor, item);
    default:
      return false;
  }
}

function removeEmptyAccordionItem(title) {
  const item = title.closest('.te-accordion__item');
  const accordion = title.closest('.te-accordion');
  if (!item || !accordion) return;
  const items = [...accordion.children].filter((el) => el.classList.contains('te-accordion__item'));
  if (items.length < 2 || itemHasText(item)) return;
  const index = items.indexOf(item);
  const focusItem = items[index - 1] || items[index + 1];
  item.remove();
  if (!accordion.querySelector('.te-accordion__item')) accordion.remove();
  const focus =
    focusItem?.querySelector('.te-accordion__panel p') ||
    focusItem?.querySelector('.te-accordion__title');
  placeCaret(focus, false);
}

export function handleAccordionKeyDown(editor, event) {
  if (!editor || event.isComposing || event.keyCode === 229) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const range = getSelectedRange(editor);
  if (!range) return false;

  const node = elementFromRange(range);
  if (!node || !editor.contains(node)) return false;

  const title = node.closest('.te-accordion__title');
  const panel = title ? null : node.closest('.te-accordion__panel');
  if (!title && !panel) return false;

  if (event.key === 'Enter' && !event.shiftKey) {
    if (title) {
      event.preventDefault();
      const itemPanel = title.parentElement?.querySelector(':scope > .te-accordion__panel');
      const target =
        itemPanel?.querySelector('p, li, h2, h3, h4, h5, h6, pre, blockquote') || itemPanel;
      placeCaret(target, true);
      return true;
    }

    const item = panel.parentElement;
    const accordion = item?.parentElement;
    const items = accordion
      ? [...accordion.children].filter((el) => el.classList.contains('te-accordion__item'))
      : [];
    const atEndOfLast =
      range.collapsed &&
      items[items.length - 1] === item &&
      !node.closest('li, pre') &&
      textAfterCaret(panel, range).trim() === '';
    if (!atEndOfLast) return false;

    event.preventDefault();
    insertAccordionItemAfter(item);
    return true;
  }

  if (!range.collapsed) return false;

  if (event.key === 'Backspace' && title && textBeforeCaret(title, range).trim() === '') {
    event.preventDefault();
    removeEmptyAccordionItem(title);
    return true;
  }

  if (event.key === 'Backspace' && panel && textBeforeCaret(panel, range).trim() === '') {
    event.preventDefault();
    return true;
  }

  if (event.key === 'Delete' && title && textAfterCaret(title, range).trim() === '') {
    event.preventDefault();
    return true;
  }

  if (event.key === 'Delete' && panel && textAfterCaret(panel, range).trim() === '') {
    event.preventDefault();
    return true;
  }

  return false;
}

export function getAccordionItemAtTarget(target, editor) {
  if (!target || !editor) return null;
  const el = target instanceof Element ? target : target.parentElement;
  const item = el?.closest?.('.te-accordion__item');
  if (!item || !editor.contains(item)) return null;
  return item;
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

  const accordionTitle = getAccordionTitleElement(editor);

  return {
    bold: queryCommandState('bold'),
    italic: queryCommandState('italic'),
    strikeThrough: queryCommandState('strikeThrough'),
    unorderedList: queryCommandState('insertUnorderedList'),
    orderedList: queryCommandState('insertOrderedList'),
    justifyRight: imageAlign ? imageAlign === 'right' : queryCommandState('justifyRight'),
    justifyCenter: imageAlign ? imageAlign === 'center' : queryCommandState('justifyCenter'),
    justifyLeft: imageAlign ? imageAlign === 'left' : queryCommandState('justifyLeft'),
    format: accordionTitle ? accordionTitle.tagName.toLowerCase() : getBlockFormat(),
    accordionTitle: accordionTitle ? accordionTitle.tagName.toLowerCase() : null,
    hasSelectedImage: !!selectedImage,
    link: !!getLinkAtSelection(editor) && !getCtaAtSelection(editor),
    cta: !!getCtaAtSelection(editor),
  };
}
