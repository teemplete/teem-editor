import { useEffect, useRef, useState } from 'react';
import { Icons } from './icons.jsx';
import { getBlockOptions } from './i18n.js';

const TEXT_COLORS = [
  '#111827',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ffffff',
];

const BG_COLORS = [
  'transparent',
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#fecaca',
  '#e9d5ff',
  '#fed7aa',
  '#e5e7eb',
  '#111827',
];

function ToolButton({ label, active, disabled, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      className={`te-tool${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={!!active}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="te-toolbar__divider" aria-hidden="true" />;
}

function ColorSplitButton({
  label,
  icon,
  colors,
  value,
  onChange,
  onRememberSelection,
  allowTransparent = false,
  disabled = false,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const rootRef = useRef(null);
  const pickingCustomRef = useRef(false);
  const activeColor = preview ?? value;
  const underline =
    !activeColor || activeColor === 'transparent'
      ? allowTransparent
        ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px'
        : '#111827'
      : activeColor;

  useEffect(() => {
    if (!open || disabled) {
      setPreview(null);
      if (disabled) setOpen(false);
      return undefined;
    }

    const onDoc = (e) => {
      if (pickingCustomRef.current) return;
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && !pickingCustomRef.current) setOpen(false);
    };
    const onWindowFocus = () => {
      window.setTimeout(() => {
        pickingCustomRef.current = false;
      }, 50);
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [open, disabled]);

  const apply = (color, { close = true } = {}) => {
    if (disabled) return;
    onRememberSelection?.();
    onChange(color);
    setPreview(null);
    if (close) setOpen(false);
  };

  return (
    <div className={`te-color${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <div className="te-color__split">
        <button
          type="button"
          className="te-tool te-color__apply"
          title={`${label} — ${t.applyCurrentColor}`}
          aria-label={`${label} — ${t.applyCurrentColor}`}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            onRememberSelection?.();
            onChange(value);
          }}
        >
          <span className="te-color__icon">{icon}</span>
          <span
            className="te-color__bar"
            style={{ background: underline }}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className={`te-tool te-color__caret${open ? ' is-active' : ''}`}
          title={`${t.openPalette}: ${label}`}
          aria-label={`${t.openPalette}: ${label}`}
          aria-expanded={open}
          aria-haspopup="true"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            onRememberSelection?.();
            setOpen((v) => !v);
          }}
        >
          {Icons.chevronDown}
        </button>
      </div>

      {open && !disabled ? (
        <div
          className="te-color__swatches"
          role="group"
          aria-label={label}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className={`te-swatch${value === c ? ' is-selected' : ''}`}
              style={{
                background:
                  c === 'transparent'
                    ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                    : c,
                borderColor: c === '#ffffff' ? '#d1d5db' : undefined,
              }}
              title={c === 'transparent' ? t.noColor : c}
              aria-label={c === 'transparent' ? t.noColor : c}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                apply(c);
              }}
            />
          ))}
          <label
            className="te-swatch te-swatch--picker"
            title={t.customColor}
            onMouseDown={(e) => {
              e.stopPropagation();
              pickingCustomRef.current = true;
              onRememberSelection?.();
            }}
          >
            <input
              type="color"
              value={activeColor && activeColor !== 'transparent' ? activeColor : '#111827'}
              onMouseDown={(e) => {
                e.stopPropagation();
                pickingCustomRef.current = true;
              }}
              onClick={(e) => {
                e.stopPropagation();
                pickingCustomRef.current = true;
              }}
              onInput={(e) => {
                setPreview(e.target.value);
              }}
              onChange={(e) => {
                apply(e.target.value, { close: false });
                pickingCustomRef.current = false;
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  pickingCustomRef.current = false;
                  setPreview(null);
                }, 50);
              }}
              aria-label={`${t.pickCustomColor}: ${label}`}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function Toolbar({
  t,
  states,
  canUndo,
  canRedo,
  onCommand,
  onBlockChange,
  onOpenLink,
  onOpenImage,
  onUndo,
  onRedo,
  onRememberSelection,
  sourceMode = false,
  onToggleSource,
}) {
  const [textColor, setTextColor] = useState('#111827');
  const [bgColor, setBgColor] = useState('#fef08a');
  const formattingDisabled = sourceMode;
  const blockOptions = getBlockOptions(t);

  return (
    <div className="te-toolbar" role="toolbar" aria-label={t.toolbar}>
      <div className="te-toolbar__group">
        <ToolButton label={t.undo} disabled={formattingDisabled || !canUndo} onClick={onUndo}>
          {Icons.undo}
        </ToolButton>
        <ToolButton label={t.redo} disabled={formattingDisabled || !canRedo} onClick={onRedo}>
          {Icons.redo}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <label className="te-select-wrap">
          <span className="te-sr-only">{t.blockType}</span>
          <select
            className="te-select"
            value={states.format || 'p'}
            disabled={formattingDisabled}
            onChange={(e) => onBlockChange(e.target.value)}
            onMouseDown={(e) => {
              e.stopPropagation();
              onRememberSelection?.();
            }}
          >
            {blockOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton
          label={t.bold}
          active={states.bold}
          disabled={formattingDisabled}
          onClick={() => onCommand('bold')}
        >
          {Icons.bold}
        </ToolButton>
        <ToolButton
          label={t.italic}
          active={states.italic}
          disabled={formattingDisabled}
          onClick={() => onCommand('italic')}
        >
          {Icons.italic}
        </ToolButton>
        <ToolButton
          label={t.strike}
          active={states.strikeThrough}
          disabled={formattingDisabled}
          onClick={() => onCommand('strikeThrough')}
        >
          {Icons.strike}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton
          label={t.bulletList}
          active={states.unorderedList}
          disabled={formattingDisabled}
          onClick={() => onCommand('insertUnorderedList')}
        >
          {Icons.ul}
        </ToolButton>
        <ToolButton
          label={t.numberedList}
          active={states.orderedList}
          disabled={formattingDisabled}
          onClick={() => onCommand('insertOrderedList')}
        >
          {Icons.ol}
        </ToolButton>
        <ToolButton
          label={t.quote}
          active={states.format === 'blockquote'}
          disabled={formattingDisabled}
          onClick={() =>
            onBlockChange(states.format === 'blockquote' ? 'p' : 'blockquote')
          }
        >
          {Icons.quote}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton
          label={states.hasSelectedImage ? t.alignImageRight : t.alignRight}
          active={states.justifyRight}
          disabled={formattingDisabled}
          onClick={() => onCommand('justifyRight')}
        >
          {Icons.alignRight}
        </ToolButton>
        <ToolButton
          label={states.hasSelectedImage ? t.alignImageCenter : t.alignCenter}
          active={states.justifyCenter}
          disabled={formattingDisabled}
          onClick={() => onCommand('justifyCenter')}
        >
          {Icons.alignCenter}
        </ToolButton>
        <ToolButton
          label={states.hasSelectedImage ? t.alignImageLeft : t.alignLeft}
          active={states.justifyLeft}
          disabled={formattingDisabled}
          onClick={() => onCommand('justifyLeft')}
        >
          {Icons.alignLeft}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton label={t.rtl} disabled={formattingDisabled} onClick={() => onCommand('rtl')}>
          {Icons.rtl}
        </ToolButton>
        <ToolButton label={t.ltr} disabled={formattingDisabled} onClick={() => onCommand('ltr')}>
          {Icons.ltr}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton
          label={t.indent}
          className="te-tool--indent"
          disabled={formattingDisabled}
          onClick={() => onCommand('indent')}
        >
          {Icons.indent}
        </ToolButton>
        <ToolButton
          label={t.outdent}
          className="te-tool--outdent"
          disabled={formattingDisabled}
          onClick={() => onCommand('outdent')}
        >
          {Icons.outdent}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton label={t.insertLink} disabled={formattingDisabled} onClick={onOpenLink}>
          {Icons.link}
        </ToolButton>
        <ToolButton label={t.insertImage} disabled={formattingDisabled} onClick={onOpenImage}>
          {Icons.image}
        </ToolButton>
        <ToolButton
          label={t.horizontalRule}
          disabled={formattingDisabled}
          onClick={() => onCommand('insertHorizontalRule')}
        >
          {Icons.hr}
        </ToolButton>
      </div>

      <Divider />

      <div className="te-toolbar__group te-toolbar__colors">
        <ColorSplitButton
          label={t.textColor}
          icon={Icons.textColor}
          colors={TEXT_COLORS}
          value={textColor}
          disabled={formattingDisabled}
          t={t}
          onRememberSelection={onRememberSelection}
          onChange={(color) => {
            setTextColor(color);
            onCommand('foreColor', color);
          }}
        />
        <ColorSplitButton
          label={t.bgColor}
          icon={Icons.bgColor}
          colors={BG_COLORS}
          value={bgColor}
          allowTransparent
          disabled={formattingDisabled}
          t={t}
          onRememberSelection={onRememberSelection}
          onChange={(color) => {
            setBgColor(color);
            onCommand('hiliteColor', color);
          }}
        />
      </div>

      <Divider />

      <div className="te-toolbar__group">
        <ToolButton
          label={sourceMode ? t.visualMode : t.sourceMode}
          active={sourceMode}
          onClick={onToggleSource}
        >
          {Icons.code}
        </ToolButton>
      </div>
    </div>
  );
}
