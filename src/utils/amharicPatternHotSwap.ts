import { registerAmharicPatternHyphenator, HyphenateFn } from '@/utils/hyphenation';

// This module attempts to dynamically load an optional Amharic hyphenation dataset.
// Integration Path:
// 1. Drop a JSON file at `public/hyphenation/am-am.json` with format: { "patterns": {...}, "exceptions": ["..."] }
//    matching the shape expected by a TeX pattern adapter (you will write the adapter below).
// 2. Set localStorage key `bookPreview.amPatterns=1` to enable loading.
// 3. Reload the app; this module will fetch and register the improved hyphenator.
// 4. If fetch fails, it quietly falls back to heuristic.

const DATA_URL = '/hyphenation/am-am.json';

let initialized = false;

async function loadPatterns(): Promise<any | null> {
    try {
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function buildHyphenatorFromPatterns(patternData: any): HyphenateFn {
    // Minimal placeholder: real implementation would convert patternData.patterns
    // using a TeX pattern algorithm. For now, just fallback to splitting on provided exceptions
    // or return the whole word untouched.
    const exceptions: Record<string, string[]> = {};
    if (patternData?.exceptions && Array.isArray(patternData.exceptions)) {
        patternData.exceptions.forEach((ex: string) => {
            const parts = ex.split('-');
            exceptions[parts.join('')] = parts;
        });
    }
    return (word: string) => {
        if (word.length < 6) return [word];
        const lower = word.toLowerCase();
        if (exceptions[lower]) {
            const exParts = exceptions[lower];
            return exParts.map((p, i) => i < exParts.length - 1 ? p + '-' : p);
        }
        return [word];
    };
}

export async function initAmharicHyphenHotSwap() {
    if (initialized) return;
    initialized = true;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('bookPreview.amPatterns') !== '1') return;
    const data = await loadPatterns();
    if (!data) {
        console.info('[amharicPatternHotSwap] No pattern dataset found or failed to load. Using heuristic.');
        return;
    }
    const fn = buildHyphenatorFromPatterns(data);
    registerAmharicPatternHyphenator(fn);
    console.info('[amharicPatternHotSwap] Registered Amharic pattern hyphenator (experimental).');
}

// Developer helper: window.__amReloadAmharicHyph() after setting the flag
 
if (typeof window !== 'undefined') (window as any).__amReloadAmharicHyph = async () => {
    initialized = false;
    await initAmharicHyphenHotSwap();
};
