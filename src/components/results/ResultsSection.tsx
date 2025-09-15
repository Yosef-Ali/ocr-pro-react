import React from 'react';
import { FileText, Copy, Download, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultTabs } from './ResultTabs';
import { EmptyState } from './EmptyState';
import { useExport } from '@/hooks/useExport';
import toast from 'react-hot-toast';

export const ResultsSection: React.FC = () => {
  const {
    isProcessing,
    currentResult,
    processingStatus,
    files,
    currentFileIndex,
    setCurrentFileIndex,
    results,
    currentProjectId,
    settings,
    setProjectSummary,
    projectSummaries,
  } = useOCRStore();

  const { exportResult } = useExport();

  // Proofreading AI moved into the editor toolbar (Layout Preserved tab)

  // LLM OCR Compare removed per request

  // Re-run Amharic-only removed per request

  // Local cleanup removed (now part of in-editor tools)

  const handleCopy = () => {
    if (currentResult) {
      navigator.clipboard.writeText(currentResult.extractedText);
      toast.success('Text copied to clipboard');
    }
  };

  const handleDownload = () => {
    if (currentResult) {
      exportResult(currentResult, {
        format: 'txt',
        includeMetadata: false,
        includeAnalysis: false,
        preserveFormatting: true
      });
    }
  };

  const handleSummarizeProject = async () => {
    if (!settings.apiKey) {
      toast.error('Set your API key in Settings to summarize');
      return;
    }
    const projectResults = currentProjectId ? results.filter(r => r.projectId === currentProjectId) : results;
    if (projectResults.length === 0) {
      toast('No results to summarize');
      return;
    }
    try {
      toast.loading('Summarizing project…', { id: 'sum' });
      const { summarizeProject } = await import('@/services/geminiService');
      const summary = await summarizeProject(projectResults, settings, { proofreadPageNumbers: true, projectId: currentProjectId || 'all' });
      setProjectSummary(summary);
      toast.success('Project summarized', { id: 'sum' });
    } catch (e) {
      console.error(e);
      toast.error('Failed to summarize project', { id: 'sum' });
    }
  };

  const activeSummary = currentProjectId ? projectSummaries[currentProjectId] : projectSummaries['all'];

  const getActiveProjectResults = () => (currentProjectId ? results.filter(r => r.projectId === currentProjectId) : results);

  const exportSummaryJSON = () => {
    if (!activeSummary) return;
    const blob = new Blob([JSON.stringify(activeSummary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-summary-${activeSummary.projectId}-${activeSummary.generatedAt}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSummaryTXT = () => {
    if (!activeSummary) return;
    const lines: string[] = [];
    lines.push('Project Summary');
    lines.push('');
    if (activeSummary.toc?.length) {
      lines.push('Table of Contents:');
      for (const item of activeSummary.toc) {
        const indent = '  '.repeat(Math.max(0, (item.level || 1) - 1));
        const page = item.page != null ? ` (p.${item.page})` : '';
        lines.push(`${indent}- ${item.title}${page}`);
      }
      lines.push('');
    }
    if (activeSummary.summary) {
      lines.push('Summary:');
      lines.push(activeSummary.summary);
      lines.push('');
    }
    if (activeSummary.chapters?.length) {
      lines.push('Chapters:');
      activeSummary.chapters.forEach((c, idx) => {
        lines.push(`${idx + 1}. ${c.title}`);
        if (c.content) lines.push(c.content);
        lines.push('');
      });
    }
    if (activeSummary.proofreadingNotes?.length) {
      lines.push('Proofreading Notes:');
      activeSummary.proofreadingNotes.forEach(n => lines.push(`- ${n}`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-summary-${activeSummary.projectId}-${activeSummary.generatedAt}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyTocMarkdown = async () => {
    if (!activeSummary?.toc?.length) return;
    const lines = activeSummary.toc.map(item => {
      const indent = '  '.repeat(Math.max(0, (item.level || 1) - 1));
      const page = item.page != null ? ` (p.${item.page})` : '';
      return `${indent}- ${item.title}${page}`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('TOC copied as Markdown');
  };

  const exportSummaryDOCX = async () => {
    if (!activeSummary) return;
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({ text: 'Project Summary', heading: HeadingLevel.HEADING_1 }),
              ...(activeSummary.toc?.length
                ? [
                  new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }),
                  ...activeSummary.toc.map((t) =>
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
              ...(activeSummary.summary
                ? [
                  new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }),
                  ...activeSummary.summary.split('\n').map((line) => new Paragraph(line)),
                ]
                : []),
              ...(activeSummary.chapters?.length
                ? [
                  new Paragraph({ text: 'Chapters', heading: HeadingLevel.HEADING_2 }),
                  ...activeSummary.chapters.flatMap((c, i) => [
                    new Paragraph({ text: `${i + 1}. ${c.title}`, heading: HeadingLevel.HEADING_3 }),
                    ...c.content.split('\n').map((line) => new Paragraph(line)),
                  ]),
                ]
                : []),
              ...(activeSummary.proofreadingNotes?.length
                ? [
                  new Paragraph({ text: 'Proofreading Notes', heading: HeadingLevel.HEADING_2 }),
                  ...activeSummary.proofreadingNotes.map((n) => new Paragraph(`- ${n}`)),
                ]
                : []),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const { saveAs } = await import('file-saver');
      saveAs(blob, `project-summary-${activeSummary.projectId}-${activeSummary.generatedAt}.docx`);
    } catch (e) {
      console.error('DOCX export failed', e);
      toast.error('Failed to export DOCX');
    }
  };

  const exportBookDOCX = async () => {
    if (!activeSummary) return;
    try {
      const projectResults = getActiveProjectResults();
      const { Document, Packer, Paragraph, HeadingLevel, TableOfContents } = await import('docx' as any);
      const sectionsDoc: any[] = [];
      const mainChildren: any[] = [];
      const title = `Project Book — ${activeSummary.projectId}`;

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

      if (activeSummary.chapters?.length) {
        for (let i = 0; i < activeSummary.chapters.length; i++) {
          const ch = activeSummary.chapters[i];
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
      saveAs(blob, `project-book-${activeSummary.projectId}-${Date.now()}.docx`);
      toast.success('Book DOCX exported');
    } catch (e) {
      console.error('Book DOCX export failed', e);
      toast.error('Failed to export Book DOCX');
    }
  };

  const exportBookPDF = async () => {
    if (!activeSummary) return;
    try {
      const projectResults = getActiveProjectResults();
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
        await addTextBlock(`Project Book — ${activeSummary.projectId}`, 22, true);
        cursorY += 16;
        await addTextBlock(`Generated: ${new Date().toLocaleString()}`, 12, false);
        doc.addPage();
        cursorY = margin;
        currentPage += 1;
      } else {
        await addTextBlock(`Project Book — ${activeSummary.projectId}`, 18, true);
        cursorY += 8;
      }
      if (activeSummary.chapters?.length) {
        for (let idx = 0; idx < activeSummary.chapters.length; idx++) {
          const ch = activeSummary.chapters[idx];
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
          // Workaround: Render TOC at the end, then add a note in title indicating TOC at start is requested.
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
      const blob = doc.output('blob');
      const { saveAs } = await import('file-saver');
      saveAs(blob, `project-book-${activeSummary.projectId}-${Date.now()}.pdf`);
      toast.success('Book PDF exported');
    } catch (e) {
      console.error('Book PDF export failed', e);
      toast.error('Failed to export Book PDF');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <FileText className="w-5 h-5 mr-2 text-green-600" />
          OCR Results
          {currentResult?.metadata?.engine && (
            <span className="ml-3 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border">
              Engine: {currentResult.metadata.engine === 'tesseract' ? 'Tesseract' : 'Gemini'}
            </span>
          )}
        </h2>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSummarizeProject}
            title="Summarize Project"
            aria-label="Summarize Project"
            className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
          </motion.button>

          {/* AI proofreading button removed from header */}


          {files.length > 1 && (
            <select
              value={currentFileIndex}
              onChange={(e) => setCurrentFileIndex(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm"
            >
              {files.map((f, idx) => (
                <option key={f.id} value={idx}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            disabled={!currentResult}
            title="Copy extracted text"
            aria-label="Copy extracted text"
            className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            disabled={!currentResult}
            title="Download as .txt"
            aria-label="Download as .txt"
            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {activeSummary && (
        <div className="mb-5 border rounded-lg p-4 bg-purple-50/40">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-purple-800">Project Summary</h3>
            <div className="flex items-center gap-2">
              <button onClick={exportSummaryTXT} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Export TXT</button>
              <button onClick={exportSummaryDOCX} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Export DOCX</button>
              <button onClick={exportSummaryJSON} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Export JSON</button>
              <button onClick={copyTocMarkdown} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Copy TOC (MD)</button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button onClick={exportBookDOCX} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Book DOCX</button>
              <button onClick={exportBookPDF} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Book PDF</button>
            </div>
          </div>
          {activeSummary.toc?.length ? (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">Table of Contents</div>
              <ul className="text-sm list-disc pl-5">
                {activeSummary.toc.map((t, i) => (
                  <li key={i} style={{ marginLeft: `${Math.max(0, (t.level || 1) - 1) * 12}px` }}>
                    {t.title}{t.page != null ? ` (p.${t.page})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {activeSummary.summary && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">Summary</div>
              <p className="text-sm whitespace-pre-wrap">{activeSummary.summary}</p>
            </div>
          )}
          {activeSummary.proofreadingNotes?.length ? (
            <div>
              <div className="text-xs text-gray-600 mb-1">Proofreading Notes</div>
              <ul className="text-sm list-disc pl-5">
                {activeSummary.proofreadingNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isProcessing ? (
          <ProcessingStatus key="processing" status={processingStatus} />
        ) : currentResult ? (
          <ResultTabs key="results" result={currentResult} />
        ) : (
          <EmptyState key="empty" />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
