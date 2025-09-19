import { stripFences } from '@/utils/textUtils';

/**
 * Replace a slice of text between start and end with the given insert string.
 */
export function replaceRange(text: string, start: number, end: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(end);
}

/**
 * Escape a string so it can be safely used inside a RegExp literal.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clean up ASCII noise and italicize quoted Ethiopic segments.
 */
export function cleanupAsciiNoiseAndItalics(input: string): string {
  let out = input;
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
  out = out.replace(/([\u1200-\u137F])[#;:\/\\|`~^*_=+]+([\u1200-\u137F])/g, '$1 $2');
  out = out.replace(/([\u1200-\u137F]+)[a-zA-Z]+([\u1200-\u137F]+)/g, '$1$2');
  out = out.replace(/[!]{2,}/g, '!').replace(/[\?]{2,}/g, '?');
  out = out.replace(/ {2,}/g, ' ');
  out = out.replace(/[“«‘]([^”»’\n]{2,})[”»’]/g, '*$1*');
  return out;
}

/**
 * Lightweight formatter that normalizes simple Markdown headings, lists, and quotes.
 */
export function smartFormatToMarkdown(input: string): string {
  if (!input) return '';
  const lines = input.split(/\r?\n/);
  const cleaned: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let s = lines[i].replace(/^\s*[•◦]\s*/, '- ');
    const t = s.trim();
    if (/^[“«].*[”»]$/.test(t)) {
      const inner = t.replace(/^[“«]\s*/, '').replace(/\s*[”»]$/, '');
      s = `> *${inner}*`;
    } else if (/^[“«]/.test(t)) {
      s = `> ${t}`;
    } else {
      s = s.replace(/[“«‘]([^”»’]{2,})[”»’]/g, '*$1*');
    }
    cleaned.push(s);
  }

  const collapsed: string[] = [];
  for (const line of cleaned) {
    const prev = collapsed[collapsed.length - 1] ?? '';
    if (line.trim() === '' && prev.trim() === '') continue;
    collapsed.push(line);
  }

  const firstIdx = collapsed.findIndex((l) => l.trim() !== '');
  if (firstIdx !== -1) {
    const first = collapsed[firstIdx].trim();
    const nextNonEmptyIdx = collapsed.findIndex((l, idx) => idx > firstIdx && l.trim() !== '');
    const nextNonEmpty = nextNonEmptyIdx >= 0 ? collapsed[nextNonEmptyIdx].trim() : '';

    const short = (s: string, n = 40) => s && s.length <= n;
    const alreadyHeading = /^#{1,6}\s/.test(first);
    if (!alreadyHeading && short(first, 42)) {
      collapsed[firstIdx] = `# ${  first.replace(/^#+\s*/, '')}`;
      if (short(nextNonEmpty, 60) && nextNonEmptyIdx !== -1) {
        const listLike = /^[-*+]\s|^\d+\.|^>\s/.test(nextNonEmpty);
        const isHeading = /^#{1,6}\s/.test(nextNonEmpty);
        if (!listLike && !isHeading) {
          collapsed[nextNonEmptyIdx] = `## ${  nextNonEmpty.replace(/^#+\s*/, '')}`;
        }
      }
    }
  }

  const numbered = collapsed.map((line) => line.replace(/^(\s*)\d+\)\s+/, (_m, g1) => `${g1}1. `));

  const finalLines: string[] = [];
  for (const line of numbered) {
    const prev = finalLines[finalLines.length - 1] ?? '';
    if (line.trim() === '' && prev.trim() === '') continue;
    finalLines.push(line);
  }

  return finalLines.join('\n');
}

/**
 * Remove unintended Latin words for Ethiopic languages but keep punctuation/whitespace.
 */
export function sanitizeProposal(input: string, lang?: string | null): string {
  if (!input) return '';
  const isEth = lang === 'am' || /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(input);
  if (!isEth) return input;

  return input.replace(/(\p{L}[\p{L}\p{M}\p{N}_]*|\p{N}+|\s+|.)/gu, (match) => {
    if (/^[\s]+$/.test(match)) return match;
    if (/^[0-9]+$/.test(match)) return match;
    if (/[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(match)) return match;
    if (/^[A-Za-z]+$/.test(match)) return '';
    return match;
  });
}

export function normalizeMarkdownForReview(input: string, lang?: string | null): string {
  if (!input) return '';
  const withoutFences = stripFences(input).trim();
  const cleaned = cleanupAsciiNoiseAndItalics(withoutFences);
  const sanitized = sanitizeProposal(cleaned, lang);
  const formatted = smartFormatToMarkdown(sanitized);
  return formatted.trim().replace(/\n{3,}/g, '\n\n');
}

export interface OcrError {
  text: string;
  start: number;
  end: number;
  type: 'error';
  reason: string;
  confidence: number;
  suggestion: string;
  id: string;
  action: 'remove' | 'replace';
}

export function detectOCRErrors(text: string): OcrError[] {
  const patterns = [
    { pattern: /\bA\d{3,4}\b/g, reason: 'OCR noise (A+numbers)', confidence: 95 },
    { pattern: /\b\d{3,4}A\s*F\b/g, reason: 'OCR noise fragment', confidence: 95 },
    { pattern: /\bTh\?\b/g, reason: 'Incomplete OCR fragment', confidence: 90 },
    { pattern: /\bAIC\b/g, reason: 'OCR noise (mixed scripts)', confidence: 85 },
    { pattern: /#[\u1200-\u137F]/g, reason: 'ASCII symbol in Amharic', confidence: 90 },
    { pattern: /\b[A-Z]{3,}\b(?=\s*[\u1200-\u137F])/g, reason: 'Latin text mixed with Amharic', confidence: 80 },
  ];

  const errors: OcrError[] = [];

  patterns.forEach((entry, patternIndex) => {
    entry.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = entry.pattern.exec(text)) !== null) {
      const errorText = match[0];
      const suggestion = generateSuggestion(errorText, entry.reason);
      errors.push({
        text: errorText,
        start: match.index,
        end: match.index + errorText.length,
        type: 'error',
        reason: entry.reason,
        confidence: entry.confidence,
        suggestion,
        id: `error-${patternIndex}-${match.index}`,
        action: suggestion === 'Remove' ? 'remove' : 'replace',
      });
      if (entry.pattern.lastIndex === match.index) {
        entry.pattern.lastIndex++;
      }
    }
  });

  return errors.sort((a, b) => b.start - a.start);
}

export function generateSuggestion(text: string, reason: string): string {
  if (reason.includes('noise') || reason.includes('fragment')) {
    return 'Remove';
  }
  if (/[A-Za-z]{3,}/.test(text) && /[\u1200-\u137F]/.test(reason) === false) {
    return 'Remove';
  }
  return text;
}
