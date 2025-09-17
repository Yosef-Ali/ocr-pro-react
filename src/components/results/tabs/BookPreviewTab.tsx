import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles, RefreshCcw, AlertTriangle, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

import { useOCRStore } from '@/store/ocrStore';
import { ProjectSummary, OCRResult } from '@/types';
import { createBookPdfBlob } from '@/services/export/projectExportService';

const MIN_RESULTS_FOR_BOOK = 1;

const deriveResultTitle = (result: OCRResult, index: number) => {
  const metadataTitle = (result as any).metadata?.title as string | undefined;
  if (metadataTitle && metadataTitle.trim()) return metadataTitle.trim();
  if (result.documentType && result.documentType !== 'Unknown') return result.documentType;
  if ((result as any).name) return String((result as any).name);
  return `Document ${index + 1}`;
};

const buildFallbackSummary = (projectId: string, results: OCRResult[]): ProjectSummary => {
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
};

interface BookPreviewProps {
  result: OCRResult;
}

const BookPreviewInner: React.FC<BookPreviewProps> = ({ result }) => {
  const {
    currentProjectId,
    projectSummaries,
    results,
    settings,
    setProjectSummary,
    isProcessing,
  } = useOCRStore();

  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scopedProjectId = currentProjectId || result.projectId || 'all';

  const projectResults = useMemo(() => {
    const scoped = currentProjectId
      ? results.filter((r) => r.projectId === currentProjectId)
      : results;
    return scoped.length ? scoped : results;
  }, [results, currentProjectId]);

  const activeSummary: ProjectSummary | undefined = useMemo(() => {
    const summary = currentProjectId ? projectSummaries[currentProjectId] : projectSummaries['all'];
    return summary;
  }, [projectSummaries, currentProjectId]);

  const ensureSummary = useCallback(async () => {
    if (activeSummary) return activeSummary;
    if (!projectResults.length) {
      toast('No OCR results available for preview');
      return undefined;
    }

    const fallback = buildFallbackSummary(scopedProjectId, projectResults);

    if (!settings.apiKey) {
      toast('Using layout-preserved text to build preview (no Gemini key found).');
      setProjectSummary(fallback);
      return fallback;
    }

    try {
      toast.loading('Summarizing project for book preview…', { id: 'book-summary' });
      const { summarizeProject } = await import('@/services/geminiService');
      const summary = await summarizeProject(projectResults, settings, {
        proofreadPageNumbers: true,
        projectId: scopedProjectId,
      });
      setProjectSummary(summary);
      toast.success('Summary ready. Generating preview…', { id: 'book-summary' });
      return summary;
    } catch (err) {
      console.error('Failed to summarize project for preview', err);
      toast('Summarization failed — using layout-preserved text instead.');
      setProjectSummary(fallback);
      return fallback;
    }
  }, [activeSummary, projectResults, settings, scopedProjectId, setProjectSummary]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const generatePreview = useCallback(async () => {
    if (!projectResults.length) {
      setError('Run OCR on at least one document to generate a preview.');
      return;
    }
    const summary = await ensureSummary();
    if (!summary) {
      setError('Unable to build the book preview yet.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const blob = await createBookPdfBlob(summary, settings, projectResults);
      if (!blob) throw new Error('No PDF generated');
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      toast.success('Book preview ready');
    } catch (err) {
      console.error('Failed to generate preview', err);
      setError('Failed to generate the preview. Try again or check Settings.');
    } finally {
      setLoading(false);
    }
  }, [ensureSummary, pdfUrl, projectResults, settings]);

  useEffect(() => {
    if (!pdfUrl && projectResults.length >= MIN_RESULTS_FOR_BOOK && activeSummary && !isProcessing) {
      generatePreview().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSummary, projectResults.length, isProcessing]);

  const needsMoreResults = projectResults.length < MIN_RESULTS_FOR_BOOK;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Book Preview</h3>
              <p className="text-sm text-gray-600">
                Review the compiled PDF using the layout preserved text for the current project.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generatePreview}
              disabled={loading || isProcessing || needsMoreResults}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Building…' : 'Generate Preview'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPdfUrl(null);
                generatePreview().catch(() => {});
              }}
              disabled={loading || !pdfUrl}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {needsMoreResults && (
        <p className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Run OCR on a document to build a book-style preview.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          {error}
        </p>
      )}

      {pdfUrl ? (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <iframe
            title="Book Preview"
            src={pdfUrl}
            className="h-[70vh] w-full bg-white"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          {loading ? (
            <>
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-blue-600" />
              Generating book preview…
            </>
          ) : (
            <>
              <Monitor className="mb-3 h-8 w-8 text-blue-500" />
              {needsMoreResults
                ? 'Upload additional pages or chapters, then run OCR to see the compiled preview.'
                : 'Click “Generate Preview” to build a PDF using the layout-preserved results.'}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface Props {
  result: OCRResult;
}

export const BookPreviewTab: React.FC<Props> = ({ result }) => {
  return <BookPreviewInner result={result} />;
};
