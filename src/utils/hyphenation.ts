// Hyphenation registry and simple Amharic heuristic fallback.
// Real Amharic hyphenation patterns (TeX style) can be plugged in later.
// Export a uniform interface.

export type HyphenateFn = (word: string) => string[];

// Basic Amharic syllabic boundary heuristic: split between base + diacritic forms
// This is simplistic and should be replaced when a proper pattern set is available.
const amharicBoundary = /(?=[ሀ-ቍቐ-ኰኲ-ዐዑ-ዕዠ-ፚ])/; // broad Ethiopic range split lookahead

function hyphenateAm(word: string): string[] {
    if (word.length < 8) return [word];
    // Avoid splitting very short or numeric tokens
    if (/^[0-9]+$/.test(word)) return [word];
    const pieces = word.split(amharicBoundary).filter(Boolean);
    if (pieces.length <= 1) return [word];
    const out: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
        const seg = pieces[i];
        if (i < pieces.length - 1) out.push(seg + '-'); else out.push(seg);
    }
    return out;
}

// Placeholder for future TeX pattern integration
let externalAmharicPatternHyphenator: HyphenateFn | null = null;
export function registerAmharicPatternHyphenator(fn: HyphenateFn) { externalAmharicPatternHyphenator = fn; }

export function getHyphenator(lang: string, defaultFn: HyphenateFn): HyphenateFn {
    if (!lang) return defaultFn;
    const norm = lang.toLowerCase();
    if (norm.startsWith('am') || norm.startsWith('amh')) {
        if (externalAmharicPatternHyphenator) return externalAmharicPatternHyphenator;
        return hyphenateAm;
    }
    return defaultFn;
}
