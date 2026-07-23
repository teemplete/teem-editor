import { getMessages } from './i18n.js';

/** Magic-byte signatures for allowed image types */
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  {
    mime: 'image/gif',
    bytes: [0x47, 0x49, 0x46, 0x38],
  },
  {
    mime: 'image/webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50,
  },
];

const DEFAULT_OPTIONS = {
  maxSizeBytes: 2 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
};

function getExtension(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

function sanitizeFileName(name) {
  const base = name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '.')
    .slice(0, 100);
  return base || 'image';
}

async function readMagicBytes(file, length = 16) {
  const slice = file.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function detectMimeFromBytes(bytes) {
  for (const sig of SIGNATURES) {
    if (sig.check) {
      if (sig.check(bytes)) return sig.mime;
    } else if (sig.bytes.every((b, i) => bytes[i] === b)) {
      return sig.mime;
    }
  }
  return null;
}

function resolveMessages(options = {}) {
  return options.messages || getMessages(options.language || 'en');
}

/**
 * Validate an image file before upload.
 * Checks size, extension, claimed MIME, and magic bytes.
 */
export async function validateImageFile(file, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const t = resolveMessages(options);
  const errors = [];

  if (!file || !(file instanceof Blob)) {
    return { ok: false, errors: [t.fileInvalid] };
  }

  if (file.size <= 0) {
    errors.push(t.fileEmpty);
  }

  if (file.size > opts.maxSizeBytes) {
    const mb = (opts.maxSizeBytes / (1024 * 1024)).toFixed(1);
    errors.push(t.fileTooLarge(mb));
  }

  const ext = getExtension(file.name || '');
  if (!opts.allowedExtensions.includes(ext)) {
    errors.push(t.fileBadExtension);
  }

  const claimed = (file.type || '').toLowerCase();
  if (claimed && !opts.allowedMimeTypes.includes(claimed)) {
    errors.push(t.fileBadMime);
  }

  let detected = null;
  try {
    const bytes = await readMagicBytes(file);
    detected = detectMimeFromBytes(bytes);
    if (!detected) {
      errors.push(t.fileBadContent);
    } else if (
      claimed &&
      claimed !== detected &&
      !(claimed === 'image/jpg' && detected === 'image/jpeg')
    ) {
      errors.push(t.fileMimeMismatch);
    }
  } catch {
    errors.push(t.fileReadError);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    mime: detected || claimed,
    safeName: sanitizeFileName(file.name || `image${ext}`),
    errors: [],
  };
}

function fileToDataUrl(file, mime) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        reject(new Error('Failed to encode image.'));
        return;
      }
      // Normalize MIME from validated magic bytes when possible
      if (mime && result.startsWith('data:')) {
        const comma = result.indexOf(',');
        if (comma !== -1) {
          resolve(`data:${mime};base64,${result.slice(comma + 1)}`);
          return;
        }
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Secure image insert pipeline:
 * 1) validate file
 * 2) call optional onUpload(file) → url
 * 3) otherwise embed as base64 data URL
 */
export async function processImageUpload(file, options = {}) {
  const t = resolveMessages(options);
  const validation = await validateImageFile(file, options);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  if (typeof options.onUpload === 'function') {
    const result = await options.onUpload(file, {
      mime: validation.mime,
      safeName: validation.safeName,
    });

    if (!result || typeof result !== 'string') {
      throw new Error(t.imageUploadFailed);
    }

    return result;
  }

  try {
    return await fileToDataUrl(file, validation.mime);
  } catch {
    throw new Error(t.fileReadError);
  }
}

export { DEFAULT_OPTIONS as uploadDefaults };
