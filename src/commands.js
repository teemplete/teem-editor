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
 * If selection sits inside / exactly on a style span, mutate that span
 * instead of wrapping again.
 */
function updateExistingInlineStyle(range, styles) {
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

  let candidate = null;
  let el = node;
  while (el) {
    if (isStyleSpan(el)) {
      const spanRange = document.createRange();
      spanRange.selectNodeContents(el);
      if (
        range.compareBoundaryPoints(Range.START_TO_START, spanRange) >= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, spanRange) <= 0
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

function wrapSelectionWithSpan(editor, styles) {
  const range = getSelectedRange(editor);
  if (!range || range.collapsed) return false;

  const span = document.createElement('span');
  if (styles.color) span.style.color = styles.color;
  if (styles.backgroundColor) {
    span.style.backgroundColor = styles.backgroundColor;
  }

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    const tmp = document.createElement('div');
    tmp.appendChild(fragment);
    flattenStyleSpans(tmp);
    while (tmp.firstChild) span.appendChild(tmp.firstChild);
    range.insertNode(span);
  }

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
  if (img.parentElement?.classList?.contains('te-figure')) {
    return img.parentElement;
  }

  const figure = document.createElement('div');
  figure.className = 'te-figure';
  figure.setAttribute('contenteditable', 'false');
  img.replaceWith(figure);
  figure.appendChild(img);
  return figure;
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

  const range = document.createRange();
  range.selectNode(figure);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  focusEditor(editor);
}

export function clearImageSelection(editor) {
  if (!editor) return;
  editor.querySelectorAll('.te-figure.is-selected, img.is-selected').forEach((el) => {
    el.classList.remove('is-selected');
  });
  editor.querySelectorAll('.te-figure__alt-btn').forEach((btn) => btn.remove());
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
    if (last) {
      last.setAttribute('rel', 'noopener noreferrer');
      if (/^https?:/i.test(url)) last.setAttribute('target', '_blank');
    }
  } else {
    const label = text || url;
    const safe = document.createElement('a');
    safe.href = url;
    safe.textContent = label;
    safe.rel = 'noopener noreferrer';
    if (/^https?:/i.test(url)) safe.target = '_blank';
    insertNode(editor, safe);
  }
}

export function insertImage(editor, src, alt = '', messages) {
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
  };
}
