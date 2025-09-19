import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles, RefreshCcw, AlertTriangle, Monitor, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';

import { useOCRStore } from '@/store/ocrStore';
import { ProjectSummary, OCRResult } from '@/types';
import { buildFallbackSummary, createBookPdfBlob } from '@/services/export/projectExportService';
import { cn } from '@/utils/cn';

const MIN_RESULTS_FOR_BOOK = 1;

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
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'pdf' | 'pages'>('pdf');

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

  const summaryForPages = useMemo(() => {
    if (activeSummary) return activeSummary;
    if (!projectResults.length) return undefined;
    return buildFallbackSummary(scopedProjectId, projectResults);
  }, [activeSummary, projectResults, scopedProjectId]);

  const perPagePreviews = useMemo(() => {
    if (!projectResults.length) return [] as Array<{
      id: string;
      title: string;
      subtitle: string;
      content: string;
      language?: string;
      confidence?: number;
    }>;

    return projectResults.map((res, idx) => {
      const chapter = summaryForPages?.chapters?.[idx];
      const title = chapter?.title || summaryForPages?.toc?.[idx]?.title || `Page ${idx + 1}`;
      const content = (chapter?.content || res.layoutPreserved || res.extractedText || '').trim();
      const subtitleParts: string[] = [];
      if (res.documentType && res.documentType !== 'Unknown') subtitleParts.push(res.documentType);
      if (res.metadata?.engine) subtitleParts.push(res.metadata.engine);
      if (res.metadata?.pageCount) subtitleParts.push(`${res.metadata.pageCount} page${res.metadata.pageCount > 1 ? 's' : ''}`);

      return {
        id: res.id || res.fileId || `page-${idx}`,
        title,
        subtitle: subtitleParts.join(' • '),
        content: content || 'No OCR output captured for this page yet.',
        language: res.detectedLanguage || undefined,
        confidence: typeof res.confidence === 'number' ? res.confidence : undefined,
      };
    });
  }, [projectResults, summaryForPages]);

  const ensureSummary = useCallback(async () => {
    if (activeSummary) return activeSummary;
    if (!projectResults.length) {
      toast('No OCR results available for preview');
      return undefined;
    }

    const fallback = buildFallbackSummary(scopedProjectId, projectResults);

    if (!settings.apiKey) {
      toast('Using layout-preserved text to build preview (no Gemini key found).');
      await setProjectSummary(fallback);
      return fallback;
    }

    try {
      toast.loading('Summarizing project for book preview…', { id: 'book-summary' });
      const { summarizeProject } = await import('@/services/geminiService');
      const summary = await summarizeProject(projectResults, settings, {
        proofreadPageNumbers: true,
        projectId: scopedProjectId,
      });
      await setProjectSummary(summary);
      toast.success('Summary ready. Generating preview…', { id: 'book-summary' });
      return summary;
    } catch (err) {
      console.error('Failed to summarize project for preview', err);
      toast('Summarization failed — using layout-preserved text instead.');
      await setProjectSummary(fallback);
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
      const msg = (err as any)?.message || 'Unknown error';
      setError(`Failed to generate the preview. Try again or check Settings. (${msg})`);
    } finally {
      setLoading(false);
    }
  }, [ensureSummary, pdfUrl, projectResults, settings]);

  useEffect(() => {
    if (!pdfUrl && projectResults.length >= MIN_RESULTS_FOR_BOOK && activeSummary && !isProcessing) {
      generatePreview().catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSummary, projectResults.length, isProcessing]);

  const needsMoreResults = projectResults.length < MIN_RESULTS_FOR_BOOK;

  const renderPageMode = () => {
    if (!projectResults.length) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted p-10 text-center text-sm text-muted-foreground">
          <Monitor className="mb-3 h-8 w-8 text-primary" />
          Upload additional pages or chapters, then run OCR to see the compiled preview.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {perPagePreviews.map((page, idx) => (
          <article
            key={`${page.id}-${idx}`}
            className="rounded-xl border border-border bg-background/60 p-4 shadow-sm transition hover:border-primary/60 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-foreground">{page.title}</h4>
                {(page.subtitle || page.language || typeof page.confidence === 'number') && (
                  <p className="mt-1 text-xs text-muted-foreground space-x-2">
                    {page.subtitle && <span>{page.subtitle}</span>}
                    {page.language && <span>Language: {page.language.toUpperCase()}</span>}
                    {typeof page.confidence === 'number' && <span>Confidence: {(page.confidence * 100).toFixed(1)}%</span>}
                  </p>
                )}
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">Page {idx + 1}</span>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-muted/40 p-4 text-left text-sm leading-relaxed whitespace-pre-wrap">
              {page.content}
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-muted p-4 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">Book Preview</h3>
              <p className="text-sm text-muted-foreground">
                Review the compiled PDF using the layout preserved text for the current project.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition',
                  viewMode === 'pdf'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <FileText className="h-4 w-4" />
                Combined PDF
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pages')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition',
                  viewMode === 'pages'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Page Layout
              </button>
            </div>
            <button
              type="button"
              onClick={generatePreview}
              disabled={loading || isProcessing || needsMoreResults}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Building…' : 'Generate Preview'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPdfUrl(null);
                generatePreview().catch(() => { });
              }}
              disabled={loading || !pdfUrl}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground/60"
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

      {loading && !pdfUrl && (
        <div className="rounded-xl border border-border p-4">
          <div className="h-6 w-40 bg-muted rounded mb-3 animate-pulse" />
          <div className="h-[60vh] w-full bg-muted animate-pulse rounded" />
        </div>
      )}

      {viewMode === 'pdf'
        ? (
          pdfUrl ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between p-2 border-b bg-muted">
                <div className="text-sm text-muted-foreground">PDF Preview</div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent"
                  >Open in new tab</a>
                  <button
                    className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent disabled:opacity-50"
                    disabled={downloading}
                    onClick={async () => {
                      try {
                        setDownloading(true);
                        const res = await fetch(pdfUrl);
                        const blob = await res.blob();
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `project-preview-${scopedProjectId}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      } finally {
                        setDownloading(false);
                      }
                    }}
                  >{downloading ? 'Downloading…' : 'Download'}</button>
                </div>
              </div>
              <iframe title="Book Preview" src={pdfUrl} className="h-[70vh] w-full bg-background" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted p-10 text-center text-sm text-muted-foreground">
              {loading ? (
                <>
                  <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
                  Generating book preview…
                </>
              ) : (
                <>
                  <Monitor className="mb-3 h-8 w-8 text-primary" />
                  {needsMoreResults
                    ? 'Upload additional pages or chapters, then run OCR to see the compiled preview.'
                    : 'Click “Generate Preview” to build a PDF using the layout-preserved results.'}
                </>
              )}
            </div>
          )
        )
        : renderPageMode()}
    </div>
  );
};

interface Props {
  result: OCRResult;
}

export const BookPreviewTab: React.FC<Props> = ({ result }) => {
  return <BookPreviewInner result={result} />;
};
