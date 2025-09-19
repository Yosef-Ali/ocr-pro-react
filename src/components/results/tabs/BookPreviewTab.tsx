import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles, AlertTriangle, Monitor, LayoutGrid, Settings, Download } from 'lucide-react';
import toast from 'react-hot-toast';

import { useOCRStore } from '@/store/ocrStore';
import { ProjectSummary, OCRResult } from '@/types';
import { buildFallbackSummary } from '@/services/export/projectExportService';
import { CanvasBookPreview, flowChaptersToLines, FlowLine, hyphenateWord } from './CanvasBookPreview';
import { getHyphenator } from '@/utils/hyphenation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  const [viewMode, setViewMode] = useState<'pages' | 'live'>('live');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Persisted preview settings
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>(() => {
    if (typeof window === 'undefined') return 'A5';
    const v = window.localStorage.getItem('bookPreview.pageSize');
    return (v === 'A4' || v === 'A5') ? v : 'A5';
  });
  const [liveFont, setLiveFont] = useState<number>(() => {
    if (typeof window === 'undefined') return 14;
    const v = parseInt(window.localStorage.getItem('bookPreview.font') || '14', 10);
    return isNaN(v) ? 14 : Math.min(22, Math.max(10, v));
  });
  const [liveLH, setLiveLH] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.5;
    const v = parseFloat(window.localStorage.getItem('bookPreview.lh') || '1.5');
    return isNaN(v) ? 1.5 : Math.min(2.0, Math.max(1.2, v));
  });
  const [remoteResults, setRemoteResults] = useState<OCRResult[]>([]);
  const [liveColumns, setLiveColumns] = useState<1 | 2>(() => {
    if (typeof window === 'undefined') return 1;
    const v = window.localStorage.getItem('bookPreview.columns');
    return v === '2' ? 2 : 1;
  });
  const liveCanvasesRef = React.useRef<HTMLCanvasElement[]>([]);
  const [remoteSummary, setRemoteSummary] = useState<ProjectSummary | null>(null);
  const [hydratingRemote, setHydratingRemote] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [hyphenLang, setHyphenLang] = useState<string>(() => {
    if (typeof window === 'undefined') return 'en';
    return window.localStorage.getItem('bookPreview.hyphenLang') || 'en';
  });
  // Feature toggles (persisted)
  const [includeTOC, setIncludeTOC] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem('bookPreview.includeTOC');
    return v === null ? true : v === '1';
  });
  const [includeFrontMatter, setIncludeFrontMatter] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem('bookPreview.frontMatter');
    return v === '1';
  });
  const [forceSingleColumn, setForceSingleColumn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem('bookPreview.forceSingleCol');
    return v === '1';
  });

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
  }, [projectResults, summaryForPages]);

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

  const exportCanvasPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: pageSize === 'A4' ? 'a4' : 'a5' });
      const canvases = liveCanvasesRef.current;
      canvases.forEach((cv, idx) => {
        if (idx > 0) doc.addPage();
        const img = cv.toDataURL('image/jpeg', 0.85);
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        doc.addImage(img, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
      });
      doc.save(`book-preview-${scopedProjectId}.pdf`);
      toast.success('Canvas PDF exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    }
  };

  const exportVectorPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: pageSize === 'A4' ? 'a4' : 'a5' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const padding = 48;
      const baseFont = liveFont;
      const lhPx = Math.round(baseFont * liveLH);
      const effectiveWidth = pageW - padding * 2;
      const useColumns = forceSingleColumn ? 1 : (pageSize === 'A4' ? (liveColumns) : 1) as 1 | 2;
      const colGap = 40;
      const perColWidth = useColumns === 1 ? effectiveWidth : Math.floor((effectiveWidth - colGap) / 2);
      
      const chapters = perPagePreviews.map(p => ({ title: p.title, content: p.content }));
      const scratch = document.createElement('canvas').getContext('2d');
      if (!scratch) throw new Error('No canvas context');
      scratch.font = `${baseFont}px Inter, system-ui, sans-serif`;
      const hyphenator = getHyphenator(hyphenLang || 'en', hyphenateWord);
      const lines = flowChaptersToLines(chapters, scratch as any, perColWidth, lhPx, 1.35, hyphenator);
      
      const adjusted: FlowLine[] = [];
      for (let i = 0; i < lines.length; i++) {
        const prev = lines[i - 1];
        const curr = lines[i];
        const next = lines[i + 1];
        if (curr && curr.text && (!prev || prev.text === '') && next && next.text === '') {
          if (adjusted.length && adjusted[adjusted.length - 1].text) {
            adjusted[adjusted.length - 1].text += ` ${  curr.text}`;
            continue;
          }
        }
        adjusted.push(curr);
      }
      
      let pageNum = 0;
      const addFooter = () => {
        doc.setFontSize(Math.round(baseFont * 0.8));
        doc.setTextColor(107, 114, 128);
        doc.text(String(pageNum), pageW / 2, pageH - padding, { align: 'center' });
      };
      const newPage = () => {
        if (pageNum > 0) doc.addPage();
        pageNum++;
        doc.setFont('helvetica', '');
        doc.setFontSize(baseFont);
        doc.setTextColor(17, 24, 39);
      };
      
      newPage();
      let y = padding;
      if (includeFrontMatter) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.round(baseFont * 1.8));
        doc.text('Project Preview', padding, y); y += lhPx * 2;
        doc.setFont('helvetica', ''); doc.setFontSize(baseFont);
        doc.text(`Pages: ${perPagePreviews.length}`, padding, y); y += lhPx;
        doc.text(`Generated: ${new Date().toLocaleString()}`, padding, y); y += lhPx;
        addFooter(); newPage(); y = padding;
      }
      if (includeTOC) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.round(baseFont * 1.5));
        doc.text('Table of Contents', padding, y); y += Math.round(lhPx * 1.5);
        doc.setFont('helvetica', '');
        const tocEntries = chapters.map((c, i) => ({ title: c.title, page: i + 1 }));
        tocEntries.forEach(entry => {
          if (y + lhPx > pageH - padding * 2) { addFooter(); newPage(); y = padding; doc.setFont('helvetica', ''); }
          const label = entry.title.length > 80 ? `${entry.title.slice(0, 77)  }…` : entry.title;
          const pageStr = String(entry.page + (includeFrontMatter ? 2 : 1));
          const base = `${label  } `;
          let dots = '';
          while (doc.getTextWidth(base + dots + pageStr) < (effectiveWidth - 80)) dots += '.';
          doc.text(base + dots + pageStr, padding, y);
          y += lhPx;
        });
        addFooter(); newPage(); y = padding;
      }
      
      let col = 0;
      doc.setFontSize(baseFont);
      adjusted.forEach(line => {
        if (y + lhPx > pageH - padding * 2) {
          if (useColumns === 2 && col === 0) {
            col = 1; y = padding; return;
          } else {
            addFooter();
            doc.addPage(); pageNum++; col = 0; y = padding; doc.setFontSize(baseFont);
          }
        }
        if (line.isTitle) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(Math.round(baseFont * 1.25));
        } else {
          doc.setFont('helvetica', '');
          doc.setFontSize(baseFont);
        }
        if (line.text) {
          const xBase = padding + (useColumns === 2 ? (col * (perColWidth + colGap)) : 0);
          doc.text(line.text, xBase, y, { baseline: 'top' });
        }
        y += lhPx;
      });
      addFooter();
      doc.save(`book-preview-vector-${scopedProjectId}.pdf`);
      toast.success('Vector PDF exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Vector export failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Clean, Professional Header */}
      <Card className="sticky top-0 z-10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Book Preview</CardTitle>
                <CardDescription className="mt-0.5">Professional layout with hyphenation, columns, and TOC</CardDescription>
                {(hydratingRemote || (summaryLoading && !hydratingRemote)) && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{hydratingRemote ? 'Syncing pages...' : 'Loading summary...'}</span>
                  </div>
                )}
              </div>
            </div>

          <div className="flex items-center gap-3">
            {/* Primary View Mode Toggle */}
            <div className="flex rounded-lg border border-border bg-muted overflow-hidden">
              <Button
                type="button"
                variant={viewMode === 'live' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-none h-8"
                onClick={() => setViewMode('live')}
              >
                <FileText className="h-4 w-4 mr-1" /> Live
              </Button>
              <Button
                type="button"
                variant={viewMode === 'pages' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-none h-8"
                onClick={() => setViewMode('pages')}
              >
                <LayoutGrid className="h-4 w-4 mr-1" /> Pages
              </Button>
            </div>

            {/* Essential Quick Controls for Live Mode */}
            {viewMode === 'live' && (
              <div className="flex items-center gap-2">
                {/* Quick Size Control */}
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value as 'A4' | 'A5';
                    setPageSize(val);
                    try { window.localStorage.setItem('bookPreview.pageSize', val); } catch { }
                  }}
                  className="h-8 text-xs w-20"
                >
                  <option value="A5">A5</option>
                  <option value="A4">A4</option>
                </Select>
              </div>
            )}

            {/* Advanced Settings Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Primary Action Button */}
            <Button
              type="button"
              size="sm"
              onClick={generatePreview}
              disabled={loading || isProcessing || needsMoreResults}
              className="shadow-sm h-8"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {loading ? 'Preparing' : 'Refresh'}
            </Button>
          </div>
        </div>
        </CardHeader>

        {/* Advanced Settings Panel */}
        {showAdvancedSettings && viewMode === 'live' && (
          <CardContent className="mt-4 p-6 rounded-lg border border-border bg-muted/50">
            {/* Typography Controls */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-foreground">Typography & Layout</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="range"
                        min={10}
                        max={22}
                        value={liveFont}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setLiveFont(v);
                          try { window.localStorage.setItem('bookPreview.font', String(v)); } catch { }
                        }}
                        className="flex-1 h-10"
                      />
                      <Badge variant="outline" className="w-12 text-xs justify-center">{liveFont}pt</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Line Height</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={1.2}
                      max={2.0}
                      value={liveLH}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        const clamped = isNaN(v) ? 1.5 : Math.min(2.0, Math.max(1.2, v));
                        setLiveLH(clamped);
                        try { window.localStorage.setItem('bookPreview.lh', String(clamped)); } catch { }
                      }}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Columns</Label>
                    <Select
                      value={liveColumns}
                      disabled={pageSize === 'A5'}
                      onChange={(e) => {
                        const v = (e.target.value === '2') ? 2 : 1;
                        setLiveColumns(v);
                        try { window.localStorage.setItem('bookPreview.columns', String(v)); } catch { }
                      }}
                      className="h-10 text-sm disabled:opacity-40"
                    >
                      <option value={1}>Single</option>
                      <option value={2}>Double</option>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Hyphenation</Label>
                    <Select
                      value={hyphenLang}
                      onChange={(e) => { const v = e.target.value; setHyphenLang(v); try { localStorage.setItem('bookPreview.hyphenLang', v); } catch { } }}
                      className="h-10 text-sm"
                    >
                      <option value="en">English</option>
                      <option value="am">Amharic</option>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Content Options */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-foreground">Content Options</h4>
                  {/* Export Options moved to the right */}
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!liveCanvasesRef.current.length}
                      onClick={exportCanvasPDF}
                      className="text-sm h-9"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!perPagePreviews.length}
                      onClick={exportVectorPDF}
                      className="text-sm h-9"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Vector
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Switch
                    checked={includeTOC}
                    onChange={(e) => { setIncludeTOC(e.target.checked); try { localStorage.setItem('bookPreview.includeTOC', e.target.checked ? '1' : '0'); } catch { } }}
                    label="Include Table of Contents"
                    className="p-3 rounded-lg border border-border/40 hover:bg-muted/30"
                  />
                  <Switch
                    checked={includeFrontMatter}
                    onChange={(e) => { setIncludeFrontMatter(e.target.checked); try { localStorage.setItem('bookPreview.frontMatter', e.target.checked ? '1' : '0'); } catch { } }}
                    label="Include Front Matter"
                    className="p-3 rounded-lg border border-border/40 hover:bg-muted/30"
                  />
                  <Switch
                    checked={forceSingleColumn}
                    onChange={(e) => { setForceSingleColumn(e.target.checked); try { localStorage.setItem('bookPreview.forceSingleCol', e.target.checked ? '1' : '0'); } catch { } }}
                    label="Force Single Column"
                    className="p-3 rounded-lg border border-border/40 hover:bg-muted/30"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Status Messages */}
      {needsMoreResults && (
        <Card className="border-amber-200 bg-amber-50 text-amber-800">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Ready to Preview</p>
              <p className="text-sm">Run OCR on a document to build a professional book-style preview.</p>
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

      {/* Main Content Area */}
      <Card className="bg-background/50 backdrop-blur-sm overflow-hidden">
        {viewMode === 'pages' ? renderPageMode() : (
          <CardContent className="p-4">
            <CanvasBookPreview
              pages={perPagePreviews.map(p => ({ title: p.title, content: p.content }))}
              pageSize={pageSize}
              fontSize={liveFont}
              lineHeight={liveLH}
              columns={pageSize === 'A4' ? liveColumns : 1}
              hyphenLang={hyphenLang}
              toc={perPagePreviews.map((p, i) => ({ title: p.title, page: i + 1 }))}
              includeTOC={true}
              onRender={(cvs) => { liveCanvasesRef.current = cvs; }}
            />
          </CardContent>
        )}
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