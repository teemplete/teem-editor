import type { CSSProperties, ReactNode } from 'react';

export type UploadMeta = {
  mime: string;
  safeName: string;
};

export type UploadOptions = {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  onUpload?: (file: File | Blob, meta: UploadMeta) => Promise<string>;
};

export type TeemEditorProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  /** UI language. Default: `en`. Also supports `fa` and `ar`. */
  language?: 'en' | 'fa' | 'ar' | string;
  dir?: 'rtl' | 'ltr';
  className?: string;
  style?: CSSProperties;
  minHeight?: number;
  /** When true, editor grows with content. Default: false (max height = viewport, scroll inside). */
  noscroll?: boolean;
  disabled?: boolean;
  onUpload?: (file: File | Blob, meta: UploadMeta) => Promise<string>;
  uploadOptions?: Omit<UploadOptions, 'onUpload'>;
  toolbar?: boolean;
  children?: ReactNode;
};

export type TeemEditorHandle = {
  focus: () => void;
  getHTML: () => string;
  setHTML: (html: string) => void;
  clear: () => void;
  getEditorElement: () => HTMLDivElement | null;
};

export declare const TeemEditor: React.ForwardRefExoticComponent<
  TeemEditorProps & React.RefAttributes<TeemEditorHandle>
>;

export declare function sanitizeHtml(dirty: string): string;
export declare function flattenStyleSpans(root: ParentNode): void;
export declare function isSafeHref(url: string): boolean;
export declare function isSafeImageSrc(url: string): boolean;

export declare function validateImageFile(
  file: File | Blob,
  options?: UploadOptions
): Promise<{
  ok: boolean;
  errors: string[];
  mime?: string;
  safeName?: string;
}>;

export declare function processImageUpload(
  file: File | Blob,
  options?: UploadOptions
): Promise<string>;

export declare const uploadDefaults: {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
};

export declare function createHistory(limit?: number): {
  push: (html: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  current: () => string | null;
  reset: (html?: string) => void;
};

export declare function getMessages(language?: string): Record<string, any>;
export declare function getDefaultDir(language?: string): 'rtl' | 'ltr';
export declare function resolveLanguage(language?: string): 'en' | 'fa' | 'ar';

export default TeemEditor;
