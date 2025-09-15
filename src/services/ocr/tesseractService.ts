import { OCRFile, OCRResult, Settings } from '@/types';
import * as UTIF from 'utif';

const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;

export async function processWithTesseract(files: OCRFile[], settings: Settings): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    const tess = await import('tesseract.js');
    const { createWorker } = tess as any;
    const PSM = (tess as any).PSM || { AUTO: 3, SINGLE_COLUMN: 4 };

    // Choose language pack: force Amharic or multilingual
    // Prefer Amharic first to bias toward Ethiopic glyphs, but keep English for mixed content
    const lang = settings.forceAmharic ? 'amh' : 'amh+eng';

    for (const file of files) {
        try {
            const base64 = await getDataUrl(file);
            const normalized = await ensureNonTiffImage(base64);
            const preprocessed = await preprocessImage(normalized);
            const worker: any = await createWorker();
            try {
                await worker.load();
                await worker.loadLanguage(lang);
                await worker.initialize(lang);
                await worker.setParameters({
                    tessedit_pageseg_mode: String(PSM.SINGLE_COLUMN),
                    tessedit_ocr_engine_mode: '1',
                    preserve_interword_spaces: '1',
                    user_defined_dpi: '300',
                    ...((settings.forceAmharic || settings.strictAmharic) ? { tessedit_char_blacklist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' } : {}),
                });
            } catch (initErr) {
                console.error('Tesseract worker init failed for', file.name, initErr);
                throw initErr;
            }
            const imgBlob = await (await fetch(preprocessed)).blob();
            const start = performance.now();
            const { data } = await worker.recognize(imgBlob);
            const end = performance.now();
            await worker.terminate();

            let text = (data?.text || '').trim();
            const density = ethiopicDensity(text);

            // If Amharic seems under-recognized but content likely Ethiopic, retry with amh only and a different PSM
            if ((settings.forceAmharic || density.ethChars > 10) && density.ratio < 0.6) {
                try {
                    const worker2: any = await createWorker();
                    try {
                        await worker2.load();
                        await worker2.loadLanguage('amh');
                        await worker2.initialize('amh');
                        await worker2.setParameters({
                            tessedit_pageseg_mode: '6', // SINGLE_BLOCK
                            tessedit_ocr_engine_mode: '1',
                            preserve_interword_spaces: '1',
                            user_defined_dpi: '300',
                            ...((settings.forceAmharic || settings.strictAmharic) ? { tessedit_char_blacklist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' } : {}),
                        });
                        const { data: data2 } = await worker2.recognize(imgBlob);
                        const text2 = (data2?.text || '').trim();
                        const d2 = ethiopicDensity(text2);
                        if (d2.ratio > density.ratio * 1.1 || d2.ethChars > density.ethChars) {
                            text = text2;
                        }
                    } finally {
                        try { await worker2.terminate(); } catch { }
                    }
                } catch { /* ignore second-pass failures */ }
            }
            const detectedLanguage = settings.forceAmharic ? 'am' : (ETH_RE.test(text) ? 'am' : 'en');
            const result: OCRResult = {
                id: `tess-${Date.now()}-${Math.random()}`,
                fileId: file.id,
                extractedText: text,
                layoutPreserved: text,
                detectedLanguage,
                confidence: 0.8,
                documentType: 'Unknown',
                processingTime: Math.round(end - start),
                layoutAnalysis: {
                    textBlocks: text ? 1 : 0,
                    tables: 0,
                    images: 0,
                    columns: 1,
                    complexity: 'medium',
                    structure: [],
                },
                metadata: {
                    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
                    characterCount: text.length,
                    pageCount: 1,
                    engine: 'tesseract',
                },
            };
            results.push(result);
        } catch (e) {
            const msg = (e instanceof Error) ? e.message : (typeof e === 'string' ? e : 'Unknown error (likely unsupported image format).');
            console.error('Tesseract processing failed for', file.name, msg);
            // Push an empty/error-like result to keep UX consistent
            results.push({
                id: `tess-${Date.now()}-${Math.random()}`,
                fileId: file.id,
                extractedText: '',
                layoutPreserved: '',
                detectedLanguage: settings.forceAmharic ? 'am' : 'unknown',
                confidence: 0.2,
                documentType: 'Unknown',
                processingTime: 0,
                layoutAnalysis: { textBlocks: 0, tables: 0, images: 0, columns: 1, complexity: 'low', structure: [] },
                metadata: { wordCount: 0, characterCount: 0, pageCount: 1, engine: 'tesseract' },
            });
        }
    }

    return results;
}

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}

async function getDataUrl(file: OCRFile): Promise<string> {
    const anyFile: any = (file as any).file;
    if (anyFile && typeof File !== 'undefined' && anyFile instanceof File) {
        return fileToBase64(anyFile);
    }
    if (file.preview && file.preview.startsWith('data:')) return file.preview;
    throw new Error('No source data available for OCR (file or preview missing).');
}

// Convert TIFF data URLs to PNG for browser compatibility
async function ensureNonTiffImage(dataUrl: string): Promise<string> {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    const header = dataUrl.slice(0, dataUrl.indexOf(','));
    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
    const mime = mimeMatch ? mimeMatch[1] : '';
    if (!/image\/(tiff|x-tiff)/i.test(mime)) return dataUrl;

    try {
        const rgbaInfo = tiffDataUrlToRgba(dataUrl);
        return rgbaToPngDataUrl(rgbaInfo.rgba, rgbaInfo.width, rgbaInfo.height);
    } catch (e) {
        console.error('TIFF conversion failed for Tesseract:', e);
        throw new Error('Unsupported TIFF image; please convert to PNG/JPEG.');
    }
}

function tiffDataUrlToRgba(dataUrl: string): { rgba: Uint8Array; width: number; height: number } {
    const u8 = base64DataUrlToUint8Array(dataUrl);
    const ifds = UTIF.decode(u8);
    if (!ifds || !ifds.length) throw new Error('No IFDs found in TIFF');
    const first = ifds[0];
    UTIF.decodeImage(u8, first);
    const rgba = UTIF.toRGBA8(first);
    const { width, height } = first as any;
    if (!rgba || !width || !height) throw new Error('Failed to decode TIFF RGBA');
    return { rgba, width, height };
}

function base64DataUrlToUint8Array(dataUrl: string): Uint8Array {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) throw new Error('Malformed data URL');
    const b64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function rgbaToPngDataUrl(rgba: Uint8Array, width: number, height: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

// Lightweight client-side preprocessing: scale up, grayscale, slight contrast + brightness boost
async function preprocessImage(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const maxW = 2000;
    const scale = Math.min(2, img.width ? Math.max(1, maxW / img.width) : 1.5);
    const w = Math.round((img.width || 1200) * scale);
    const h = Math.round((img.height || 1600) * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img as any, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const contrast = 40; // -255..255
    const brightness = 10; // -255..255
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    // First pass: grayscale + contrast
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let y = 0.299 * r + 0.587 * g + 0.114 * b;
        y = factor * (y - 128) + 128 + brightness;
        const v = Math.max(0, Math.min(255, y));
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    // Quick Otsu-like binarization (approximate): compute mean and threshold
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i];
    const mean = sum / (d.length / 4);
    const threshold = Math.max(120, Math.min(180, mean));
    for (let i = 0; i < d.length; i += 4) {
        const v = d[i] > threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function ethiopicDensity(text: string): { ethChars: number; total: number; ratio: number } {
    const total = text.length || 1;
    let ethChars = 0;
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (
            (code >= 0x1200 && code <= 0x137F) ||
            (code >= 0x1380 && code <= 0x139F) ||
            (code >= 0x2D80 && code <= 0x2DDF)
        ) ethChars++;
    }
    return { ethChars, total, ratio: ethChars / total };
}
