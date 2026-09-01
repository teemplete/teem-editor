import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { html } from '@codemirror/lang-html';
import { indentWithTab } from '@codemirror/commands';
import { EditorView, keymap } from '@codemirror/view';

const teSourceDarkTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#0f172a',
    foreground: '#e2e8f0',
    caret: '#e2e8f0',
    selection: 'rgba(45, 212, 191, 0.28)',
    selectionMatch: 'rgba(45, 212, 191, 0.18)',
    lineHighlight: 'transparent',
    gutterBackground: '#0b1220',
    gutterForeground: '#64748b',
    gutterActiveForeground: '#94a3b8',
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: '13px',
  },
  styles: [
    { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
    { tag: t.meta, color: '#64748b' },
    { tag: t.keyword, color: '#c4b5fd' },
    { tag: [t.tagName, t.typeName], color: '#f472b6' },
    { tag: [t.propertyName, t.attributeName], color: '#7dd3fc' },
    { tag: [t.string, t.special(t.string)], color: '#86efac' },
    { tag: [t.number, t.bool, t.null], color: '#fcd34d' },
    { tag: [t.angleBracket, t.bracket], color: '#94a3b8' },
    { tag: [t.operator, t.punctuation], color: '#cbd5e1' },
    { tag: t.className, color: '#fbbf24' },
    { tag: t.invalid, color: '#fca5a5' },
  ],
});

const teSourceLayout = EditorView.baseTheme({
  '&, &.cm-focused': {
    outline: 'none',
    boxShadow: 'none',
  },
  '.cm-content, .cm-scroller, .cm-line': {
    outline: 'none',
  },
  '.cm-content': {
    padding: '16px 18px 28px',
  },
  '.cm-gutters': {
    border: 'none',
    paddingRight: '4px',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'transparent',
    outline: 'none',
  },
});

export function SourceEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  minHeight = 220,
  noscroll = false,
  ariaLabel,
}) {
  const extensions = useMemo(
    () => [
      html(),
      keymap.of([indentWithTab]),
      teSourceLayout,
      EditorView.lineWrapping,
      EditorView.editable.of(!disabled),
      EditorView.domEventHandlers({
        blur: () => {
          onBlur?.();
          return false;
        },
      }),
    ],
    [disabled, onBlur]
  );

  return (
    <div
      className={`te-source${noscroll ? '' : ' te-source--scroll'}`}
      style={{ minHeight }}
    >
      <CodeMirror
        value={value}
        height="100%"
        minHeight={`${minHeight}px`}
        theme={teSourceDarkTheme}
        extensions={extensions}
        onChange={onChange}
        editable={!disabled}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          indentOnInput: true,
        }}
        aria-label={ariaLabel}
        dir="ltr"
      />
    </div>
  );
}
