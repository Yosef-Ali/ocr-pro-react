import React from 'react';
import { FileText, Copy, Download, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { ProcessingStatus } from './ProcessingStatus';
import { EmptyState } from './EmptyState';
import { useExport } from '@/hooks/useExport';
import toast from 'react-hot-toast';
import { exportSummaryTXT as exportSummaryTXTService, exportSummaryDOCX as exportSummaryDOCXService, exportSummaryJSON as exportSummaryJSONService, copyTocMarkdown as copyTocMarkdownService, exportBookDOCX as exportBookDOCXService, exportBookPDF as exportBookPDFService } from '@/services/export/projectExportService';
import { lazy, Suspense } from 'react';
import { processWithTesseractOnly } from '@/services/ocr/ocrProcessingService';

const ResultTabs = lazy(() => import('./ResultTabs').then(module => ({ default: module.ResultTabs })));

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
  const activeResults = currentProjectId ? results.filter(r => r.projectId === currentProjectId) : results;

  const getActiveProjectResults = () => (currentProjectId ? results.filter(r => r.projectId === currentProjectId) : results);

  const exportSummaryJSON = () => {
    if (!activeSummary) return;
    exportSummaryJSONService(activeSummary);
  };

  const exportSummaryTXT = () => {
    if (!activeSummary) return;
    exportSummaryTXTService(activeSummary);
  };

  const copyTocMarkdown = async () => {
    if (!activeSummary) return;
    await copyTocMarkdownService(activeSummary);
    toast.success('TOC copied as Markdown');
  };

  const exportSummaryDOCX = async () => {
    if (!activeSummary) return;
    await exportSummaryDOCXService(activeSummary);
  };

  const exportBookDOCX = async () => {
    if (!activeSummary) return;
    try {
      await exportBookDOCXService(activeSummary, settings, getActiveProjectResults());
      toast.success('Book DOCX exported');
    } catch (e) {
      console.error('Book DOCX export failed', e);
      toast.error('Failed to export Book DOCX');
    }
  };

  const exportBookPDF = async () => {
    if (!activeSummary) return;
    try {
      await exportBookPDFService(activeSummary, settings, getActiveProjectResults());
      toast.success('Book PDF exported');
    } catch (e) {
      console.error('Book PDF export failed', e);
      toast.error('Failed to export Book PDF');
    }
  };

  const rerunAllLayoutOnly = async () => {
    const { files, results, settings, startProcessing, updateProgress, completeProcessing } = useOCRStore.getState();
    const activeIds = currentProjectId ? new Set(results.filter(r => r.projectId === currentProjectId).map(r => r.fileId)) : null;
    const targetFiles = activeIds ? files.filter(f => activeIds.has(f.id)) : files;
    if (targetFiles.length === 0) { toast('No files to re-run'); return; }
    startProcessing();
    try {
      const out = await processWithTesseractOnly(targetFiles, settings, {
        onProgress: (info) => {
          const p = Math.round(((info.index + info.progress) / (info.total || 1)) * 100);
          // Map stages to existing ProcessingStatus values
          const status: 'preparing' | 'analyzing' | 'extracting' | 'formatting' | 'completed' | 'error' =
            info.stage === 'preparing' ? 'preparing' : 'analyzing';
          updateProgress(p, status);
        }
      });
      // Merge new results back by fileId, preserving projectId and original snapshot
      const merged = results.map(r => {
        const replacement = out.find(o => o.fileId === r.fileId);
        return replacement ? { ...replacement, projectId: r.projectId, metadata: { ...(replacement.metadata as any), originalOCRText: (r as any).metadata?.originalOCRText || replacement.layoutPreserved || '' } } : r;
      });
      // Include any new results for files that previously had none
      for (const o of out) {
        if (!merged.find(m => m.fileId === o.fileId)) merged.push(o);
      }
      completeProcessing(merged);
      toast.success('Re-ran all with Tesseract (layout only)');
    } catch (e) {
      console.error(e);
      toast.error('Failed to re-run all (layout only)');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6 relative overflow-visible"
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
          {settings.endUserMode && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  await rerunAllLayoutOnly();
                } catch { }
              }}
              title="Re-run all (layout only)"
              aria-label="Re-run all with Tesseract only"
              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download className="w-4 h-4 rotate-180" />
            </motion.button>
          )}

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
            <>
              <label htmlFor="file-selector" className="sr-only">Select file to view</label>
              <select
                id="file-selector"
                value={currentFileIndex}
                onChange={(e) => setCurrentFileIndex(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select file to view results"
              >
                {files.map((f, idx) => (
                  <option key={f.id} value={idx}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            disabled={!currentResult}
            title="Copy extracted text"
            aria-label="Copy extracted text to clipboard"
            className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            disabled={!currentResult}
            title="Download as .txt"
            aria-label="Download extracted text as TXT file"
            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </motion.button>
        </div>
      </div>

      {!settings.endUserMode && activeSummary && activeResults.length > 0 && (
        <div className="mb-5 border rounded-lg p-4 bg-purple-50/40">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-purple-800">Project Summary</h3>
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Export options">
              <button onClick={exportSummaryTXT} aria-label="Export project summary as TXT file" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Export TXT</button>
              <button onClick={exportSummaryDOCX} aria-label="Export project summary as DOCX file" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Export DOCX</button>
              <button onClick={exportSummaryJSON} aria-label="Export project summary as JSON file" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Export JSON</button>
              <button onClick={copyTocMarkdown} aria-label="Copy table of contents as Markdown" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Copy TOC (MD)</button>
              <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
              <button onClick={exportBookDOCX} aria-label="Export project as DOCX book" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Book DOCX</button>
              <button onClick={exportBookPDF} aria-label="Export project as PDF book" className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Book PDF</button>
              <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
              <button onClick={rerunAllLayoutOnly} aria-label="Re-run all with Tesseract only (preserve layout)" className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500">Re-run All (Layout only)</button>
              <button
                onClick={() => {
                  const pid = currentProjectId || 'all';
                  useOCRStore.getState().clearProjectSummary(pid);
                  toast.success('Project summary cleared');
                }}
                aria-label="Clear project summary"
                className="ml-2 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Clear Summary
              </button>
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
          <Suspense fallback={<div>Loading...</div>}>
            <ResultTabs key="results" result={currentResult} />
          </Suspense>
        ) : (
          <EmptyState key="empty" />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
