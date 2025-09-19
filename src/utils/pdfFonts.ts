export const ET_RANGE_REGEX = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;

let loaded = false;
let loading: Promise<void> | null = null;
let cachedRegularB64: string | null = null;
let cachedBoldB64: string | null = null;

function toBase64(buf: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    // btoa handles binary strings
    return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

async function fetchWithFallback(urls: string[]): Promise<ArrayBuffer> {
    let lastErr: any;
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.arrayBuffer();
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('Failed to fetch font');
}

export function needsEthiopicFont(text: string): boolean {
    return ET_RANGE_REGEX.test(text);
}

export async function ensureEthiopicFont(doc: any): Promise<void> {
    if (!loaded) {
        if (!loading) {
            loading = (async () => {
                // Try local first (allow user to drop fonts into /public/fonts/)
                const localRegular = '/fonts/NotoSansEthiopic-Regular.ttf';
                const localBold = '/fonts/NotoSansEthiopic-Bold.ttf';

                // Fall back to jsDelivr for Noto Ethiopic TTF
                const cdnRegular = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansEthiopic/NotoSansEthiopic-Regular.ttf';
                const cdnBold = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansEthiopic/NotoSansEthiopic-Bold.ttf';

                try {
                    const [regBuf, boldBuf] = await Promise.all([
                        fetchWithFallback([localRegular, cdnRegular]),
                        fetchWithFallback([localBold, cdnBold]).catch(() => null as any),
                    ]);

                    cachedRegularB64 = toBase64(regBuf);
                    if (boldBuf) {
                        cachedBoldB64 = toBase64(boldBuf);
                    }
                    loaded = true;
                } catch (e) {
                    // If font cannot be loaded, keep default font; Ethiopic may not render.
                    // We intentionally do not throw to avoid breaking export.
                    console.warn('Ethiopic font load failed; falling back to default font', e);
                }
            })();
        }
        await loading;
    }

    if (!cachedRegularB64) return;

    const fontList = doc.getFontList?.() as Record<string, Record<string, string>> | undefined;
    const ethiopicStyles = fontList?.NotoSansEthiopic || {};

    if (!ethiopicStyles.normal) {
        doc.addFileToVFS('NotoSansEthiopic-Regular.ttf', cachedRegularB64);
        doc.addFont('NotoSansEthiopic-Regular.ttf', 'NotoSansEthiopic', 'normal');
    }

    if (cachedBoldB64 && !ethiopicStyles.bold) {
        doc.addFileToVFS('NotoSansEthiopic-Bold.ttf', cachedBoldB64);
        doc.addFont('NotoSansEthiopic-Bold.ttf', 'NotoSansEthiopic', 'bold');
    }
}
