import React, { useEffect, useRef, useState } from 'react';
import { getHyphenator } from '@/utils/hyphenation';
import { getHypher, isHypherReady } from '@/utils/hypherLoader';
let hypherInstance: any = null; // populated via loader

export interface CanvasBookPreviewPageSpec {
    title?: string;
    content: string;
}

interface CanvasBookPreviewProps {
    pages: CanvasBookPreviewPageSpec[]; // logical chapters/pages (will be re-flowed)
    pageSize: 'A4' | 'A5';
    fontSize: number; // base font size in px
    lineHeight: number; // multiplier
    family?: string;
    columns?: 1 | 2; // number of columns (2 recommended only for A4)
    columnGap?: number; // px gap between columns
    onRender?: (pageCanvases: HTMLCanvasElement[]) => void;
    toc?: { title: string; page: number }[]; // optional TOC entries referencing chapter start pages (1-based after TOC)
    includeTOC?: boolean; // whether to prepend a TOC page
    hyphenLang?: string; // language code for hyphenation (e.g., 'am', 'en')
}

// Simple page dimension map (px) at ~96dpi for on-screen preview (portrait)
const PAGE_DIMENSIONS: Record<'A4' | 'A5', { w: number; h: number }> = {
    A4: { w: 794, h: 1123 }, // approx 210mm x 297mm
    A5: { w: 559, h: 794 },  // approx 148mm x 210mm
};

// Enhanced font configuration for better Amharic rendering
const AMHARIC_FONTS = [
    'Noto Sans Ethiopic',
    'Abyssinica SIL',
    'Nyala',
    'Ebrima',
    'Kefa',
    'system-ui',
    'sans-serif'
];

function getOptimalFont(lang: string, baseFamily: string): string {
    if (lang && (lang.toLowerCase().startsWith('am') || lang.toLowerCase().startsWith('amh'))) {
        return `${AMHARIC_FONTS.join(', ')}, ${baseFamily}`;
    }
    return baseFamily;
}

// Enhanced text measurement for Amharic characters
function measureAmharicText(ctx: CanvasRenderingContext2D, text: string): number {
    const metrics = ctx.measureText(text);
    // Amharic characters can have complex shapes that extend beyond the normal metrics
    // Add a small buffer for more accurate rendering
    const hasAmharic = /[ሀ-፿ᎀ-᎟ⶀ-⷟]/.test(text);
    return hasAmharic ? metrics.width * 1.02 : metrics.width;
}

export interface FlowLine { text: string; isTitle?: boolean; forceBreakAfter?: boolean; }

// Naive hyphenation: if a single word exceeds width, break at approximate syllable boundaries (vowel-consonant) or every 6 chars
export function hyphenateWord(word: string): string[] {
    if (!word) return [];
    if (word.length <= 10) return [word];
    if (hypherInstance) {
        try {
            const parts: string[] = hypherInstance.hyphenate(word);
            if (parts && parts.length > 1) return parts.map((p: string, i: number) => i < parts.length - 1 ? `${p  }-` : p);
        } catch { /* ignore */ }
    }
    return [word];
}

export function flowChaptersToLines(
    chapters: CanvasBookPreviewPageSpec[],
    ctx: CanvasRenderingContext2D,
    maxWidth: number,
    _baseLineHeight: number,
    titleScale: number,
    hyphenateFn: (w: string) => string[] = hyphenateWord,
    _lang?: string
): FlowLine[] {
    const lines: FlowLine[] = [];
    const wrap = (raw: string, isTitle = false) => {
        const words = raw.split(/\s+/).filter(Boolean);
        let current = '';
        const flushCurrent = () => { if (current) { lines.push({ text: current, isTitle }); current = ''; } };
        words.forEach(word => {
            // If word itself is too long, hyphenate (use enhanced measurement for Amharic)
            if (measureAmharicText(ctx, word) > maxWidth) {
                flushCurrent();
                const parts = hyphenateFn(word);
                parts.forEach((part) => {
                    const w = part;
                    if (measureAmharicText(ctx, w) > maxWidth) {
                        // emergency hard slice
                        for (let start = 0; start < w.length; start += 12) {
                            lines.push({ text: w.slice(start, start + 12) + (start + 12 < w.length ? '-' : ''), isTitle });
                        }
                    } else {
                        if (measureAmharicText(ctx, w) > maxWidth) {
                            lines.push({ text: w, isTitle });
                        } else {
                            lines.push({ text: w, isTitle });
                        }
                    }
                });
                return;
            }
            const candidate = current ? `${current  } ${  word}` : word;
            if (measureAmharicText(ctx, candidate) > maxWidth && current) {
                lines.push({ text: current, isTitle });
                current = word;
            } else {
                current = candidate;
            }
        });
        if (current) lines.push({ text: current, isTitle });
    };

    chapters.forEach(ch => {
        if (ch.title) {
            ctx.font = `600 ${Math.round(titleScale * parseInt(ctx.font, 10))}px ${ctx.font.split(' ').slice(-1)}`;
            wrap(ch.title, true);
            ctx.font = ctx.font.replace(/^[0-9]{2,3}px/, `${parseInt(ctx.font, 10)}px`); // restore later anyway
            lines.push({ text: '', isTitle: false }); // spacing
        }
        const paragraphs = ch.content.split(/\n+/);
        paragraphs.forEach((p, i) => {
            ctx.font = ctx.font; // ensure normal weight
            wrap(p, false);
            if (i < paragraphs.length - 1) lines.push({ text: '', isTitle: false });
        });
        lines.push({ text: '', isTitle: false });
    });
    return lines;
}

export const CanvasBookPreview: React.FC<CanvasBookPreviewProps> = ({ pages, pageSize, fontSize, lineHeight, family = 'Inter, system-ui, sans-serif', columns = 1, columnGap = 40, onRender, toc, includeTOC = true, hyphenLang }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hyphenReady, setHyphenReady] = useState(isHypherReady());
    const debugEnabled = typeof window !== 'undefined' && window.localStorage.getItem('bookPreview.debugOverflow') === '1';
    const overflowWordsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let mounted = true;
        if (!isHypherReady()) {
            getHypher().then(inst => { if (inst && mounted) { hypherInstance = inst; setHyphenReady(true); } });
        }
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';
        const dims = PAGE_DIMENSIONS[pageSize];
        const padding = 48; // inner padding px
        const effectiveWidth = dims.w - padding * 2;
        const perColumnWidth = columns === 1 ? effectiveWidth : Math.floor((effectiveWidth - columnGap) / 2);
        const canvases: HTMLCanvasElement[] = [];
        const scratch = document.createElement('canvas');
        const sctx = scratch.getContext('2d');
        if (!sctx) return;
        const optimalFamily = getOptimalFont(hyphenLang || 'en', family);
        sctx.font = `${fontSize}px ${optimalFamily}`;
        const baseLineHeight = Math.round(fontSize * lineHeight);
        const hyphenator = getHyphenator(hyphenLang || 'en', hyphenateWord);
        const trackingHyphenator = (w: string) => {
            const parts = hyphenator(w);
            // Detect unresolved overflow candidates: if single part still exceeds max width
            if (debugEnabled && parts.length === 1) {
                if (measureAmharicText(sctx, w) > perColumnWidth) {
                    overflowWordsRef.current.add(w);
                }
            }
            return parts;
        };
        let lines = flowChaptersToLines(pages, sctx, perColumnWidth, baseLineHeight, 1.35, trackingHyphenator, hyphenLang);
        // Widow/Orphan control (simple): if last page would end with a single line of a chapter after a blank spacer, pull one line from previous
        // This naive approach will scan for isolated single non-empty lines between blank lines and attempt to merge with previous by joining with space
        const adjusted: FlowLine[] = [];
        for (let i = 0; i < lines.length; i++) {
            const prev = lines[i - 1];
            const curr = lines[i];
            const next = lines[i + 1];
            if (curr && curr.text && (!prev || prev.text === '') && next && next.text === '') {
                // treat as orphan line: append to previous block if possible
                if (adjusted.length && adjusted[adjusted.length - 1].text) {
                    adjusted[adjusted.length - 1].text += ` ${  curr.text}`;
                    continue; // skip adding this as separate line
                }
            }
            adjusted.push(curr);
        }
        lines = adjusted;
        let page: HTMLCanvasElement | null = null;
        let ctx: CanvasRenderingContext2D | null = null; // re-assigned per page
        let y = 0;
        let col = 0; // current column index
        const footerSpace = baseLineHeight * 2;
        let pageIndex = 0; // physical page number (will include TOC)

        const newPage = () => {
            page = document.createElement('canvas');
            page.width = dims.w;
            page.height = dims.h;
            ctx = page.getContext('2d');
            if (!ctx) return false;
            // background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, dims.w, dims.h);
            // frame
            ctx.strokeStyle = '#e5e7eb';
            ctx.strokeRect(0.5, 0.5, dims.w - 1, dims.h - 1);
            ctx.fillStyle = '#111827';
            ctx.font = `${fontSize}px ${optimalFamily}`;
            
            // Enhanced text rendering for Amharic
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            
            // Improve text quality for complex scripts
            if (typeof (ctx as any).fontKerning !== 'undefined') {
                (ctx as any).fontKerning = 'normal';
            }
            if (typeof (ctx as any).textRendering !== 'undefined') {
                (ctx as any).textRendering = 'optimizeLegibility';
            }
            
            // Enhanced letter spacing for Amharic text
            const hasAmharicContent = pages.some(p => /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/.test(p.content));
            if (hasAmharicContent && typeof (ctx as any).letterSpacing !== 'undefined') {
                (ctx as any).letterSpacing = '0.5px';
            }
            
            y = padding;
            pageIndex++;
            canvases.push(page);
            return true;
        };

        // Enhanced TOC rendering for mixed Amharic/English content
        const renderTOC = () => {
            if (!includeTOC || !toc || !toc.length || !ctx) return;
            const c = ctx;
            c.fillStyle = '#111827';
            c.font = `600 ${Math.round(fontSize * 1.5)}px ${optimalFamily}`;
            
            // Check if content has Amharic text
            const hasAmharicInTOC = toc.some(entry => /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/.test(entry.title));
            const tocLineHeight = hasAmharicInTOC ? Math.round(baseLineHeight * 1.4) : baseLineHeight;
            
            c.fillText('Table of Contents', padding, y);
            y += Math.round(baseLineHeight * 1.8); // Extra space after title
            c.font = `${fontSize}px ${optimalFamily}`;
            
            const useTwoColTOC = pageSize === 'A4' && toc.length > 18;
            const tocColGap = 48;
            const tocColWidth = useTwoColTOC ? Math.floor(((dims.w - padding * 2) - tocColGap) / 2) : (dims.w - padding * 2);
            let colX = padding;
            let tocCol = 0;
            
            toc.forEach((entry, idx) => {
                if (!c) return;
                
                // Enhanced title truncation for mixed scripts
                let label = entry.title;
                if (label.length > 60) { // Shorter for better readability
                    label = `${label.slice(0, 57)}…`;
                }
                
                const pageStr = String(entry.page + 1);
                const hasAmharicInTitle = /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/.test(label);
                
                // Better spacing and alignment for mixed content
                const leftMargin = colX + (hasAmharicInTitle ? 8 : 0); // Extra margin for Amharic
                
                // Measure text with enhanced measurement for Amharic
                const textWidth = measureAmharicText(c, label);
                
                // Position text and page number with better alignment
                c.textAlign = 'left';
                c.fillText(label, leftMargin, y);
                
                // Draw leader dots with appropriate spacing
                const dotStart = leftMargin + textWidth + 8;
                const dotEnd = colX + tocColWidth - measureAmharicText(c, pageStr) - 8;
                const dotSpacing = hasAmharicInTitle ? 8 : 6; // More space for Amharic
                
                if (dotEnd > dotStart) {
                    c.fillStyle = '#666666'; // Lighter dots
                    for (let dotX = dotStart; dotX < dotEnd; dotX += dotSpacing) {
                        c.fillText('·', dotX, y); // Use middle dot instead of period
                    }
                    c.fillStyle = '#111827'; // Reset to text color
                }
                
                // Right-align page number
                c.textAlign = 'right';
                c.fillText(pageStr, colX + tocColWidth, y);
                c.textAlign = 'left'; // Reset alignment
                
                y += tocLineHeight;
                
                // Enhanced page break and column handling
                if (y + tocLineHeight + footerSpace > dims.h) {
                    c.fillStyle = '#6b7280';
                    c.font = `500 ${Math.round(fontSize * 0.8)}px ${optimalFamily}`;
                    c.textAlign = 'center';
                    c.fillText(String(pageIndex), dims.w / 2, dims.h - padding);
                    c.textAlign = 'left';
                    newPage();
                    if (!ctx) return;
                    c.fillStyle = '#111827';
                    c.font = `${fontSize}px ${optimalFamily}`;
                    colX = padding; 
                    tocCol = 0; 
                    y = padding + Math.round(baseLineHeight * 1.8); // Extra space at top
                }
                
                // Enhanced two-column layout with better spacing
                if (useTwoColTOC && idx < toc.length - 1 && y + (tocLineHeight * 2) > dims.h - footerSpace) {
                    if (tocCol === 0) {
                        tocCol = 1;
                        colX = padding + tocColWidth + tocColGap;
                        y = padding + Math.round(baseLineHeight * 1.8);
                    }
                }
            });
            
            // Add extra spacing after TOC
            y += Math.round(baseLineHeight * 1.2);
        };

        newPage();
        renderTOC();
        lines.forEach(line => {
            if (!ctx || !page) return;
            
            // Enhanced line height calculation for Amharic content
            const hasAmharicInLine = line.text && /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/.test(line.text);
            const needed = hasAmharicInLine ? Math.round(baseLineHeight * 1.3) : baseLineHeight;
            const extraSpacing = line.isTitle && hasAmharicInLine ? Math.round(baseLineHeight * 0.2) : 0;
            
            const colXBase = padding + (col * (perColumnWidth + (columns === 2 ? columnGap : 0)));
            if (y + needed + footerSpace > dims.h) {
                // footer before new page
                ctx.fillStyle = '#6b7280';
                ctx.font = `500 ${Math.round(fontSize * 0.8)}px ${optimalFamily}`;
                ctx.textAlign = 'center';
                ctx.fillText(String(pageIndex), dims.w / 2, dims.h - padding);
                ctx.textAlign = 'left';
                newPage();
                if (!ctx) return;
                col = 0;
            }
            
            // Enhanced font and styling for Amharic content
            ctx.fillStyle = line.isTitle ? '#111827' : '#1f2937';
            const titleFont = line.isTitle ? `600 ${Math.round(fontSize * 1.25)}px ${optimalFamily}` : `${fontSize}px ${optimalFamily}`;
            ctx.font = titleFont;
            
            // Add extra letter spacing for Amharic titles
            if (line.isTitle && hasAmharicInLine && typeof (ctx as any).letterSpacing !== 'undefined') {
                (ctx as any).letterSpacing = '1px';
            }
            
            if (line.text) {
                // Enhanced justification handling - avoid justification for Amharic text
                const isLastLineOnPage = y + needed + footerSpace > dims.h;
                const isParagraphBreak = line.text.trim() === '';
                const shouldJustify = !line.isTitle && !isParagraphBreak && columns === 1 && !hasAmharicInLine;
                
                if (shouldJustify && ctx) {
                    // Attempt simple justification by spreading spaces
                    const wordsInLine = line.text.split(/\s+/);
                    if (wordsInLine.length > 1 && !isLastLineOnPage) {
                        const rawWidth = measureAmharicText(ctx, line.text);
                        const gapCount = wordsInLine.length - 1;
                        const extra = perColumnWidth - rawWidth;
                        if (extra > 20) { // threshold to avoid over-stretch
                            const gapAdd = extra / gapCount;
                            let xCursor = colXBase;
                            wordsInLine.forEach((w, wi) => {
                                if (!ctx) return;
                                ctx.fillText(w, xCursor, y);
                                if (wi < wordsInLine.length - 1) {
                                    xCursor += measureAmharicText(ctx, `${w  } `) + gapAdd;
                                }
                            });
                        } else {
                            ctx.fillText(line.text, colXBase, y);
                        }
                    } else {
                        ctx.fillText(line.text, colXBase, y);
                    }
                } else {
                    // Enhanced positioning for Amharic content
                    const xPos = hasAmharicInLine ? colXBase + 2 : colXBase; // Slight offset for Amharic
                    ctx.fillText(line.text, xPos, y);
                }
                
                // Reset letter spacing after each line
                if (typeof (ctx as any).letterSpacing !== 'undefined') {
                    (ctx as any).letterSpacing = hasAmharicInLine ? '0.5px' : 'normal';
                }
            }
            
            y += needed + extraSpacing;

            // Column flow
            if (columns === 2 && y + needed + footerSpace > dims.h) {
                // Move to next column if available
                if (col === 0) {
                    col = 1;
                    y = padding; // reset y
                }
            }
        });

        // Footer for last page
        if (ctx && page) {
            const c: CanvasRenderingContext2D = ctx; // prevent TS narrowing
            c.fillStyle = '#6b7280';
            c.font = `500 ${Math.round(fontSize * 0.8)}px ${optimalFamily}`;
            c.textAlign = 'center';
            c.fillText(String(pageIndex), dims.w / 2, dims.h - padding);
            c.textAlign = 'left';
        }

        canvases.forEach(cv => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative mx-auto shadow-sm border border-border bg-white rounded mb-6 overflow-hidden';
            wrapper.style.width = `${dims.w  }px`;
            wrapper.style.height = `${dims.h  }px`;
            wrapper.appendChild(cv);
            containerRef.current?.appendChild(wrapper);
        });

        onRender?.(canvases);
        if (debugEnabled && overflowWordsRef.current.size) {
             
            console.debug('[BookPreview Overflow Words]', Array.from(overflowWordsRef.current));
        }
    }, [pages, pageSize, fontSize, lineHeight, family, onRender, columns, columnGap, toc, includeTOC, hyphenReady, hyphenLang]);

    return (
        <div className="w-full">
            <div className="grid place-items-center">
                <div ref={containerRef} className="w-full" />
            </div>
        </div>
    );
};
