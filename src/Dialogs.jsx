import { useEffect, useId, useRef, useState } from 'react';
import { Icons } from './icons.jsx';

export function Modal({ open, title, onClose, children, footer, closeLabel = 'Close' }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);

    const prev = document.activeElement;
    panelRef.current?.querySelector('input,button,textarea,select')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onClose]);

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

export function LinkDialog({
  open,
  onClose,
  onSubmit,
  initialUrl = '',
  initialText = '',
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
      title={t.linkTitle}
      onClose={onClose}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" className="te-btn te-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form="te-link-form" className="te-btn te-btn--primary">
            {t.linkSubmit}
          </button>
        </>
      }
    >
      <form id="te-link-form" onSubmit={handleSubmit} className="te-form">
        <label className="te-field">
          <span>{t.linkUrl}</span>
          <input
            type="url"
            dir="ltr"
            placeholder="https://example.com"
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTab('file');
      setUrl('');
      setAlt('');
      setError('');
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  const handleUrl = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmitUrl({ url: url.trim(), alt: alt.trim() });
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
      await onSubmitFile({ file, alt: alt.trim() });
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
          {error ? <p className="te-error">{error}</p> : null}
        </form>
      )}
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
