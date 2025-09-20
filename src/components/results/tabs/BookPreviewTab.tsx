import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { 
  FileText, 
  Loader2, 
  Sparkles, 
  AlertTriangle, 
  Monitor, 
  Settings2, 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  FileDown,
  FileText as FileTextIcon,
  File,
  Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

import { useOCRStore } from '@/store/ocrStore';
import { ProjectSummary, OCRResult } from '@/types';
import { buildFallbackSummary } from '@/services/export/projectExportService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerBody, 
  DrawerClose 
} from '@/components/ui/drawer';
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
  
  // Editor panel state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Typography states
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(14);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  
  // Layout states
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [margin, setMargin] = useState(40);
  
  // Ref for preview container (for export)
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  // Export functions
  const handleExportPDF = useCallback(async () => {
    if (!previewContainerRef.current) return;
    
    try {
      toast.loading('Generating PDF...', { id: 'pdf-export' });
      
      const canvas = await html2canvas(previewContainerRef.current, { 
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ 
        unit: 'mm', 
        format: pageSize.toLowerCase() as 'a4' | 'a5' 
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - (margin * 2 / 3.78); // Convert px to mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin / 3.78, margin / 3.78, imgWidth, imgHeight);
      pdf.save('document-preview.pdf');
      
      toast.success('PDF exported successfully!', { id: 'pdf-export' });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF', { id: 'pdf-export' });
    }
  }, [pageSize, margin]);

  const handleExportDOCX = useCallback(async () => {
    try {
      toast.loading('Generating DOCX...', { id: 'docx-export' });
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: perPagePreviews.map(page => 
            new Paragraph({
              children: [
                new TextRun({
                  text: page.title,
                  bold: true,
                  size: 28,
                }),
                new TextRun({
                  text: '\n\n' + page.content,
                  size: fontSize * 2, // DOCX uses half-points
                }),
                new TextRun({
                  text: '\n\n',
                  break: 2,
                }),
              ],
            })
          ),
        }],
      });
      
      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'document-preview.docx');
      
      toast.success('DOCX exported successfully!', { id: 'docx-export' });
    } catch (error) {
      console.error('DOCX export failed:', error);
      toast.error('Failed to export DOCX', { id: 'docx-export' });
    }
  }, [perPagePreviews, fontSize]);

  const handleExportTXT = useCallback(() => {
    const textContent = perPagePreviews
      .map(page => `${page.title}\n\n${page.content}\n\n`)
      .join('\n---\n\n');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'document-preview.txt');
    toast.success('TXT exported successfully!');
  }, [perPagePreviews]);

  const handleExportHTML = useCallback(() => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Preview</title>
  <style>
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      text-align: ${textAlign};
      margin: ${margin}px;
      max-width: ${pageSize === 'A4' ? '210mm' : '148mm'};
      padding: 20px;
    }
    .page {
      margin-bottom: 40px;
      page-break-after: always;
    }
    .page-title {
      font-size: 1.5em;
      font-weight: bold;
      margin-bottom: 1em;
    }
  </style>
</head>
<body>
  ${perPagePreviews.map(page => `
    <div class="page">
      <h2 class="page-title">${page.title}</h2>
      <pre style="white-space: pre-wrap; font-family: inherit;">${page.content}</pre>
    </div>
  `).join('\n')}
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    saveAs(blob, 'document-preview.html');
    toast.success('HTML exported successfully!');
  }, [perPagePreviews, fontFamily, fontSize, lineHeight, textAlign, margin, pageSize]);

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
            style={{
              width: pageSize === 'A4' ? '794px' : '559px',
              maxWidth: '100%',
              margin: '0 auto',
            }}
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
              <div 
                className="rounded-lg border border-dashed border-border/40 bg-white p-4"
                style={{
                  fontFamily: fontFamily === 'serif' ? 'Georgia, serif' : fontFamily === 'monospace' ? 'Consolas, monospace' : 'system-ui, sans-serif',
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  textAlign: textAlign,
                  padding: `${margin}px`,
                }}
              >
                <pre className="whitespace-pre-wrap text-black" style={{ fontFamily: 'inherit' }}>
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
              {/* Edit Layout Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => setIsEditorOpen(true)}
                disabled={!effectiveResults.length}
                className="shadow-sm h-8"
                variant="outline"
              >
                <Settings2 className="w-4 h-4 mr-1" />
                Edit Layout
              </Button>
              
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
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Preview Error</p>
              <p className="text-sm text-destructive/80">{error}</p>
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

      {/* Main Content Area with relative positioning for drawer */}
      <div className="relative">
        <Card className="bg-background/50 backdrop-blur-sm overflow-hidden" ref={previewContainerRef}>
          {renderPageMode()}
        </Card>
        
        {/* Document Editor Drawer */}
        <Drawer open={isEditorOpen} onOpenChange={setIsEditorOpen} side="right" container>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Document Editor</DrawerTitle>
              <DrawerDescription>Customize typography and layout settings</DrawerDescription>
              <DrawerClose onClose={() => setIsEditorOpen(false)} />
            </DrawerHeader>
            
            <DrawerBody>
              {/* Typography Controls */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/40 pb-3">
                  <Type className="h-4 w-4" />
                  Typography
                </div>
                
                {/* Font Family */}
                <div className="space-y-2">
                  <Label htmlFor="fontFamily" className="text-sm font-medium">Font Family</Label>
                  <Select 
                    id="fontFamily"
                    value={fontFamily} 
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="bg-background border-border/60"
                  >
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                  </Select>
                </div>
                
                {/* Font Size */}
                <div className="space-y-2">
                  <Label htmlFor="fontSize" className="text-sm font-medium">Font Size: {fontSize}px</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      id="fontSize"
                      min={8}
                      max={32}
                      step={1}
                      value={[fontSize]}
                      onValueChange={([val]) => setFontSize(val)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={8}
                      max={32}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value) || 14)}
                      className="w-16 h-9 bg-background border-border/60"
                    />
                  </div>
                </div>
                
                {/* Line Height */}
                <div className="space-y-2">
                  <Label htmlFor="lineHeight" className="text-sm font-medium">Line Height: {lineHeight.toFixed(1)}</Label>
                  <Slider
                    id="lineHeight"
                    min={1}
                    max={2.5}
                    step={0.1}
                    value={[lineHeight]}
                    onValueChange={([val]) => setLineHeight(val)}
                  />
                </div>
                
                {/* Text Alignment */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Text Alignment</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={textAlign === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('left')}
                      className="flex items-center gap-1.5 h-9"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                      Left
                    </Button>
                    <Button
                      variant={textAlign === 'center' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('center')}
                      className="flex items-center gap-1.5 h-9"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                      Center
                    </Button>
                    <Button
                      variant={textAlign === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('right')}
                      className="flex items-center gap-1.5 h-9"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                      Right
                    </Button>
                    <Button
                      variant={textAlign === 'justify' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('justify')}
                      className="flex items-center gap-1.5 h-9"
                    >
                      <AlignJustify className="h-3.5 w-3.5" />
                      Justify
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Layout Options */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/40 pb-3">
                  <FileText className="h-4 w-4" />
                  Layout
                </div>
                
                {/* Page Size */}
                <div className="space-y-2">
                  <Label htmlFor="pageSize" className="text-sm font-medium">Page Size</Label>
                  <Select 
                    id="pageSize"
                    value={pageSize} 
                    onChange={(e) => setPageSize(e.target.value as 'A4' | 'A5')}
                    className="bg-background border-border/60"
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                  </Select>
                </div>
                
                {/* Margin */}
                <div className="space-y-2">
                  <Label htmlFor="margin" className="text-sm font-medium">Page Margin: {margin}px</Label>
                  <Slider
                    id="margin"
                    min={0}
                    max={100}
                    step={5}
                    value={[margin]}
                    onValueChange={([val]) => setMargin(val)}
                  />
                </div>
              </div>
              
              {/* Export Options */}
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileDown className="h-4 w-4" />
                  Export Options
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleExportPDF} size="sm" variant="outline" className="flex items-center gap-1.5 h-9">
                    <FileDown className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button onClick={handleExportDOCX} size="sm" variant="outline" className="flex items-center gap-1.5 h-9">
                    <FileTextIcon className="h-3.5 w-3.5" />
                    DOCX
                  </Button>
                  <Button onClick={handleExportTXT} size="sm" variant="outline" className="flex items-center gap-1.5 h-9">
                    <File className="h-3.5 w-3.5" />
                    TXT
                  </Button>
                  <Button onClick={handleExportHTML} size="sm" variant="outline" className="flex items-center gap-1.5 h-9">
                    <Globe className="h-3.5 w-3.5" />
                    HTML
                  </Button>
                </div>
              </div>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
};

interface Props {
  result: OCRResult;
}

export const BookPreviewTab: React.FC<Props> = ({ result }) => {
  return <BookPreviewInner result={result} />;
};