import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { Icons } from './icons.jsx';

export function Modal({ open, title, onClose, children, footer, closeLabel = 'Close' }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    const prev = document.activeElement;
    panelRef.current?.querySelector('input,button,textarea,select')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="te-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="te-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="te-modal__header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="te-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            {Icons.close}
          </button>
        </div>
        <div className="te-modal__body">{children}</div>
        {footer ? <div className="te-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function CtaDialog({
  open,
  onClose,
  onSubmit,
  initialUrl = '',
  initialText = '',
  initialClasses = '',
  isEdit = false,
  t,
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [classes, setClasses] = useState(initialClasses);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
      setClasses(initialClasses);
      setError('');
    }
  }, [open, initialUrl, initialText, initialClasses]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedText = text.trim();
    if (!trimmedUrl) {
      setError(t.ctaUrlRequired);
      return;
    }
    if (!trimmedText) {
      setError(t.ctaTextRequired);
      return;
    }
    try {
      onSubmit({ url: trimmedUrl, text: trimmedText, classes: classes.trim() });
      onClose();
    } catch (err) {
      setError(err.message || t.ctaInvalid);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t.ctaEditTitle : t.ctaTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form="te-cta-form" className="te-btn te-btn--primary">
            {isEdit ? t.save : t.ctaSubmit}
          </button>
        </>
      }
    >
      <form id="te-cta-form" onSubmit={handleSubmit} className="te-form">
        <label className="te-field">
          <span>{t.ctaUrl}</span>
          <input
            type="text"
            dir="ltr"
            placeholder="https://example.com or /about"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <label className="te-field">
          <span>{t.ctaText}</span>
          <input
            type="text"
            placeholder={t.ctaTextPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </label>
        <label className="te-field">
          <span>{t.ctaClasses}</span>
          <input
            type="text"
            dir="ltr"
            placeholder={t.ctaClassesPlaceholder}
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
          />
        </label>
        <p className="te-hint">{t.ctaClassesHint}</p>
        {error ? <p className="te-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

export function LinkDialog({
  open,
  onClose,
  onSubmit,
  initialUrl = '',
  initialText = '',
  isEdit = false,
  t,
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
      setError('');
    }
  }, [open, initialUrl, initialText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t.linkUrlRequired);
      return;
    }
    try {
      onSubmit({ url: trimmed, text: text.trim() });
      onClose();
    } catch (err) {
      setError(err.message || t.linkInvalid);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t.linkEditTitle : t.linkTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form="te-link-form" className="te-btn te-btn--primary">
            {isEdit ? t.save : t.linkSubmit}
          </button>
        </>
      }
    >
      <form id="te-link-form" onSubmit={handleSubmit} className="te-form">
        <label className="te-field">
          <span>{t.linkUrl}</span>
          <input
            type="text"
            dir="ltr"
            placeholder="https://example.com or /about"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <label className="te-field">
          <span>{t.linkText}</span>
          <input
            type="text"
            placeholder={t.linkTextPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {error ? <p className="te-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

const TABLE_MENU_ITEMS = [
  { action: 'insertRowAbove', labelKey: 'tableInsertRowAbove', icon: 'plus' },
  { action: 'insertRowBelow', labelKey: 'tableInsertRowBelow', icon: 'plus' },
  { action: 'insertColumnLeft', labelKey: 'tableInsertColumnLeft', icon: 'plus' },
  { action: 'insertColumnRight', labelKey: 'tableInsertColumnRight', icon: 'plus' },
  { action: 'deleteRow', labelKey: 'tableDeleteRow', icon: 'trash', danger: true },
  { action: 'deleteColumn', labelKey: 'tableDeleteColumn', icon: 'trash', danger: true },
  { action: 'deleteTable', labelKey: 'tableDeleteTable', icon: 'trash', danger: true },
];

export function TableContextMenu({ top, left, t, onAction, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) onClose?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="te-table-menu"
      style={{ top, left }}
      role="menu"
      aria-label={t.tableMenuLabel}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {TABLE_MENU_ITEMS.map((item, index) => (
        <Fragment key={item.action}>
          {index === 4 ? <div className="te-table-menu__divider" aria-hidden="true" /> : null}
          <button
            type="button"
            className={`te-table-menu__item${item.danger ? ' te-table-menu__item--danger' : ''}`}
            role="menuitem"
            onClick={() => onAction(item.action)}
          >
            <span className="te-table-menu__icon" aria-hidden="true">
              {Icons[item.icon]}
            </span>
            <span>{t[item.labelKey]}</span>
          </button>
        </Fragment>
      ))}
    </div>
  );
}

export function LinkPopover({
  url,
  top,
  left,
  t,
  onEdit,
  onUnlink,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <div
      className="te-link-popover"
      style={{ top, left }}
      role="dialog"
      aria-label={t.linkPopoverLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="te-link-popover__url" dir="ltr" title={url}>
        {url}
      </div>
      <div className="te-link-popover__actions">
        <button
          type="button"
          className="te-link-popover__btn"
          onClick={onEdit}
          aria-label={t.linkEdit}
          title={t.linkEdit}
        >
          {Icons.edit}
        </button>
        <button
          type="button"
          className="te-link-popover__btn te-link-popover__btn--danger"
          onClick={onUnlink}
          aria-label={t.removeLink}
          title={t.removeLink}
        >
          {Icons.unlink}
        </button>
      </div>
    </div>
  );
}

export function ImageLinkFields({ t, mode, onModeChange, url, onUrlChange }) {
  return (
    <fieldset className="te-fieldset">
      <legend>{t.imageLinkTitle}</legend>
      <label className="te-field">
        <span>{t.imageLinkMode}</span>
        <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
          <option value="none">{t.imageLinkNone}</option>
          <option value="url">{t.imageLinkUrl}</option>
          <option value="file">{t.imageLinkFile}</option>
          <option value="lightbox">{t.imageLinkLightbox}</option>
        </select>
      </label>
      {mode === 'url' ? (
        <label className="te-field">
          <span>{t.imageLinkUrlLabel}</span>
          <input
            type="text"
            dir="ltr"
            placeholder="https://example.com or /about"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </label>
      ) : null}
      {mode === 'file' ? <p className="te-hint">{t.imageLinkFileHint}</p> : null}
      {mode === 'lightbox' ? <p className="te-hint">{t.imageLinkLightboxHint}</p> : null}
    </fieldset>
  );
}

export function ImageDialog({
  open,
  onClose,
  onSubmitUrl,
  onSubmitFile,
  accept = 'image/jpeg,image/png,image/gif,image/webp',
  t,
}) {
  const [tab, setTab] = useState('file');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [linkMode, setLinkMode] = useState('none');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTab('file');
      setUrl('');
      setAlt('');
      setLinkMode('none');
      setLinkUrl('');
      setError('');
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  const buildLinkPayload = () => {
    if (linkMode === 'none') return { mode: 'none', href: '' };
    if (linkMode === 'lightbox') return { mode: 'lightbox', href: '' };
    if (linkMode === 'url') {
      const trimmed = linkUrl.trim();
      if (!trimmed) throw new Error(t.imageLinkUrlRequired);
      return { mode: 'url', href: trimmed };
    }
    return { mode: 'file', href: '' };
  };

  const handleUrl = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const link = buildLinkPayload();
      await onSubmitUrl({ url: url.trim(), alt: alt.trim(), link });
      onClose();
    } catch (err) {
      setError(err.message || t.imageInsertFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t.imagePickFile);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const link = buildLinkPayload();
      await onSubmitFile({ file, alt: alt.trim(), link });
      onClose();
    } catch (err) {
      setError(err.message || t.imageUploadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t.imageTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="submit"
            form={tab === 'file' ? 'te-image-file-form' : 'te-image-url-form'}
            className="te-btn te-btn--primary"
            disabled={busy}
          >
            {busy ? t.imageBusy : t.imageSubmit}
          </button>
        </>
      }
    >
      <div className="te-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'file'}
          className={tab === 'file' ? 'is-active' : ''}
          onClick={() => setTab('file')}
        >
          {t.imageUploadTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'url'}
          className={tab === 'url' ? 'is-active' : ''}
          onClick={() => setTab('url')}
        >
          {t.imageUrlTab}
        </button>
      </div>

      {tab === 'file' ? (
        <form id="te-image-file-form" onSubmit={handleFile} className="te-form">
          <label className="te-field">
            <span>{t.imageFile}</span>
            <input ref={fileRef} type="file" accept={accept} />
          </label>
          <label className="te-field">
            <span>{t.imageAlt}</span>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={t.imageAltPlaceholder}
            />
          </label>
          <ImageLinkFields
            t={t}
            mode={linkMode}
            onModeChange={setLinkMode}
            url={linkUrl}
            onUrlChange={setLinkUrl}
          />
          <p className="te-hint">{t.imageHint}</p>
          {error ? <p className="te-error">{error}</p> : null}
        </form>
      ) : (
        <form id="te-image-url-form" onSubmit={handleUrl} className="te-form">
          <label className="te-field">
            <span>{t.imageUrl}</span>
            <input
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          <label className="te-field">
            <span>{t.imageAlt}</span>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={t.imageAltPlaceholder}
            />
          </label>
          <ImageLinkFields
            t={t}
            mode={linkMode}
            onModeChange={setLinkMode}
            url={linkUrl}
            onUrlChange={setLinkUrl}
          />
          {error ? <p className="te-error">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

export function ImageLinkDialog({
  open,
  onClose,
  onSubmit,
  initialMode = 'none',
  initialUrl = '',
  t,
}) {
  const [mode, setMode] = useState(initialMode);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setUrl(initialUrl);
      setError('');
      setBusy(false);
    }
  }, [open, initialMode, initialUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'none') {
        await onSubmit({ mode: 'none', href: '' });
        onClose();
        return;
      }
      if (mode === 'lightbox' || mode === 'file') {
        await onSubmit({ mode, href: '' });
        onClose();
        return;
      }
      if (mode === 'url') {
        const trimmed = url.trim();
        if (!trimmed) {
          setError(t.imageLinkUrlRequired);
          return;
        }
        await onSubmit({ mode: 'url', href: trimmed });
        onClose();
        return;
      }
    } catch (err) {
      setError(err.message || t.imageLinkInvalid);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t.imageLinkTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="submit"
            form="te-image-link-form"
            className="te-btn te-btn--primary"
            disabled={busy}
          >
            {busy ? t.imageBusy : t.save}
          </button>
        </>
      }
    >
      <form id="te-image-link-form" onSubmit={handleSubmit} className="te-form">
        <ImageLinkFields
          t={t}
          mode={mode}
          onModeChange={setMode}
          url={url}
          onUrlChange={setUrl}
        />
        {error ? <p className="te-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

export function ImageAltDialog({ open, onClose, onSubmit, initialAlt = '', t }) {
  const [alt, setAlt] = useState(initialAlt);

  useEffect(() => {
    if (open) setAlt(initialAlt);
  }, [open, initialAlt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ alt: alt.trim() });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t.altTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form="te-image-alt-form" className="te-btn te-btn--primary">
            {t.save}
          </button>
        </>
      }
    >
      <form id="te-image-alt-form" onSubmit={handleSubmit} className="te-form">
        <label className="te-field">
          <span>{t.altLabel}</span>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder={t.altPlaceholder}
          />
        </label>
        <p className="te-hint">{t.altHint}</p>
      </form>
    </Modal>
  );
}

export function MarkdownDialog({ open, onClose, onSubmit, t }) {
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMarkdown('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = markdown.trim();
    if (!trimmed) {
      setError(t.markdownEmpty);
      return;
    }
    try {
      onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err.message || t.markdownFailed);
    }
  };

  return (
    <Modal
      open={open}
      title={t.markdownTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form="te-markdown-form" className="te-btn te-btn--primary">
            {t.markdownSubmit}
          </button>
        </>
      }
    >
      <form id="te-markdown-form" onSubmit={handleSubmit} className="te-form">
        <label className="te-field">
          <span>{t.markdownLabel}</span>
          <textarea
            className="te-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={t.markdownPlaceholder}
            rows={10}
            dir="auto"
            spellCheck={false}
          />
        </label>
        <p className="te-hint">{t.markdownHint}</p>
        {error ? <p className="te-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
