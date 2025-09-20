import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles, AlertTriangle, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

import { useOCRStore } from '@/store/ocrStore';
import { ProjectSummary, OCRResult } from '@/types';
import { buildFallbackSummary } from '@/services/export/projectExportService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchResults } from '@/services/api/results';
import { fetchProjectSummary } from '@/services/api/projects';
import { mapRemoteResult, mapRemoteSummary } from '@/services/api/transformers';

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
    currentUser,
  } = useOCRStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteResults, setRemoteResults] = useState<OCRResult[]>([]);
  const [remoteSummary, setRemoteSummary] = useState<ProjectSummary | null>(null);
  const [hydratingRemote, setHydratingRemote] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const scopedProjectId = currentProjectId || result.projectId || 'all';

  useEffect(() => {
    setRemoteResults((prev) => (prev.length ? [] : prev));
    setRemoteSummary((prev) => (prev ? null : prev));
    setRemoteError(null);
  }, [scopedProjectId]);

  const projectResults = useMemo(() => {
    const scoped = currentProjectId
      ? results.filter((r) => r.projectId === currentProjectId)
      : results;
    return scoped.length ? scoped : results;
  }, [results, currentProjectId]);

  const effectiveResults = useMemo(() => {
    const base = projectResults.length ? projectResults : remoteResults.length ? remoteResults : [];
    if (!result) return base.length ? base : [];
    if (base.length === 0) return [result];
    const alreadyPresent = base.some((entry) => entry.id === result.id || entry.fileId === result.fileId);
    return alreadyPresent ? base : [...base, result];
  }, [projectResults, remoteResults, result]);

  const activeSummary: ProjectSummary | undefined = useMemo(() => {
    const summary = currentProjectId ? projectSummaries[currentProjectId] : projectSummaries['all'];
    return summary;
  }, [projectSummaries, currentProjectId]);

  const effectiveSummary: ProjectSummary | undefined = activeSummary ?? remoteSummary ?? undefined;

  const summaryForPages = useMemo(() => {
    if (effectiveSummary) return effectiveSummary;
    if (!effectiveResults.length) return undefined;
    return buildFallbackSummary(scopedProjectId, effectiveResults);
  }, [effectiveSummary, effectiveResults, scopedProjectId]);

  const perPagePreviews = useMemo(() => {
    if (!effectiveResults.length) return [] as Array<{
      id: string;
      title: string;
      subtitle: string;
      content: string;
      language?: string;
      confidence?: number;
    }>;

    return effectiveResults.map((res, idx) => {
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
  }, [effectiveResults, summaryForPages]);

  const ensureSummary = useCallback(async () => {
    const existing = activeSummary ?? remoteSummary ?? undefined;
    if (existing) return existing;
    if (!effectiveResults.length) {
      toast('No OCR results available for preview');
      return undefined;
    }

    const fallback = buildFallbackSummary(scopedProjectId, effectiveResults);

    if (!settings.apiKey) {
      toast('Using layout-preserved text to build preview (no Gemini key found).');
      await setProjectSummary(fallback);
      return fallback;
    }

    try {
      toast.loading('Summarizing project for book preview…', { id: 'book-summary' });
      const { summarizeProject } = await import('@/services/geminiService');
      const summary = await summarizeProject(effectiveResults, settings, {
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
  }, [activeSummary, effectiveResults, remoteSummary, settings, scopedProjectId, setProjectSummary]);

  const generatePreview = useCallback(async () => {
    if (!effectiveResults.length) {
      setError('Run OCR on at least one document to generate a preview.');
      return;
    }
    setLoading(true);
    try {
      await ensureSummary();
      setError(null);
    } catch (e) {
      console.warn(e);
      setError('Failed to prepare summary for preview.');
    } finally {
      setLoading(false);
    }
  }, [effectiveResults, ensureSummary]);

  useEffect(() => {
    if (effectiveResults.length >= MIN_RESULTS_FOR_BOOK && !isProcessing) {
      generatePreview().catch(() => { });
    }
  }, [effectiveResults.length, isProcessing, generatePreview]);

  useEffect(() => {
    if (projectResults.length || remoteResults.length || hydratingRemote) return;
    const projectIdForFetch = currentProjectId ?? result.projectId ?? null;
    if (!projectIdForFetch) return;
    if (!currentUser) return;

    let keepAlive = true;
    setHydratingRemote(true);
    setRemoteError(null);
    fetchResults({ projectId: projectIdForFetch }).then((remote) => {
      if (!keepAlive) return;
      const mapped = remote.map((item) => mapRemoteResult(item));
      setRemoteResults(mapped);
    }).catch((err: any) => {
      console.error('Failed to hydrate project results for preview', err);
      if (!keepAlive) return;
      setRemoteError('Could not load project results from the server.');
    }).finally(() => {
      if (!keepAlive) return;
      setHydratingRemote(false);
    });

    return () => { keepAlive = false; };
  }, [currentProjectId, currentUser, hydratingRemote, projectResults.length, remoteResults.length, result.projectId]);

  useEffect(() => {
    if (effectiveSummary || summaryLoading) return;
    const projectIdForSummary = currentProjectId ?? result.projectId ?? null;
    if (!projectIdForSummary) return;
    if (!currentUser) return;

    let keepAlive = true;
    setSummaryLoading(true);
    fetchProjectSummary(projectIdForSummary)
      .then((remote) => {
        if (!keepAlive || !remote) return;
        setRemoteSummary(mapRemoteSummary(remote));
      })
      .catch((err) => {
        if (!keepAlive) return;
        console.warn('Unable to hydrate project summary for preview', err);
      })
      .finally(() => {
        if (!keepAlive) return;
        setSummaryLoading(false);
      });

    return () => { keepAlive = false; };
  }, [currentProjectId, currentUser, effectiveSummary, result.projectId, summaryLoading]);

  const needsMoreResults = effectiveResults.length < MIN_RESULTS_FOR_BOOK;

  const renderPageMode = () => {
    if (!effectiveResults.length) {
      return (
        <Card className="border-dashed border-border bg-muted m-6">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Monitor className="mb-4 h-12 w-12 text-primary/60" />
            <CardTitle className="text-lg mb-2">No Pages to Preview</CardTitle>
            <CardDescription className="max-w-md">
              Upload additional pages or chapters, then run OCR to see the compiled preview.
            </CardDescription>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6 p-6">
        {perPagePreviews.map((page, idx) => (
          <Card
            key={`${page.id}-${idx}`}
            className="group bg-background/60 backdrop-blur-sm shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">{page.title}</CardTitle>
                  {(page.subtitle || page.language || typeof page.confidence === 'number') && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {page.subtitle && <Badge variant="secondary" className="text-xs">{page.subtitle}</Badge>}
                      {page.language && <Badge variant="outline" className="text-xs">Lang: {page.language.toUpperCase()}</Badge>}
                      {typeof page.confidence === 'number' && (
                        <Badge
                          variant={page.confidence > 0.8 ? 'default' : page.confidence > 0.6 ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {(page.confidence * 100).toFixed(1)}% confidence
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  Page {idx + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border/40 bg-muted/30 p-4">
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90 tracking-wider">
                  {page.content}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Simple, Clean Header */}
      <Card className="sticky top-0 z-10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Book Preview</CardTitle>
                <CardDescription className="mt-0.5">Simple page-by-page document preview</CardDescription>
                {(hydratingRemote || (summaryLoading && !hydratingRemote)) && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{hydratingRemote ? 'Syncing pages...' : 'Loading summary...'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Simple Refresh Button */}
              <Button
                type="button"
                size="sm"
                onClick={generatePreview}
                disabled={loading || isProcessing || needsMoreResults}
                className="shadow-sm h-8"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                {loading ? 'Loading' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Messages */}
      {needsMoreResults && (
        <Card className="border-amber-200 bg-amber-50 text-amber-800">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Ready to Preview</p>
              <p className="text-sm">Run OCR on a document to see page previews.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 text-red-700">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Preview Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {remoteError && (
        <Card className="border-amber-200 bg-amber-50 text-amber-800">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Sync Warning</p>
              <p className="text-sm">{remoteError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-background/50">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div>
                <div className="h-4 w-32 bg-muted rounded mb-2 animate-pulse" />
                <div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Area - Simple Pages View */}
      <Card className="bg-background/50 backdrop-blur-sm overflow-hidden">
        {renderPageMode()}
      </Card>
    </div>
  );
};

interface Props {
  result: OCRResult;
}

export const BookPreviewTab: React.FC<Props> = ({ result }) => {
  return <BookPreviewInner result={result} />;
};