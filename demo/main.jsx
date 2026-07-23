import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TeemEditor } from '../src/index.js';

function App() {
  const [html, setHtml] = useState(
    '<p>Hello! This is a <strong>rich text</strong> editor.</p>'
  );
  const [language, setLanguage] = useState('en');

  return (
    <div className="page">
      <h1>TeemEditor</h1>
      <p className="lead">
        Simple, fast WYSIWYG for React and Next.js — full RTL for Persian and
        Arabic, plus English and other LTR languages.
      </p>

      <label className="lang">
        Language{' '}
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="fa">فارسی</option>
          <option value="ar">العربية</option>
        </select>
      </label>

      <TeemEditor
        language={language}
        value={html}
        onChange={setHtml}
        onUpload={async (file) => URL.createObjectURL(file)}
      />

      <div className="preview">
        <h2>HTML output (demo only — not part of the package)</h2>
        <pre>{html}</pre>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
