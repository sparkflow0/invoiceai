export const INVOICE_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const PDF_TOOL_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const ALLOWED_MIME_TYPES = INVOICE_ALLOWED_MIME_TYPES;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
export const PDF_TOOL_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const PDF_TOOL_MAX_PDF_PAGES = 100;
export const DEFAULT_UPLOAD_TTL_MS = 60 * 60 * 1000;

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() || "document";
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  return sanitized || "document";
}

export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

export function getBase64Size(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  if (buffer.slice(0, 4).toString("utf8") === "%PDF") {
    return "application/pdf";
  }

  if (buffer.length >= 3) {
    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (jpeg) return "image/jpeg";
  }

  if (buffer.length >= 8) {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.slice(0, 8).equals(pngSignature)) {
      return "image/png";
    }
  }

  return null;
}

export function hasPdfScripts(buffer: Buffer): boolean {
  const lower = buffer.toString("latin1").toLowerCase();
  return lower.includes("/javascript") || lower.includes("/js");
}
