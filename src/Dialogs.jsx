import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

  const modal = (
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

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

export function LinkTargetFields({
  t,
  openInNewTab,
  onOpenInNewTabChange,
  nofollow,
  onNofollowChange,
}) {
  return (
    <div className="te-link-target-fields">
      <label className="te-field te-field--check">
        <input
          type="checkbox"
          checked={openInNewTab}
          onChange={(e) => onOpenInNewTabChange(e.target.checked)}
        />
        <span>{t.linkOpenNewTab}</span>
      </label>
      <label className="te-field te-field--check">
        <input
          type="checkbox"
          checked={nofollow}
          onChange={(e) => onNofollowChange(e.target.checked)}
        />
        <span>{t.linkNofollow}</span>
      </label>
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
  initialOpenInNewTab = false,
  initialNofollow = false,
  isEdit = false,
  t,
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [classes, setClasses] = useState(initialClasses);
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab);
  const [nofollow, setNofollow] = useState(initialNofollow);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
      setClasses(initialClasses);
      setOpenInNewTab(initialOpenInNewTab);
      setNofollow(initialNofollow);
      setError('');
    }
  }, [open, initialUrl, initialText, initialClasses, initialOpenInNewTab, initialNofollow]);

  const confirm = () => {
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
      onSubmit({
        url: trimmedUrl,
        text: trimmedText,
        classes: classes.trim(),
        openInNewTab,
        nofollow,
      });
      onClose();
    } catch (err) {
      setError(err.message || t.ctaInvalid);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    confirm();
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
          <button type="button" className="te-btn te-btn--primary" onClick={confirm}>
            {isEdit ? t.save : t.ctaSubmit}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="te-form">
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
        <LinkTargetFields
          t={t}
          openInNewTab={openInNewTab}
          onOpenInNewTabChange={setOpenInNewTab}
          nofollow={nofollow}
          onNofollowChange={setNofollow}
        />
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
  initialOpenInNewTab = false,
  initialNofollow = false,
  isEdit = false,
  t,
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab);
  const [nofollow, setNofollow] = useState(initialNofollow);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
      setOpenInNewTab(initialOpenInNewTab);
      setNofollow(initialNofollow);
      setError('');
    }
  }, [open, initialUrl, initialText, initialOpenInNewTab, initialNofollow]);

  const confirm = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t.linkUrlRequired);
      return;
    }
    try {
      onSubmit({ url: trimmed, text: text.trim(), openInNewTab, nofollow });
      onClose();
    } catch (err) {
      setError(err.message || t.linkInvalid);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    confirm();
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
          <button type="button" className="te-btn te-btn--primary" onClick={confirm}>
            {isEdit ? t.save : t.linkSubmit}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="te-form">
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
        <LinkTargetFields
          t={t}
          openInNewTab={openInNewTab}
          onOpenInNewTabChange={setOpenInNewTab}
          nofollow={nofollow}
          onNofollowChange={setNofollow}
        />
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

const ACCORDION_MENU_ITEMS = [
  { action: 'addItem', labelKey: 'accordionAddItem', icon: 'plus' },
  { action: 'duplicateItem', labelKey: 'accordionDuplicateItem', icon: 'duplicate' },
  { action: 'deleteItem', labelKey: 'accordionDeleteItem', icon: 'trash', danger: true },
];

export function AccordionContextMenu({ top, left, t, onAction, onClose }) {
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
      aria-label={t.accordionMenuLabel}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ACCORDION_MENU_ITEMS.map((item) => (
        <button
          key={item.action}
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
      ))}
    </div>
  );
}

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

export function ImageLinkFields({
  t,
  mode,
  onModeChange,
  url,
  onUrlChange,
  openInNewTab = false,
  onOpenInNewTabChange,
  nofollow = false,
  onNofollowChange,
  allowLightbox = true,
  fileOptionLabel,
  fileHint,
  legend,
}) {
  const showLinkAttrs = mode === 'url' || mode === 'file';

  return (
    <fieldset className="te-fieldset">
      <legend>{legend || t.imageLinkTitle}</legend>
      <label className="te-field">
        <span>{t.imageLinkMode}</span>
        <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
          <option value="none">{t.imageLinkNone}</option>
          <option value="url">{t.imageLinkUrl}</option>
          <option value="file">{fileOptionLabel || t.imageLinkFile}</option>
          {allowLightbox ? <option value="lightbox">{t.imageLinkLightbox}</option> : null}
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
      {mode === 'file' ? <p className="te-hint">{fileHint || t.imageLinkFileHint}</p> : null}
      {mode === 'lightbox' ? <p className="te-hint">{t.imageLinkLightboxHint}</p> : null}
      {showLinkAttrs ? (
        <LinkTargetFields
          t={t}
          openInNewTab={openInNewTab}
          onOpenInNewTabChange={onOpenInNewTabChange}
          nofollow={nofollow}
          onNofollowChange={onNofollowChange}
        />
      ) : null}
    </fieldset>
  );
}

export function ImageDialog({ open, onClose, onSubmitUrl, onSubmitFile, t }) {
  const [kind, setKind] = useState('image');
  const [tab, setTab] = useState('file');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [linkMode, setLinkMode] = useState('none');
  const [linkUrl, setLinkUrl] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [nofollow, setNofollow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const isVideo = kind === 'video';
  const accept = isVideo
    ? 'video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg,.ogv'
    : 'image/jpeg,image/png,image/gif,image/webp';

  useEffect(() => {
    if (open) {
      setKind('image');
      setTab('file');
      setUrl('');
      setAlt('');
      setLinkMode('none');
      setLinkUrl('');
      setOpenInNewTab(false);
      setNofollow(false);
      setError('');
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  const selectKind = (next) => {
    setKind(next);
    setError('');
    if (next === 'video' && linkMode === 'lightbox') setLinkMode('none');
    if (fileRef.current) fileRef.current.value = '';
  };

  const linkFlags = () =>
    linkMode === 'url' || linkMode === 'file'
      ? { openInNewTab, nofollow }
      : { openInNewTab: false, nofollow: false };

  const buildLinkPayload = () => {
    const flags = linkFlags();
    if (linkMode === 'none') return { mode: 'none', href: '', ...flags };
    if (linkMode === 'lightbox') return { mode: 'lightbox', href: '', ...flags };
    if (linkMode === 'url') {
      const trimmed = linkUrl.trim();
      if (!trimmed) throw new Error(t.imageLinkUrlRequired);
      return { mode: 'url', href: trimmed, ...flags };
    }
    return { mode: 'file', href: '', ...flags };
  };

  const confirmUrl = async () => {
    setError('');
    setBusy(true);
    try {
      const link = buildLinkPayload();
      await onSubmitUrl({ kind, url: url.trim(), alt: alt.trim(), link });
      onClose();
    } catch (err) {
      setError(err.message || (isVideo ? t.videoInsertFailed : t.imageInsertFailed));
    } finally {
      setBusy(false);
    }
  };

  const confirmFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(isVideo ? t.videoPickFile : t.imagePickFile);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const link = buildLinkPayload();
      await onSubmitFile({ kind, file, alt: alt.trim(), link });
      onClose();
    } catch (err) {
      setError(err.message || (isVideo ? t.videoUploadFailed : t.imageUploadFailed));
    } finally {
      setBusy(false);
    }
  };

  const handleUrl = async (e) => {
    e.preventDefault();
    await confirmUrl();
  };

  const handleFile = async (e) => {
    e.preventDefault();
    await confirmFile();
  };

  return (
    <Modal
      open={open}
      title={t.mediaTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="te-btn te-btn--primary"
            disabled={busy}
            onClick={() => (tab === 'file' ? confirmFile() : confirmUrl())}
          >
            {busy ? t.imageBusy : isVideo ? t.videoSubmit : t.imageSubmit}
          </button>
        </>
      }
    >
      <div className="te-tabs" role="tablist" aria-label={t.mediaTitle}>
        <button
          type="button"
          role="tab"
          aria-selected={!isVideo}
          className={!isVideo ? 'is-active' : ''}
          onClick={() => selectKind('image')}
        >
          {t.mediaImage}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isVideo}
          className={isVideo ? 'is-active' : ''}
          onClick={() => selectKind('video')}
        >
          {t.mediaVideo}
        </button>
      </div>

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
        <form onSubmit={handleFile} className="te-form">
          <label className="te-field">
            <span>{isVideo ? t.videoFile : t.imageFile}</span>
            <input key={kind} ref={fileRef} type="file" accept={accept} />
          </label>
          {isVideo ? null : (
            <label className="te-field">
              <span>{t.imageAlt}</span>
              <input
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder={t.imageAltPlaceholder}
              />
            </label>
          )}
          <ImageLinkFields
            t={t}
            mode={linkMode}
            onModeChange={setLinkMode}
            url={linkUrl}
            onUrlChange={setLinkUrl}
            openInNewTab={openInNewTab}
            onOpenInNewTabChange={setOpenInNewTab}
            nofollow={nofollow}
            onNofollowChange={setNofollow}
            allowLightbox={!isVideo}
            fileOptionLabel={isVideo ? t.imageLinkFileVideo : t.imageLinkFile}
            fileHint={isVideo ? t.imageLinkFileHintVideo : t.imageLinkFileHint}
            legend={isVideo ? t.videoLinkTitle : t.imageLinkTitle}
          />
          <p className="te-hint">{isVideo ? t.videoHint : t.imageHint}</p>
          {error ? <p className="te-error">{error}</p> : null}
        </form>
      ) : (
        <form onSubmit={handleUrl} className="te-form">
          <label className="te-field">
            <span>{isVideo ? t.videoUrl : t.imageUrl}</span>
            <input
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          {isVideo ? null : (
            <label className="te-field">
              <span>{t.imageAlt}</span>
              <input
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder={t.imageAltPlaceholder}
              />
            </label>
          )}
          <ImageLinkFields
            t={t}
            mode={linkMode}
            onModeChange={setLinkMode}
            url={linkUrl}
            onUrlChange={setLinkUrl}
            openInNewTab={openInNewTab}
            onOpenInNewTabChange={setOpenInNewTab}
            nofollow={nofollow}
            onNofollowChange={setNofollow}
            allowLightbox={!isVideo}
            fileOptionLabel={isVideo ? t.imageLinkFileVideo : t.imageLinkFile}
            fileHint={isVideo ? t.imageLinkFileHintVideo : t.imageLinkFileHint}
            legend={isVideo ? t.videoLinkTitle : t.imageLinkTitle}
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
  initialOpenInNewTab = false,
  initialNofollow = false,
  allowLightbox = true,
  fileOptionLabel,
  fileHint,
  legend,
  title,
  t,
}) {
  const [mode, setMode] = useState(initialMode);
  const [url, setUrl] = useState(initialUrl);
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab);
  const [nofollow, setNofollow] = useState(initialNofollow);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode === 'lightbox' && !allowLightbox ? 'none' : initialMode);
      setUrl(initialUrl);
      setOpenInNewTab(initialOpenInNewTab);
      setNofollow(initialNofollow);
      setError('');
      setBusy(false);
    }
  }, [open, initialMode, initialUrl, initialOpenInNewTab, initialNofollow, allowLightbox]);

  const linkFlags = () =>
    mode === 'url' || mode === 'file'
      ? { openInNewTab, nofollow }
      : { openInNewTab: false, nofollow: false };

  const confirm = async () => {
    setError('');
    setBusy(true);
    try {
      const flags = linkFlags();
      if (mode === 'none') {
        await onSubmit({ mode: 'none', href: '', ...flags });
        onClose();
        return;
      }
      if (mode === 'lightbox' || mode === 'file') {
        await onSubmit({ mode, href: '', ...flags });
        onClose();
        return;
      }
      if (mode === 'url') {
        const trimmed = url.trim();
        if (!trimmed) {
          setError(t.imageLinkUrlRequired);
          return;
        }
        await onSubmit({ mode: 'url', href: trimmed, ...flags });
        onClose();
        return;
      }
    } catch (err) {
      setError(err.message || t.imageLinkInvalid);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await confirm();
  };

  return (
    <Modal
      open={open}
      title={title || t.imageLinkTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="te-btn te-btn--primary"
            disabled={busy}
            onClick={() => confirm()}
          >
            {busy ? t.imageBusy : t.save}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="te-form">
        <ImageLinkFields
          t={t}
          mode={mode}
          onModeChange={setMode}
          url={url}
          onUrlChange={setUrl}
          openInNewTab={openInNewTab}
          onOpenInNewTabChange={setOpenInNewTab}
          nofollow={nofollow}
          onNofollowChange={setNofollow}
          allowLightbox={allowLightbox}
          fileOptionLabel={fileOptionLabel}
          fileHint={fileHint}
          legend={legend}
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

  const confirm = () => {
    onSubmit({ alt: alt.trim() });
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    confirm();
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
          <button type="button" className="te-btn te-btn--primary" onClick={confirm}>
            {t.save}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="te-form">
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

  const confirm = () => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    confirm();
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
          <button type="button" className="te-btn te-btn--primary" onClick={confirm}>
            {t.markdownSubmit}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="te-form">
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
