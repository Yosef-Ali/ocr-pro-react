// Hyphenation registry and simple Amharic heuristic fallback.
// Real Amharic hyphenation patterns (TeX style) can be plugged in later.
// Export a uniform interface.

export type HyphenateFn = (word: string) => string[];

// Enhanced Amharic syllabic boundary detection with better text flow
// Split at syllable boundaries and respect word-internal structure
const amharicSyllableBoundary = /(?=[ሀሁሂሃሄህሆለሉሊላሌልሎመሙሚማሜምሞሠሡሢሣሤሥሦረሩሪራሬርሮሰሱሲሳሴስሶሸሹሺሻሼሽሾበቡቢባቤብቦተቱቲታቴትቶቸቹቺቻቼችቾኘኙኚኛኜኝኞየዩዪያዬይዮዘዙዚዛዜዝዞደዱዲዳዴድዶ])/;

function hyphenateAm(word: string): string[] {
    if (word.length < 6) return [word];
    // Avoid splitting very short, numeric, or punctuation-heavy tokens
    if (/^[0-9፣፤፥፦፧፨፩-፱]+$/.test(word)) return [word];
    if (/^[፡፣፤፥፦፧፨፡።]+$/.test(word)) return [word];
    
    // Split at syllable boundaries
    const pieces = word.split(amharicSyllableBoundary).filter(Boolean);
    if (pieces.length <= 1) return [word];
    
    // Group short syllables together for better readability
    const grouped: string[] = [];
    let current = '';
    
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const candidate = current + piece;
        
        // If current segment is getting too long, flush it
        if (current && candidate.length > 8) {
            grouped.push(current);
            current = piece;
        } else {
            current = candidate;
        }
    }
    
    // Add the final segment
    if (current) {
        grouped.push(current);
    }
    
    // Add hyphens to all but the last segment
    const out: string[] = [];
    for (let i = 0; i < grouped.length; i++) {
        const seg = grouped[i];
        if (i < grouped.length - 1 && seg.length > 2) {
            out.push(seg + '-');
        } else {
            out.push(seg);
        }
    }
    
    return out.length > 1 ? out : [word];
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
