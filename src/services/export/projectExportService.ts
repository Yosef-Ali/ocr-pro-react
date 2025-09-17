/**
 * Export services for project summaries and books
 */
import { ProjectSummary, Settings, OCRResult } from '@/types';
import { downloadBlob } from '@/utils/validationUtils';

export async function exportSummaryTXT(summary: ProjectSummary): Promise<void> {
    const lines: string[] = [];
    lines.push('Project Summary');
    lines.push('');
    if (summary.toc?.length) {
        lines.push('Table of Contents:');
        for (const item of summary.toc) {
            const indent = '  '.repeat(Math.max(0, (item.level || 1) - 1));
            const page = item.page != null ? ` (p.${item.page})` : '';
            lines.push(`${indent}- ${item.title}${page}`);
        }
        lines.push('');
    }
    if (summary.summary) {
        lines.push('Summary:');
        lines.push(summary.summary);
        lines.push('');
    }
    if (summary.chapters?.length) {
        lines.push('Chapters:');
        summary.chapters.forEach((c, idx) => {
            lines.push(`${idx + 1}. ${c.title}`);
            if (c.content) lines.push(c.content);
            lines.push('');
        });
    }
    if (summary.proofreadingNotes?.length) {
        lines.push('Proofreading Notes:');
        summary.proofreadingNotes.forEach(n => lines.push(`- ${n}`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    downloadBlob(blob, `project-summary-${summary.projectId}-${summary.generatedAt}.txt`);
}

export async function exportSummaryDOCX(summary: ProjectSummary): Promise<void> {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({ text: 'Project Summary', heading: HeadingLevel.HEADING_1 }),
                    ...(summary.toc?.length
                        ? [
                            new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }),
                            ...summary.toc.map((t) =>
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: `${'  '.repeat(Math.max(0, (t.level || 1) - 1))}- ${t.title}${t.page != null ? ` (p.${t.page})` : ''}`,
                                        }),
                                    ],
                                })
                            ),
                        ]
                        : []),
                    ...(summary.summary
                        ? [
                            new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }),
                            ...summary.summary.split('\n').map((line) => new Paragraph(line)),
                        ]
                        : []),
                    ...(summary.chapters?.length
                        ? [
                            new Paragraph({ text: 'Chapters', heading: HeadingLevel.HEADING_2 }),
                            ...summary.chapters.flatMap((c, i) => [
                                new Paragraph({ text: `${i + 1}. ${c.title}`, heading: HeadingLevel.HEADING_3 }),
                                ...c.content.split('\n').map((line) => new Paragraph(line)),
                            ]),
                        ]
                        : []),
                    ...(summary.proofreadingNotes?.length
                        ? [
                            new Paragraph({ text: 'Proofreading Notes', heading: HeadingLevel.HEADING_2 }),
                            ...summary.proofreadingNotes.map((n) => new Paragraph(`- ${n}`)),
                        ]
                        : []),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    const { saveAs } = await import('file-saver');
    saveAs(blob, `project-summary-${summary.projectId}-${summary.generatedAt}.docx`);
}

export async function exportSummaryJSON(summary: ProjectSummary): Promise<void> {
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `project-summary-${summary.projectId}-${summary.generatedAt}.json`);
}

export async function copyTocMarkdown(summary: ProjectSummary): Promise<void> {
    if (!summary.toc?.length) return;
    const lines = summary.toc.map(item => {
        const indent = '  '.repeat(Math.max(0, (item.level || 1) - 1));
        const page = item.page != null ? ` (p.${item.page})` : '';
        return `${indent}- ${item.title}${page}`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
}

export async function exportBookDOCX(summary: ProjectSummary, settings: Settings, projectResults: OCRResult[]): Promise<void> {
    const { Document, Packer, Paragraph, HeadingLevel, TableOfContents } = await import('docx' as any);
    const sectionsDoc: any[] = [];
    const mainChildren: any[] = [];
    const title = `Project Book — ${summary.projectId}`;

    if (settings.bookIncludeCover) {
        const coverChildren: any[] = [];
        coverChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
        coverChildren.push(new Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }));
        sectionsDoc.push({ children: coverChildren });
    } else {
        mainChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
    }

    if (settings.pdfIncludeTOC) {
        const placeAtStart = (settings.pdfTocPosition || 'end') === 'start';
        if (placeAtStart) {
            mainChildren.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }));
            mainChildren.push(new (TableOfContents as any)('Table of Contents', { hyperlink: true, headingStyleRange: '1-5' }));
        }
    }

    if (summary.chapters?.length) {
        for (let i = 0; i < summary.chapters.length; i++) {
            const ch = summary.chapters[i];
            mainChildren.push(new Paragraph({ text: `${i + 1}. ${ch.title}`, heading: HeadingLevel.HEADING_2 }));
            for (const line of (ch.content || '').split('\n')) mainChildren.push(new Paragraph(line));
        }
    } else {
        for (let i = 0; i < projectResults.length; i++) {
            const r = projectResults[i];
            mainChildren.push(new Paragraph({ text: `${i + 1}. ${r.documentType || 'Document'} — ${r.fileId}`, heading: HeadingLevel.HEADING_2 }));
            for (const line of (r.layoutPreserved || r.extractedText).split('\n')) mainChildren.push(new Paragraph(line));
        }
    }

    if (settings.pdfIncludeTOC && (settings.pdfTocPosition || 'end') === 'end') {
        mainChildren.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }));
        mainChildren.push(new (TableOfContents as any)('Table of Contents', { hyperlink: true, headingStyleRange: '1-5' }));
    }

    sectionsDoc.push({ children: mainChildren });
    const doc = new Document({ sections: sectionsDoc });
    const blob = await Packer.toBlob(doc);
    const { saveAs } = await import('file-saver');
    saveAs(blob, `project-book-${summary.projectId}-${Date.now()}.docx`);
}

export async function createBookPdfBlob(summary: ProjectSummary, settings: Settings, projectResults: OCRResult[]): Promise<Blob | null> {
    const [{ jsPDF }] = await Promise.all([import('jspdf')]);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    const { needsEthiopicFont, ensureEthiopicFont } = await import('@/utils/pdfFonts');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const maxWidth = pageWidth - margin * 2;
    let cursorY = margin;
    let currentPage = 1;
    const tocItems: Array<{ title: string; page: number }> = [];
    const addTextBlock = async (text: string, fontSize = 12, bold = false) => {
        if (needsEthiopicFont(text)) {
            await ensureEthiopicFont(doc);
            doc.setFont('NotoSansEthiopic', bold ? 'bold' : 'normal');
        } else {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
        }
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth) as string[];
        for (const line of lines) {
            if (cursorY > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                cursorY = margin;
                currentPage += 1;
            }
            doc.text(line, margin, cursorY);
            cursorY += fontSize + 4;
        }
    };
    if (settings.bookIncludeCover) {
        await addTextBlock(`Project Book — ${summary.projectId}`, 22, true);
        cursorY += 16;
        await addTextBlock(`Generated: ${new Date().toLocaleString()}`, 12, false);
        doc.addPage();
        cursorY = margin;
        currentPage += 1;
    } else {
        await addTextBlock(`Project Book — ${summary.projectId}`, 18, true);
        cursorY += 8;
    }
    if (summary.chapters?.length) {
        for (let idx = 0; idx < summary.chapters.length; idx++) {
            const ch = summary.chapters[idx];
            tocItems.push({ title: `${idx + 1}. ${ch.title}`, page: currentPage });
            await addTextBlock(`${idx + 1}. ${ch.title}`, 14, true);
            await addTextBlock(ch.content || '', 12, false);
            cursorY += 6;
        }
    } else {
        for (let idx = 0; idx < projectResults.length; idx++) {
            const r = projectResults[idx];
            const title = `${idx + 1}. ${r.documentType || 'Document'} — ${r.fileId}`;
            tocItems.push({ title, page: currentPage });
            await addTextBlock(title, 14, true);
            await addTextBlock((r.layoutPreserved || r.extractedText) || '', 12, false);
            cursorY += 6;
        }
    }
    // Optional TOC and footer based on settings
    if (settings.pdfIncludeTOC) {
        const placeAtStart = (settings.pdfTocPosition || 'end') === 'start';
        if (placeAtStart) {
            // Reserve a page for TOC at start: create a blank page after cover
            // Note: Page reordering is not supported here; TOC will render at end as a fallback.
            // jsPDF lacks safe page reordering in-browser without plugins; we keep TOC rendered at end.
        }
        if (cursorY > doc.internal.pageSize.getHeight() - margin - 40) { doc.addPage(); cursorY = margin; currentPage += 1; }
        await addTextBlock('Table of Contents', 16, true);
        for (const item of tocItems) {
            await addTextBlock(`${item.title} ..... ${item.page}`, 12, false);
        }
    }

    if (settings.pdfIncludeFooter) {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - margin / 2, { align: 'center' } as any);
        }
    }
    return doc.output('blob');
}

export async function exportBookPDF(summary: ProjectSummary, settings: Settings, projectResults: OCRResult[]): Promise<void> {
    const blob = await createBookPdfBlob(summary, settings, projectResults);
    if (!blob) return;
    const { saveAs } = await import('file-saver');
    saveAs(blob, `project-book-${summary.projectId}-${Date.now()}.pdf`);
}

export async function exportOriginalsPDF(results: OCRResult[]): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const isTiff = (url?: string, name?: string) => {
        if (!url) return false;
        if (url.startsWith('data:image/tiff') || url.startsWith('data:image/tif')) return true;
        if (name && /\.(tif|tiff)$/i.test(name)) return true;
        return false;
    };

    const toArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
        if (url.startsWith('data:')) {
            const base64 = url.split(',')[1] || '';
            const binary = atob(base64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            return bytes.buffer;
        } else {
            const res = await fetch(url);
            return res.arrayBuffer();
        }
    };

    const convertTiffToPng = async (inputUrl: string): Promise<string | null> => {
        try {
            const buf = await toArrayBuffer(inputUrl);
            const UTIF = await import('utif');
            const ifds = UTIF.decode(buf as any);
            if (!ifds || ifds.length === 0) return null;
            const first = ifds[0];
            UTIF.decodeImage(buf as any, first);
            const rgba = UTIF.toRGBA8(first);
            const width = (first as any).width || (first as any).t256 || 0;
            const height = (first as any).height || (first as any).t257 || 0;
            if (!width || !height) return null;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
            ctx.putImageData(imageData, 0, 0);
            return canvas.toDataURL('image/png');
        } catch {
            return null;
        }
    };

    let firstPage = true;
    for (const r of results) {
        const url = (r as any).preview as string | undefined;
        if (!url) continue;
        const useUrl = isTiff(url, (r as any).name) ? (await convertTiffToPng(url)) || url : url;

        const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = reject;
            img.src = useUrl;
        });
        const imgRatio = dim.w / dim.h;
        const pageRatio = pageW / pageH;
        let renderW = pageW, renderH = pageH;
        if (imgRatio > pageRatio) {
            renderW = pageW;
            renderH = pageW / imgRatio;
        } else {
            renderH = pageH;
            renderW = pageH * imgRatio;
        }
        const x = (pageW - renderW) / 2;
        const y = (pageH - renderH) / 2;
        if (!firstPage) doc.addPage();
        firstPage = false;
        const fmt = useUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(useUrl, fmt as any, x, y, renderW, renderH, undefined, 'FAST');
    }

    const { saveAs } = await import('file-saver');
    const blob = doc.output('blob');
    saveAs(blob, `project-originals-${Date.now()}.pdf`);
}
