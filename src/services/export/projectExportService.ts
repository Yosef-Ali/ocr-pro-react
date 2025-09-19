/**
 * Export services for project summaries and books
 */
import { ProjectSummary, Settings, OCRResult, OCRFile } from '@/types';
import { downloadBlob } from '@/utils/validationUtils';

export const DEFAULT_PROJECT_ID = 'all';

export function buildFallbackSummary(projectId: string, results: OCRResult[]): ProjectSummary {
    const generatedAt = Date.now();
    const toc = results.map((res, idx) => ({
        title: deriveResultTitle(res, idx),
        level: 1,
        page: idx + 1,
    }));
    const chapters = results.map((res, idx) => ({
        title: toc[idx].title,
        content: (res.layoutPreserved || res.extractedText || '').trim(),
    }));
    return {
        projectId,
        generatedAt,
        toc,
        summary: '',
        chapters,
        proofreadingNotes: [],
    };
}

function deriveResultTitle(result: OCRResult, index: number): string {
    const meta = (result as any).metadata || {};
    const metaTitle = typeof meta.title === 'string' ? meta.title.trim() : '';
    if (metaTitle) return metaTitle;
    if (result.documentType && result.documentType !== 'Unknown') return result.documentType;
    if ((result as any).name) return String((result as any).name);
    return `Document ${index + 1}`;
}

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

const resolveProjectId = (summary: ProjectSummary | undefined, results: OCRResult[]): string => {
    if (summary?.projectId) return summary.projectId;
    const withProject = results.find((r) => !!r.projectId);
    return withProject?.projectId || DEFAULT_PROJECT_ID;
};

export async function exportBookDOCX(summary: ProjectSummary | undefined, settings: Settings, projectResults: OCRResult[]): Promise<void> {
    const { Document, Packer, Paragraph, HeadingLevel, TableOfContents } = await import('docx' as any);
    const effectiveSummary = summary ?? buildFallbackSummary(resolveProjectId(summary, projectResults), projectResults);
    const sectionsDoc: any[] = [];
    const mainChildren: any[] = [];
    const title = `Project Book — ${effectiveSummary.projectId}`;

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

    if (effectiveSummary.chapters?.length) {
        for (let i = 0; i < effectiveSummary.chapters.length; i++) {
            const ch = effectiveSummary.chapters[i];
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
    saveAs(blob, `project-book-${effectiveSummary.projectId}-${Date.now()}.docx`);
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
    const setFontForText = async (text: string, bold = false) => {
        if (text && needsEthiopicFont(text)) {
            await ensureEthiopicFont(doc);
            const fontList = (doc.getFontList?.() as unknown as Record<string, Record<string, string>>) || {};
            const ethiopicStyles = fontList.NotoSansEthiopic || {};
            if (bold && ethiopicStyles.bold) {
                doc.setFont('NotoSansEthiopic', 'bold');
                return;
            }
            if (ethiopicStyles.normal) {
                doc.setFont('NotoSansEthiopic', 'normal');
                return;
            }
        }
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
    };
    const addTextBlock = async (text: string, fontSize = 12, bold = false) => {
        await setFontForText(text, bold);
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
            if (idx > 0) {
                doc.addPage();
                cursorY = margin;
                currentPage += 1;
            }
            tocItems.push({ title: `${idx + 1}. ${ch.title}`, page: currentPage });
            await addTextBlock(`${idx + 1}. ${ch.title}`, 14, true);
            await addTextBlock(ch.content || '', 12, false);
            cursorY += 6;
        }
    } else {
        for (let idx = 0; idx < projectResults.length; idx++) {
            const r = projectResults[idx];
            const title = `${idx + 1}. ${r.documentType || 'Document'} — ${r.fileId}`;
            if (idx > 0) {
                doc.addPage();
                cursorY = margin;
                currentPage += 1;
            }
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
        if (cursorY > margin) { doc.addPage(); cursorY = margin; currentPage += 1; }
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

export async function exportBookPDF(summary: ProjectSummary | undefined, settings: Settings, projectResults: OCRResult[]): Promise<void> {
    const effectiveSummary = summary ?? buildFallbackSummary(resolveProjectId(summary, projectResults), projectResults);
    const blob = await createBookPdfBlob(effectiveSummary, settings, projectResults);
    if (!blob) return;
    const { saveAs } = await import('file-saver');
    saveAs(blob, `project-book-${effectiveSummary.projectId}-${Date.now()}.pdf`);
}


export async function exportProjectResultsTableXLSX(results: OCRResult[], files: OCRFile[], projectId: string | null): Promise<void> {
    if (!results.length) {
        throw new Error('No OCR results available to export');
    }

    const [{ utils, writeFile }] = await Promise.all([
        import('xlsx').then((m: any) => ({ utils: m.utils, writeFile: m.writeFile || (m as any).writeFileXLSX })),
    ]);

    const header = ['#', 'File', 'Language', 'Type', 'Confidence (%)', 'Words', 'Characters', 'Engine'];
    const rows = results.map((result, index) => {
        const fileName = files.find((f) => f.id === result.fileId)?.name || result.fileId;
        const confidence = result.confidence != null ? Number((result.confidence * 100).toFixed(1)) : '';
        const wordCount = result.metadata?.wordCount ?? '';
        const characterCount = result.metadata?.characterCount ?? '';
        const engine = (result.metadata as any)?.engine ?? '';
        return [
            index + 1,
            fileName,
            result.detectedLanguage || '',
            result.documentType || '',
            confidence,
            wordCount,
            characterCount,
            engine,
        ];
    });

    const worksheet = utils.aoa_to_sheet([header, ...rows]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'OCR Results');

    const safeProjectId = (projectId ?? 'all').replace(/[^a-zA-Z0-9_-]+/g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ocr-project-${safeProjectId}-results-${timestamp}.xlsx`;

    if (typeof writeFile === 'function') {
        await writeFile(workbook, filename);
        return;
    }

    const xlsxModule = await import('xlsx');
    const workbookOut = (xlsxModule as any).write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([workbookOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
}
