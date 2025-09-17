/**
 * Image processing utilities for OCR processing
 */
import * as UTIF from 'utif';

/**
 * Converts a File object to a base64 data URL.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Converts a data URL to an inline image part for the Gemini API.
 */
export function toInlineImagePartFromDataUrl(dataUrl: string): { inlineData: { data: string; mimeType: string } } {
  // Support blob URLs by fetching to data URL (browser only). Fallback to original if fetch fails.
  if (dataUrl.startsWith('blob:')) {
    // Best-effort conversion: callers in this app store data URLs, so this path is rare.
    throw new Error('Blob URL provided; expected a base64 data URL');
  }
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Provided image is not a data URL');
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) throw new Error('Malformed data URL');
  const header = dataUrl.slice(0, commaIdx); // e.g., data:image/png;base64
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) throw new Error('Data URL must be base64 encoded');
  const mimeType = mimeMatch[1];

  // Basic allowlist; Gemini supports common image types for inlineData
  const allowed = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/bmp'
  ]);
  if (!allowed.has(mimeType)) {
    // Provide a clearer error; PDF and others are not valid for inline image parts
    throw new Error(`Unsupported image type for inline upload: ${mimeType}. Please use JPEG/PNG/WebP/TIFF.`);
  }
  return { inlineData: { data: base64, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType } };
}

const TIFF_PREVIEW_SCALE = 0.25;

/**
 * Converts a TIFF data URL to a PNG data URL if necessary.
 */
export async function ensureNonTiffImage(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  const header = dataUrl.slice(0, dataUrl.indexOf(','));
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mime = mimeMatch ? mimeMatch[1] : '';
  if (!/image\/(tiff|x-tiff)/i.test(mime)) return dataUrl;

  // Convert TIFF data URL to PNG data URL using UTIF + Canvas
  try {
    const u8 = base64DataUrlToUint8Array(dataUrl);
    const ifds = UTIF.decode(u8);
    if (!ifds || !ifds.length) throw new Error('No IFDs found in TIFF');
    const first = ifds[0];
    UTIF.decodeImage(u8, first);
    const rgba = UTIF.toRGBA8(first);
    const { width, height } = first as any;
    if (!rgba || !width || !height) throw new Error('Failed to decode TIFF RGBA');
    const pngDataUrl = rgbaToPngDataUrl(rgba, width, height, TIFF_PREVIEW_SCALE);
    return pngDataUrl;
  } catch (e) {
    console.error('TIFF conversion failed:', e);
    // Let caller fail with unsupported image type, since Gemini won't accept TIFF inline
    throw new Error('Unsupported TIFF for AI Vision; please use JPEG/PNG/WebP');
  }
}

/**
 * Converts a base64 data URL to a Uint8Array.
 */
function base64DataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) throw new Error('Malformed data URL');
  const b64 = dataUrl.slice(commaIdx + 1);
  try {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (e) {
    throw new Error('Failed to decode base64 data URL');
  }
}

/**
 * Converts RGBA pixel data to a PNG data URL using a canvas.
 */
function rgbaToPngDataUrl(rgba: Uint8Array, width: number, height: number, scale = 1): string {
  if (typeof document === 'undefined') throw new Error('Canvas not available in this environment');

  const createCanvas = (w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  };

  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error('Canvas 2D context unavailable');
  const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  sourceCtx.putImageData(imgData, 0, 0);

  if (scale !== 1) {
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const targetCanvas = createCanvas(targetWidth, targetHeight);
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) throw new Error('Canvas 2D context unavailable');
    targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return targetCanvas.toDataURL('image/png');
  }

  return sourceCanvas.toDataURL('image/png');
}
