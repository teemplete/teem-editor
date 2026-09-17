import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Toolbar } from './Toolbar.jsx';
import {
  LinkDialog,
  CtaDialog,
  LinkPopover,
  ImageDialog,
  ImageAltDialog,
  ImageLinkDialog,
  MarkdownDialog,
  TableContextMenu,
} from './Dialogs.jsx';
import { sanitizeHtml } from './sanitize.js';
import { processImageUpload } from './upload.js';
import { createHistory } from './history.js';
import { getMessages, getDefaultDir, resolveLanguage } from './i18n.js';
import {
  applyFormat,
  getActiveStates,
  getLinkAtSelection,
  getCtaAtSelection,
  isCtaAnchor,
  getRangeText,
  insertImage,
  insertLink,
  insertCta,
  removeLinkAt,
  updateLink,
  updateCta,
  restoreSelection,
  saveSelection,
  setDirection,
  selectImage,
  clearImageSelection,
  removeSelectedImage,
  startImageResize,
  whenImageReady,
  updateImageAlt,
  updateImageLink,
  getImageLinkInfo,
  IMAGE_LINK_LIGHTBOX,
  tableCommand,
} from './commands.js';
import { SourceEditor } from './SourceEditor.jsx';
import { markdownToHtml } from './markdown.js';
import { version as TEEM_EDITOR_VERSION } from '../package.json';
import { isEditorContentEmpty } from './content.js';
import './styles.css';

const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/teem-editor';

function normalizeEmpty(html) {
  const trimmed = (html || '').trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') {
    return '<p><br></p>';
  }
  return trimmed;
}

async function resolveImageLink(link) {
  if (!link || link.mode === 'none') return { mode: 'none', href: '' };
  if (link.mode === 'lightbox' || link.mode === 'file') {
    return { mode: link.mode, href: '' };
  }
  if (link.mode === 'url') return { mode: 'url', href: link.href };
  return { mode: 'none', href: '' };
}

function stripSelectionClasses(html) {
  if (typeof document !== 'undefined') {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.te-figure__alt-btn, .te-figure__link-btn, .te-figure__resize-handle').forEach((el) =>
      el.remove()
    );
    wrap.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
    wrap.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
    return wrap.innerHTML;
  }
  return html
    .replace(/<button[^>]*class="[^"]*te-figure__alt-btn[^"]*"[^>]*>.*?<\/button>/gi, '')
    .replace(/<button[^>]*class="[^"]*te-figure__link-btn[^"]*"[^>]*>.*?<\/button>/gi, '')
    .replace(/<span[^>]*class="[^"]*te-figure__resize-handle[^"]*"[^>]*>.*?<\/span>/gi, '')
    .replace(/\s*is-selected/g, '')
    .replace(/\sclass=""/g, '')
    .replace(/\sclass=''/g, '');
}

/**
 * TeemEditor — simple, fast WYSIWYG for React and Next.js with full RTL/LTR support.
 */
export const TeemEditor = forwardRef(function TeemEditor(
  {
    value,
    defaultValue = '<p><br></p>',
    onChange,
    placeholder,
    language = 'en',
    dir,
    className = '',
    style,
    minHeight = 220,
    noscroll = false,
    disabled = false,
    onUpload,
    uploadOptions,
    toolbar = true,
  },
  ref
) {
  const lang = resolveLanguage(language);
  const t = getMessages(lang);
  const resolvedDir = dir || getDefaultDir(lang);
  const resolvedPlaceholder = placeholder ?? t.placeholder;

  const rootRef = useRef(null);
  const editorRef = useRef(null);
  const historyRef = useRef(createHistory());
  const savedRangeRef = useRef(null);
  const lastHtmlRef = useRef('');
  const composingRef = useRef(false);
  const selectedImageRef = useRef(null);
  const messagesRef = useRef(t);
  messagesRef.current = t;

  const [states, setStates] = useState(() => ({
    bold: false,
    italic: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
    justifyRight: false,
    justifyCenter: false,
    justifyLeft: false,
    format: 'p',
    hasSelectedImage: false,
    link: false,
    cta: false,
  }));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEditing, setLinkEditing] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: '', text: '' });
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaEditing, setCtaEditing] = useState(false);
  const [ctaDraft, setCtaDraft] = useState({ url: '', text: '', classes: '' });
  const ctaEditAnchorRef = useRef(null);
  const [linkPopover, setLinkPopover] = useState(null);
  const linkPopoverAnchorRef = useRef(null);
  const linkEditAnchorRef = useRef(null);
  const linkPopoverHoverRef = useRef(false);
  const linkPopoverHideTimerRef = useRef(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [altDraft, setAltDraft] = useState('');
  const [imageLinkOpen, setImageLinkOpen] = useState(false);
  const [imageLinkDraft, setImageLinkDraft] = useState({ mode: 'none', href: '' });
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tableMenu, setTableMenu] = useState(null);
  const tableMenuCellRef = useRef(null);

  const closeTableMenu = useCallback(() => {
    tableMenuCellRef.current = null;
    setTableMenu(null);
  }, []);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const emitChange = useCallback(
    (html, { recordHistory = true } = {}) => {
      const clean = sanitizeHtml(stripSelectionClasses(normalizeEmpty(html)));
      lastHtmlRef.current = clean;
      setIsEmpty(isEditorContentEmpty(clean));

      if (recordHistory) {
        historyRef.current.push(clean);
        syncHistoryFlags();
      }

      onChange?.(clean);
    },
    [onChange, syncHistoryFlags]
  );

  const readHtml = useCallback(() => editorRef.current?.innerHTML || '', []);

  const setHtml = useCallback(
    (html, { recordHistory = false } = {}) => {
      if (!editorRef.current) return;
      const clean = sanitizeHtml(normalizeEmpty(html));
      editorRef.current.innerHTML = clean;
      lastHtmlRef.current = clean;
      setIsEmpty(isEditorContentEmpty(clean));
      selectedImageRef.current = null;
      if (recordHistory) {
        historyRef.current.push(clean);
        syncHistoryFlags();
      }
    },
    [syncHistoryFlags]
  );

  useEffect(() => {
    const initial = sanitizeHtml(normalizeEmpty(value ?? defaultValue));
    if (editorRef.current) {
      editorRef.current.innerHTML = initial;
    }
    lastHtmlRef.current = initial;
    historyRef.current.reset(initial);
    setIsEmpty(isEditorContentEmpty(initial));
    syncHistoryFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === undefined || !editorRef.current) return;
    const clean = sanitizeHtml(normalizeEmpty(value));
    if (clean !== lastHtmlRef.current) {
      const sel = saveSelection(editorRef.current);
      editorRef.current.innerHTML = clean;
      lastHtmlRef.current = clean;
      setIsEmpty(isEditorContentEmpty(clean));
      selectedImageRef.current = null;
      restoreSelection(sel);
    }
  }, [value]);

  const refreshStates = useCallback(() => {
    if (!editorRef.current) return;
    setStates(getActiveStates(editorRef.current));
  }, []);

  useEffect(() => {
    const onSel = () => {
      if (!editorRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (editorRef.current.contains(sel.anchorNode)) {
        refreshStates();
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [refreshStates]);

  const rememberSelection = useCallback(() => {
    const live = saveSelection(editorRef.current);
    if (live) savedRangeRef.current = live;
  }, []);

  const withSelection = useCallback(
    (fn) => {
      const live = saveSelection(editorRef.current);
      if (live) savedRangeRef.current = live;
      restoreSelection(savedRangeRef.current);
      fn();
      emitChange(readHtml());
      refreshStates();
    },
    [emitChange, readHtml, refreshStates]
  );

  const handleCommand = useCallback(
    (type, value) => {
      if (disabled) return;
      withSelection(() => {
        if (type === 'rtl' || type === 'ltr') {
          setDirection(editorRef.current, type);
        } else {
          applyFormat(editorRef.current, type, value, {
            selectedImage: selectedImageRef.current,
          });
        }
      });
    },
    [disabled, withSelection]
  );

  const handleBlockChange = useCallback(
    (tag) => {
      if (disabled) return;
      withSelection(() => {
        applyFormat(editorRef.current, 'formatBlock', tag);
      });
    },
    [disabled, withSelection]
  );

  const handleUndo = useCallback(() => {
    const html = historyRef.current.undo();
    if (html == null || !editorRef.current) return;
    editorRef.current.innerHTML = html;
    lastHtmlRef.current = html;
    setIsEmpty(isEditorContentEmpty(html));
    selectedImageRef.current = null;
    syncHistoryFlags();
    onChange?.(html);
    refreshStates();
  }, [onChange, refreshStates, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const html = historyRef.current.redo();
    if (html == null || !editorRef.current) return;
    editorRef.current.innerHTML = html;
    lastHtmlRef.current = html;
    setIsEmpty(isEditorContentEmpty(html));
    selectedImageRef.current = null;
    syncHistoryFlags();
    onChange?.(html);
    refreshStates();
  }, [onChange, refreshStates, syncHistoryFlags]);

  const handleInput = useCallback(() => {
    if (composingRef.current) return;
    emitChange(readHtml());
    refreshStates();
  }, [emitChange, readHtml, refreshStates]);

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      const html = e.clipboardData?.getData('text/html');
      if (html) {
        const clean = sanitizeHtml(html);
        document.execCommand('insertHTML', false, clean);
      } else {
        document.execCommand('insertText', false, text);
      }
      emitChange(readHtml());
    },
    [emitChange, readHtml]
  );

  const handleKeyDown = useCallback(
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        mod &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleCommand('bold');
      } else if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleCommand('italic');
      } else if (e.key === 'Escape' && selectedImageRef.current) {
        clearImageSelection(editorRef.current);
        selectedImageRef.current = null;
        refreshStates();
      } else if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        (selectedImageRef.current || editorRef.current?.querySelector('.te-figure.is-selected'))
      ) {
        e.preventDefault();
        if (removeSelectedImage(editorRef.current)) {
          selectedImageRef.current = null;
          emitChange(readHtml());
          refreshStates();
        }
      }
    },
    [emitChange, handleCommand, handleRedo, handleUndo, readHtml, refreshStates, fullscreen]
  );

  const openAltEditor = useCallback((img) => {
    if (!img) return;
    selectedImageRef.current = img;
    setAltDraft(img.getAttribute('alt') || '');
    setAltOpen(true);
  }, []);

  const openImageLinkEditor = useCallback((img) => {
    if (!img) return;
    selectedImageRef.current = img;
    const info = getImageLinkInfo(img);
    setImageLinkDraft({ mode: info.mode, href: info.href });
    setImageLinkOpen(true);
  }, []);

  const closeImageLinkDialog = useCallback(() => setImageLinkOpen(false), []);

  const clearLinkPopover = useCallback(() => {
    if (linkPopoverHideTimerRef.current) {
      clearTimeout(linkPopoverHideTimerRef.current);
      linkPopoverHideTimerRef.current = null;
    }
    linkPopoverHoverRef.current = false;
    linkPopoverAnchorRef.current = null;
    setLinkPopover(null);
  }, []);

  const cancelHideLinkPopover = useCallback(() => {
    if (linkPopoverHideTimerRef.current) {
      clearTimeout(linkPopoverHideTimerRef.current);
      linkPopoverHideTimerRef.current = null;
    }
  }, []);

  const scheduleHideLinkPopover = useCallback(() => {
    cancelHideLinkPopover();
    linkPopoverHideTimerRef.current = window.setTimeout(() => {
      if (!linkPopoverHoverRef.current) {
        linkPopoverAnchorRef.current = null;
        setLinkPopover(null);
      }
    }, 160);
  }, [cancelHideLinkPopover]);

  const showLinkPopover = useCallback(
    (anchor) => {
      const shell = rootRef.current?.querySelector('.te-editor-shell');
      if (!shell) return;

      const href = anchor.getAttribute('href') || '';
      if (!href) {
        clearLinkPopover();
        return;
      }

      linkPopoverAnchorRef.current = anchor;
      const shellRect = shell.getBoundingClientRect();
      const rect = anchor.getBoundingClientRect();
      const pad = 8;
      const estWidth = 132;
      const anchorCenter = rect.left - shellRect.left + rect.width / 2;
      let left = anchorCenter - estWidth / 2;
      left = Math.max(pad, Math.min(shellRect.width - estWidth - pad, left));

      setLinkPopover({
        url: href,
        top: rect.bottom - shellRect.top + 6,
        left,
      });
    },
    [clearLinkPopover]
  );

  const handlePopoverMouseEnter = useCallback(() => {
    linkPopoverHoverRef.current = true;
    cancelHideLinkPopover();
  }, [cancelHideLinkPopover]);

  const handlePopoverMouseLeave = useCallback(() => {
    linkPopoverHoverRef.current = false;
    scheduleHideLinkPopover();
  }, [scheduleHideLinkPopover]);

  const openLinkEditor = useCallback(
    (anchor) => {
      if (!anchor) return;
      linkEditAnchorRef.current = anchor;
      setLinkEditing(true);
      setLinkDraft({
        url: anchor.getAttribute('href') || '',
        text: anchor.textContent || '',
      });
      clearLinkPopover();
      setLinkOpen(true);
    },
    [clearLinkPopover]
  );

  const openCtaEditor = useCallback(
    (anchor) => {
      if (!anchor) return;
      ctaEditAnchorRef.current = anchor;
      setCtaEditing(true);
      setCtaDraft({
        url: anchor.getAttribute('href') || '',
        text: anchor.textContent || '',
        classes: anchor.getAttribute('class') || '',
      });
      clearLinkPopover();
      setCtaOpen(true);
    },
    [clearLinkPopover]
  );

  const handlePopoverEdit = useCallback(() => {
    const anchor = linkPopoverAnchorRef.current;
    if (!anchor) return;
    if (isCtaAnchor(anchor)) {
      openCtaEditor(anchor);
      return;
    }
    openLinkEditor(anchor);
  }, [openLinkEditor, openCtaEditor]);

  const handlePopoverUnlink = useCallback(() => {
    const anchor = linkPopoverAnchorRef.current;
    if (!anchor || !editorRef.current) return;
    removeLinkAt(editorRef.current, anchor);
    emitChange(readHtml());
    refreshStates();
    clearLinkPopover();
  }, [emitChange, readHtml, refreshStates, clearLinkPopover]);

  const closeLinkDialog = useCallback(() => {
    setLinkOpen(false);
    setLinkEditing(false);
    linkEditAnchorRef.current = null;
  }, []);

  const closeCtaDialog = useCallback(() => {
    setCtaOpen(false);
    setCtaEditing(false);
    ctaEditAnchorRef.current = null;
  }, []);

  const closeImageDialog = useCallback(() => setImageOpen(false), []);
  const closeAltDialog = useCallback(() => setAltOpen(false), []);
  const closeMarkdownDialog = useCallback(() => setMarkdownOpen(false), []);

  const handleEditorMouseMove = useCallback(
    (e) => {
      if (sourceMode || disabled || linkOpen || ctaOpen) return;

      const target = e.target;
      if (!(target instanceof Element)) {
        scheduleHideLinkPopover();
        return;
      }

      if (target.closest('.te-link-popover')) return;

      const anchor = target.closest('a[href]');
      if (!anchor || !editorRef.current?.contains(anchor) || anchor.classList.contains('te-figure__link')) {
        scheduleHideLinkPopover();
        return;
      }

      cancelHideLinkPopover();
      if (linkPopoverAnchorRef.current === anchor) return;
      showLinkPopover(anchor);
    },
    [
      sourceMode,
      disabled,
      linkOpen,
      ctaOpen,
      scheduleHideLinkPopover,
      cancelHideLinkPopover,
      showLinkPopover,
    ]
  );

  const handleEditorMouseLeave = useCallback(() => {
    scheduleHideLinkPopover();
  }, [scheduleHideLinkPopover]);

  const handleEditorScroll = useCallback(() => {
    closeTableMenu();
    const anchor = linkPopoverAnchorRef.current;
    if (!anchor) return;
    showLinkPopover(anchor);
  }, [closeTableMenu, showLinkPopover]);

  const handleEditorContextMenu = useCallback(
    (e) => {
      if (sourceMode || disabled) return;

      const target = e.target;
      if (!(target instanceof Element)) return;

      const cell = target.closest('th, td');
      if (!cell || !editorRef.current?.contains(cell)) return;

      e.preventDefault();
      e.stopPropagation();
      clearLinkPopover();

      const shell = rootRef.current?.querySelector('.te-editor-shell');
      if (!shell) return;

      const shellRect = shell.getBoundingClientRect();
      const pad = 8;
      const menuWidth = 220;
      const menuHeight = 320;

      let left = e.clientX - shellRect.left;
      let top = e.clientY - shellRect.top;
      left = Math.max(pad, Math.min(shellRect.width - menuWidth - pad, left));
      top = Math.max(pad, Math.min(shellRect.height - menuHeight - pad, top));

      tableMenuCellRef.current = cell;
      setTableMenu({ top, left });
    },
    [sourceMode, disabled, clearLinkPopover]
  );

  const handleTableMenuAction = useCallback(
    (action) => {
      const cell = tableMenuCellRef.current;
      if (!cell || !editorRef.current?.contains(cell)) {
        closeTableMenu();
        return;
      }
      if (tableCommand(editorRef.current, action, cell)) {
        emitChange(readHtml(), { recordHistory: true });
        refreshStates();
      }
      closeTableMenu();
    },
    [closeTableMenu, emitChange, readHtml, refreshStates]
  );

  const finishImageInsert = useCallback(
    async (img) => {
      if (!img || !editorRef.current) return;
      await whenImageReady(img);
      selectImage(img, editorRef.current, messagesRef.current);
      selectedImageRef.current = img;
      emitChange(readHtml());
      refreshStates();
    },
    [emitChange, readHtml, refreshStates]
  );

  const handleEditorPointerDown = useCallback(
    (e) => {
      const target = e.target;
      if (!(target instanceof Element) || !editorRef.current) return;

      if (target.closest('.te-figure__resize-handle')) {
        e.preventDefault();
        e.stopPropagation();
        const figure = target.closest('.te-figure');
        const img = figure?.querySelector('img');
        if (img && editorRef.current) {
          startImageResize(img, e, {
            editor: editorRef.current,
            onComplete: () => {
              emitChange(readHtml());
              if (img.isConnected && editorRef.current?.contains(img)) {
                selectImage(img, editorRef.current, messagesRef.current);
                selectedImageRef.current = img;
              }
              refreshStates();
            },
          });
        }
        return;
      }

      // Link edit button on selected figure
      if (target.closest('.te-figure__link-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const figure = target.closest('.te-figure');
        const img = figure?.querySelector('img');
        if (img) openImageLinkEditor(img);
        return;
      }

      // Alt edit button on selected figure
      if (target.closest('.te-figure__alt-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const figure = target.closest('.te-figure');
        const img = figure?.querySelector('img');
        if (img) openAltEditor(img);
        return;
      }

      const img = target.closest('img');
      const figure = target.closest('.te-figure');

      if (img && editorRef.current.contains(img)) {
        e.preventDefault();
        selectImage(img, editorRef.current, messagesRef.current);
        selectedImageRef.current = img;
        savedRangeRef.current = saveSelection(editorRef.current);
        refreshStates();
        return;
      }

      if (figure && editorRef.current.contains(figure)) {
        const innerImg = figure.querySelector('img');
        if (innerImg) {
          e.preventDefault();
          selectImage(innerImg, editorRef.current, messagesRef.current);
          selectedImageRef.current = innerImg;
          savedRangeRef.current = saveSelection(editorRef.current);
          refreshStates();
          return;
        }
      }

      if (selectedImageRef.current) {
        clearImageSelection(editorRef.current);
        selectedImageRef.current = null;
        refreshStates();
      }

      const anchor = target.closest('a[href]');
      if (anchor && editorRef.current.contains(anchor)) {
        e.preventDefault();
      }
    },
    [emitChange, openAltEditor, openImageLinkEditor, readHtml, refreshStates]
  );

  const handleEditorMouseDown = handleEditorPointerDown;

  const handleEditorDoubleClick = useCallback(
    (e) => {
      const target = e.target;
      if (!(target instanceof Element) || !editorRef.current) return;
      const img = target.closest('img');
      const figure = target.closest('.te-figure');
      const image = img || figure?.querySelector('img');
      if (image && editorRef.current.contains(image)) {
        e.preventDefault();
        const linkInfo = getImageLinkInfo(image);
        if (linkInfo.mode === IMAGE_LINK_LIGHTBOX) {
          setLightboxSrc(linkInfo.href || image.getAttribute('src') || image.src);
          return;
        }
        selectImage(image, editorRef.current, messagesRef.current);
        openAltEditor(image);
      }
    },
    [openAltEditor]
  );

  const openCta = useCallback(() => {
    rememberSelection();
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection(savedRangeRef.current);
    const ctaInfo = getCtaAtSelection(editor, savedRangeRef.current);
    if (ctaInfo) {
      openCtaEditor(ctaInfo.element);
      return;
    }

    setCtaEditing(false);
    ctaEditAnchorRef.current = null;
    setCtaDraft({
      url: '',
      text: getRangeText(savedRangeRef.current),
      classes: '',
    });
    setCtaOpen(true);
  }, [rememberSelection, openCtaEditor]);

  const openLink = useCallback(() => {
    rememberSelection();
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection(savedRangeRef.current);
    const ctaInfo = getCtaAtSelection(editor, savedRangeRef.current);
    if (ctaInfo) {
      openCtaEditor(ctaInfo.element);
      return;
    }

    const linkInfo = getLinkAtSelection(editor, savedRangeRef.current);
    if (linkInfo) {
      openLinkEditor(linkInfo.element);
      return;
    }

    setLinkEditing(false);
    linkEditAnchorRef.current = null;
    setLinkDraft({
      url: '',
      text: getRangeText(savedRangeRef.current),
    });
    setLinkOpen(true);
  }, [rememberSelection, openCtaEditor, openLinkEditor]);

  const openImage = useCallback(() => {
    rememberSelection();
    setImageOpen(true);
  }, [rememberSelection]);

  const openMarkdown = useCallback(() => {
    rememberSelection();
    setMarkdownOpen(true);
  }, [rememberSelection]);

  const handleMarkdownSubmit = useCallback(
    (markdown) => {
      const html = markdownToHtml(markdown);
      if (!html) return;

      if (sourceMode) {
        const next = sourceCode.trim() ? `${sourceCode}\n${html}` : html;
        setSourceCode(next);
        lastHtmlRef.current = sanitizeHtml(normalizeEmpty(next));
        onChange?.(lastHtmlRef.current);
        return;
      }

      withSelection(() => {
        document.execCommand('insertHTML', false, html);
      });
    },
    [sourceMode, sourceCode, withSelection, onChange]
  );

  const toggleSourceMode = useCallback(() => {
    if (disabled) return;

    if (!sourceMode) {
      // Visual → HTML
      clearLinkPopover();
      clearImageSelection(editorRef.current);
      selectedImageRef.current = null;
      const html = sanitizeHtml(stripSelectionClasses(readHtml()));
      setSourceCode(html);
      setSourceMode(true);
      return;
    }

    // HTML → Visual (sanitize user-edited source)
    const clean = sanitizeHtml(normalizeEmpty(sourceCode));
    if (editorRef.current) {
      editorRef.current.innerHTML = clean;
    }
    lastHtmlRef.current = clean;
    setIsEmpty(isEditorContentEmpty(clean));
    historyRef.current.push(clean);
    syncHistoryFlags();
    onChange?.(clean);
    setSourceMode(false);
    refreshStates();
  }, [
    disabled,
    sourceMode,
    sourceCode,
    readHtml,
    onChange,
    syncHistoryFlags,
    refreshStates,
    clearLinkPopover,
  ]);

  const handleSourceChange = useCallback((code) => {
    setSourceCode(code);
  }, []);

  const handleSourceBlur = useCallback(() => {
    // Keep parent in sync while editing source (sanitized lightly on leave)
    const clean = sanitizeHtml(normalizeEmpty(sourceCode));
    lastHtmlRef.current = clean;
    onChange?.(clean);
  }, [sourceCode, onChange]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((v) => !v);
  }, []);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getHTML: () => sanitizeHtml(stripSelectionClasses(readHtml())),
    setHTML: (html) => {
      setHtml(html, { recordHistory: true });
      onChange?.(sanitizeHtml(normalizeEmpty(html)));
    },
    clear: () => {
      setHtml('<p><br></p>', { recordHistory: true });
      onChange?.(sanitizeHtml('<p><br></p>'));
    },
    getEditorElement: () => editorRef.current,
  }));

  return (
    <div
      ref={rootRef}
      className={`te-root${disabled ? ' is-disabled' : ''}${sourceMode ? ' is-source' : ''}${fullscreen ? ' is-fullscreen' : ''}${noscroll ? ' te-root--noscroll' : ''} te-root--${resolvedDir} ${className}`.trim()}
      style={style}
      dir={resolvedDir}
      lang={lang}
      onMouseDown={(e) => {
        if (e.target.closest?.('.te-toolbar')) {
          rememberSelection();
        }
      }}
    >
      {toolbar ? (
        <Toolbar
          t={t}
          states={states}
          canUndo={canUndo}
          canRedo={canRedo}
          onCommand={handleCommand}
          onBlockChange={handleBlockChange}
          onOpenLink={openLink}
          onOpenCta={openCta}
          onOpenImage={openImage}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onRememberSelection={rememberSelection}
          sourceMode={sourceMode}
          onToggleSource={toggleSourceMode}
          onOpenMarkdown={openMarkdown}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      ) : null}

      <div className="te-editor-shell">
        {!sourceMode && isEmpty ? (
          <div className="te-placeholder">{resolvedPlaceholder}</div>
        ) : null}

        <div
          ref={editorRef}
          className="te-editor"
          contentEditable={!disabled && !sourceMode}
          role="textbox"
          aria-multiline="true"
          aria-label={t.editorLabel}
          aria-placeholder={resolvedPlaceholder}
          aria-hidden={sourceMode}
          suppressContentEditableWarning
          style={{ minHeight, display: sourceMode ? 'none' : undefined }}
          dir={resolvedDir}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onMouseDown={handleEditorMouseDown}
          onPointerDown={handleEditorPointerDown}
          onMouseMove={handleEditorMouseMove}
          onMouseLeave={handleEditorMouseLeave}
          onScroll={handleEditorScroll}
          onContextMenu={handleEditorContextMenu}
          onDoubleClick={handleEditorDoubleClick}
          onBlur={() => {
            if (!sourceMode) emitChange(readHtml(), { recordHistory: true });
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            handleInput();
          }}
          onMouseUp={refreshStates}
          onKeyUp={refreshStates}
        />

        {sourceMode ? (
          <SourceEditor
            value={sourceCode}
            onChange={handleSourceChange}
            onBlur={handleSourceBlur}
            disabled={disabled}
            minHeight={minHeight}
            noscroll={noscroll}
            ariaLabel={t.sourceLabel}
          />
        ) : null}

        {tableMenu && !sourceMode ? (
          <TableContextMenu
            top={tableMenu.top}
            left={tableMenu.left}
            t={t}
            onAction={handleTableMenuAction}
            onClose={closeTableMenu}
          />
        ) : null}

        {linkPopover && !sourceMode && !linkOpen && !ctaOpen ? (
          <LinkPopover
            url={linkPopover.url}
            top={linkPopover.top}
            left={linkPopover.left}
            t={t}
            onEdit={handlePopoverEdit}
            onUnlink={handlePopoverUnlink}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handlePopoverMouseLeave}
          />
        ) : null}

        <a
          className="te-credit"
          href={NPM_PACKAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          powered by TeemEditor v.{TEEM_EDITOR_VERSION}
        </a>
      </div>

      <LinkDialog
        open={linkOpen && !sourceMode}
        onClose={closeLinkDialog}
        initialUrl={linkDraft.url}
        initialText={linkDraft.text}
        isEdit={linkEditing}
        t={t}
        onSubmit={({ url, text }) => {
          withSelection(() => {
            const anchor = linkEditAnchorRef.current;
            if (linkEditing && anchor && editorRef.current?.contains(anchor)) {
              updateLink(editorRef.current, anchor, url, text, messagesRef.current);
            } else {
              insertLink(editorRef.current, url, text, messagesRef.current);
            }
          });
          closeLinkDialog();
        }}
      />

      <CtaDialog
        open={ctaOpen && !sourceMode}
        onClose={closeCtaDialog}
        initialUrl={ctaDraft.url}
        initialText={ctaDraft.text}
        initialClasses={ctaDraft.classes}
        isEdit={ctaEditing}
        t={t}
        onSubmit={({ url, text, classes }) => {
          withSelection(() => {
            const anchor = ctaEditAnchorRef.current;
            if (ctaEditing && anchor && editorRef.current?.contains(anchor)) {
              updateCta(editorRef.current, anchor, url, text, classes, messagesRef.current);
            } else {
              insertCta(editorRef.current, url, text, classes, messagesRef.current);
            }
          });
          closeCtaDialog();
        }}
      />

      <ImageDialog
        open={imageOpen && !sourceMode}
        onClose={closeImageDialog}
        t={t}
        onSubmitUrl={async ({ url, alt, link }) => {
          rememberSelection();
          restoreSelection(savedRangeRef.current);
          const resolvedLink = await resolveImageLink(link);
          const img = insertImage(
            editorRef.current,
            url,
            alt,
            resolvedLink,
            messagesRef.current
          );
          closeImageDialog();
          await finishImageInsert(img);
        }}
        onSubmitFile={async ({ file, alt, link }) => {
          const src = await processImageUpload(file, {
            ...uploadOptions,
            onUpload,
            language: lang,
            messages: messagesRef.current,
          });
          rememberSelection();
          restoreSelection(savedRangeRef.current);
          const resolvedLink = await resolveImageLink(link);
          const img = insertImage(
            editorRef.current,
            src,
            alt,
            resolvedLink,
            messagesRef.current
          );
          closeImageDialog();
          await finishImageInsert(img);
        }}
      />

      <ImageLinkDialog
        open={imageLinkOpen && !sourceMode}
        onClose={closeImageLinkDialog}
        initialMode={imageLinkDraft.mode}
        initialUrl={imageLinkDraft.href}
        t={t}
        onSubmit={async (link) => {
          const img = selectedImageRef.current;
          if (!img || !editorRef.current?.contains(img)) return;
          const resolvedLink = await resolveImageLink(link);
          updateImageLink(img, resolvedLink, messagesRef.current);
          emitChange(readHtml());
          refreshStates();
        }}
      />

      <ImageAltDialog
        open={altOpen && !sourceMode}
        initialAlt={altDraft}
        onClose={closeAltDialog}
        t={t}
        onSubmit={({ alt }) => {
          const img = selectedImageRef.current;
          if (!img || !editorRef.current?.contains(img)) return;
          updateImageAlt(img, alt, messagesRef.current);
          emitChange(readHtml());
          refreshStates();
        }}
      />

      <MarkdownDialog
        open={markdownOpen}
        onClose={closeMarkdownDialog}
        t={t}
        onSubmit={handleMarkdownSubmit}
      />

      {lightboxSrc ? (
        <div
          className="te-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t.imageLinkLightbox}
          onMouseDown={() => setLightboxSrc(null)}
        >
          <div className="te-lightbox" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="te-lightbox__close"
              onClick={() => setLightboxSrc(null)}
              aria-label={t.close}
            >
              ×
            </button>
            <img src={lightboxSrc} alt="" />
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default TeemEditor;
