import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Toolbar } from './Toolbar.jsx';
import { LinkDialog, ImageDialog, ImageAltDialog } from './Dialogs.jsx';
import { sanitizeHtml } from './sanitize.js';
import { processImageUpload } from './upload.js';
import { createHistory } from './history.js';
import { getMessages, getDefaultDir, resolveLanguage } from './i18n.js';
import {
  applyFormat,
  getActiveStates,
  insertImage,
  insertLink,
  restoreSelection,
  saveSelection,
  setDirection,
  selectImage,
  clearImageSelection,
  updateImageAlt,
} from './commands.js';
import './styles.css';

function normalizeEmpty(html) {
  const trimmed = (html || '').trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') {
    return '<p><br></p>';
  }
  return trimmed;
}

function stripSelectionClasses(html) {
  if (typeof document !== 'undefined') {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.te-figure__alt-btn').forEach((el) => el.remove());
    wrap.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
    wrap.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
    return wrap.innerHTML;
  }
  return html
    .replace(/<button[^>]*class="[^"]*te-figure__alt-btn[^"]*"[^>]*>.*?<\/button>/gi, '')
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
  }));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [altDraft, setAltDraft] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceCode, setSourceCode] = useState('');

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const emitChange = useCallback(
    (html, { recordHistory = true } = {}) => {
      const clean = sanitizeHtml(stripSelectionClasses(normalizeEmpty(html)));
      lastHtmlRef.current = clean;
      setIsEmpty(!clean.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());

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
      setIsEmpty(!clean.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
    setIsEmpty(!initial.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
      setIsEmpty(!clean.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
    setIsEmpty(!html.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
    setIsEmpty(!html.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
      }
    },
    [handleCommand, handleRedo, handleUndo, refreshStates]
  );

  const openAltEditor = useCallback((img) => {
    if (!img) return;
    selectedImageRef.current = img;
    setAltDraft(img.getAttribute('alt') || '');
    setAltOpen(true);
  }, []);

  const handleEditorMouseDown = useCallback(
    (e) => {
      const target = e.target;
      if (!(target instanceof Element) || !editorRef.current) return;

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
    },
    [openAltEditor, refreshStates]
  );

  const handleEditorDoubleClick = useCallback(
    (e) => {
      const target = e.target;
      if (!(target instanceof Element) || !editorRef.current) return;
      const img = target.closest('img');
      const figure = target.closest('.te-figure');
      const image = img || figure?.querySelector('img');
      if (image && editorRef.current.contains(image)) {
        e.preventDefault();
        selectImage(image, editorRef.current, messagesRef.current);
        openAltEditor(image);
      }
    },
    [openAltEditor]
  );

  const openLink = useCallback(() => {
    rememberSelection();
    setLinkOpen(true);
  }, [rememberSelection]);

  const openImage = useCallback(() => {
    rememberSelection();
    setImageOpen(true);
  }, [rememberSelection]);

  const toggleSourceMode = useCallback(() => {
    if (disabled) return;

    if (!sourceMode) {
      // Visual → HTML
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
    setIsEmpty(!clean.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim());
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
  ]);

  const handleSourceChange = useCallback((e) => {
    setSourceCode(e.target.value);
  }, []);

  const handleSourceBlur = useCallback(() => {
    // Keep parent in sync while editing source (sanitized lightly on leave)
    const clean = sanitizeHtml(normalizeEmpty(sourceCode));
    lastHtmlRef.current = clean;
    onChange?.(clean);
  }, [sourceCode, onChange]);

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
      className={`te-root${disabled ? ' is-disabled' : ''}${sourceMode ? ' is-source' : ''} te-root--${resolvedDir} ${className}`.trim()}
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
          onOpenImage={openImage}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onRememberSelection={rememberSelection}
          sourceMode={sourceMode}
          onToggleSource={toggleSourceMode}
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
          <textarea
            className="te-source"
            value={sourceCode}
            onChange={handleSourceChange}
            onBlur={handleSourceBlur}
            disabled={disabled}
            spellCheck={false}
            dir="ltr"
            aria-label={t.sourceLabel}
            style={{ minHeight }}
          />
        ) : null}
      </div>

      <LinkDialog
        open={linkOpen && !sourceMode}
        onClose={() => setLinkOpen(false)}
        t={t}
        onSubmit={({ url, text }) => {
          withSelection(() => {
            insertLink(editorRef.current, url, text, messagesRef.current);
          });
        }}
      />

      <ImageDialog
        open={imageOpen && !sourceMode}
        onClose={() => setImageOpen(false)}
        t={t}
        onSubmitUrl={async ({ url, alt }) => {
          withSelection(() => {
            const img = insertImage(editorRef.current, url, alt, messagesRef.current);
            if (img) {
              selectImage(img, editorRef.current, messagesRef.current);
              selectedImageRef.current = img;
            }
          });
        }}
        onSubmitFile={async ({ file, alt }) => {
          const src = await processImageUpload(file, {
            ...uploadOptions,
            onUpload,
            language: lang,
            messages: messagesRef.current,
          });
          withSelection(() => {
            const img = insertImage(editorRef.current, src, alt, messagesRef.current);
            if (img) {
              selectImage(img, editorRef.current, messagesRef.current);
              selectedImageRef.current = img;
            }
          });
        }}
      />

      <ImageAltDialog
        open={altOpen && !sourceMode}
        initialAlt={altDraft}
        onClose={() => setAltOpen(false)}
        t={t}
        onSubmit={({ alt }) => {
          const img = selectedImageRef.current;
          if (!img || !editorRef.current?.contains(img)) return;
          updateImageAlt(img, alt, messagesRef.current);
          emitChange(readHtml());
          refreshStates();
        }}
      />
    </div>
  );
});

export default TeemEditor;
