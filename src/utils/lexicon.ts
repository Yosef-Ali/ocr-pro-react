// Minimal Amharic lexicon and helpers
// Focus: preserve proper names, places, and common terms that models might "correct"

const BASE_LEXICON: string[] = [
    'ኢትዮጵያ', 'አዲስ አበባ', 'አምላክ', 'ቤተ ክርስቲያን', 'መስቀል',
    'ግዕዝ', 'ትግርኛ', 'አማርኛ', 'ኦርቶዶክስ', 'ካቶሊክ', 'ፕሮቴስታንት',
    'ሰሎሞን', 'ሳባ', 'ሞሴ', 'ዳዊት', 'ኢሳይያስ', 'ኤርምያስ', 'ኢየሱስ',
    'ጥቁር ሃይለ', 'ሃይለ ሥላሴ', 'ሚኒሊክ', 'ተወዳጅ',
];

export function getLexicon(): string[] {
    return BASE_LEXICON;
}

export function containsLexiconTerm(text: string): boolean {
    const terms = getLexicon();
    return terms.some(t => t.length > 1 && text.includes(t));
}

export function buildLexiconHint(): string {
    // Produce a short instruction snippet for prompts
    const sample = getLexicon().slice(0, 12);
    return `Important: Preserve proper names and terms exactly as-is. Do not alter these if present: ${sample.join(', ')} …`;
}

export function stripBadLatinInEthiopic(word: string): string {
    // Remove stray Latin characters within Ethiopic words
    if (/^[\u1200-\u137F]+[A-Za-z]+[\u1200-\u137F]+$/.test(word)) {
        return word.replace(/[A-Za-z]+/g, '');
    }
    return word;
}
