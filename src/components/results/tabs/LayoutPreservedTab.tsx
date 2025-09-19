import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as UTIF from 'utif';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Type, Wand2, Loader2, RotateCcw, CheckCheck, XCircle, MoreVertical, Copy as CopyIcon, Sparkles, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

import { OCRResult } from '@/types';
import { useOCRStore } from '@/store/ocrStore';
import { checkAvailableApiKeys } from '@/utils/validationUtils';
import { getEdgeProgress } from '@/services/edge/edgeLLMService';

import { SafeMarkdown } from './layout/SafeMarkdown';
import { DiffView } from './layout/DiffView';
import { ToolbarButton } from './layout/Controls';
import {
  cleanupAsciiNoiseAndItalics,
  smartFormatToMarkdown,
  normalizeMarkdownForReview,
  replaceRange,
  escapeRegex,
} from './layout/utils';
import { extractJsonFromText } from '@/utils/textUtils';

interface Props {
  result: OCRResult;
}

export const LayoutPreservedTab: React.FC<Props> = ({ result }) => {
  const { updateResult, settings, files, toggleSettings, ensureOriginalSnapshots } = useOCRStore() as any;
  const typedFiles: any[] = files;
  const currentFile = useMemo(() => typedFiles.find((file) => file.id === result.fileId), [typedFiles, result.fileId]);
  const apiStatus = checkAvailableApiKeys(settings);

  useEffect(() => {
    const info = {
      geminiExists: !!settings.apiKey,
      geminiLen: settings.apiKey?.length || 0,
      openRouterExists: !!settings.openRouterApiKey,
      openRouterLen: settings.openRouterApiKey?.length || 0,
      provider: apiStatus.primaryProvider,
      hasAny: apiStatus.hasAnyApiKey,
    };
    console.log('🔧 Layout tab debug (once per change):', info);
  }, [settings.apiKey, settings.openRouterApiKey, apiStatus.hasAnyApiKey, apiStatus.primaryProvider]);

  const initial = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
  const [draft, setDraft] = useState(initial);
  const [autoSaved, setAutoSaved] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<string | null>(null);
  const [pendingProposalRaw, setPendingProposalRaw] = useState<string | null>(null);
  const [pendingProposalExact, setPendingProposalExact] = useState<string | null>(null);
  const [comparisonBase, setComparisonBase] = useState<string | null>(null);
  const [isProofreading, setIsProofreading] = useState(false);
  const [appliedPulse, setAppliedPulse] = useState(false);
  const [pfProgress, setPfProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCorrectingWithVision, setIsCorrectingWithVision] = useState(false);
  const [ignoredWords, setIgnoredWords] = useState<string[]>(() => (result as any).metadata?.ignoredWords || []);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [quickTips, setQuickTips] = useState<string[] | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'text' | 'original'>('text');
  const [applyPulse, setApplyPulse] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsContainerRef = useRef<HTMLDivElement | null>(null);
  const [fontScale, setFontScale] = useState<number>(1);
  const [wrapEditor, setWrapEditor] = useState<boolean>(false);
  const [zen, setZen] = useState(false);

  // Load persisted preferences
  useEffect(() => {
    try {
      const fs = parseFloat(localStorage.getItem('lp.fontScale') || '');
      if (!Number.isNaN(fs) && fs >= 0.8 && fs <= 1.5) setFontScale(fs);
      const wrap = localStorage.getItem('lp.wrap');
      if (wrap === '1') setWrapEditor(true);
    } catch { }
  }, []);
  // Persist preferences
  useEffect(() => {
    try { localStorage.setItem('lp.fontScale', String(fontScale)); } catch { }
  }, [fontScale]);
  useEffect(() => {
    try { localStorage.setItem('lp.wrap', wrapEditor ? '1' : '0'); } catch { }
  }, [wrapEditor]);

  useEffect(() => {
    if (!actionsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!actionsContainerRef.current) return;
      if (!actionsContainerRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionsOpen]);

  const debounceRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const preview = useMemo(() => draft, [draft]);

  const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;
  const isEthiopic = (result.detectedLanguage === 'am') || ETH_RE.test(preview);
  const engine = (result.metadata as any)?.engine || 'unknown';
  const routingMode = (settings as any)?.routingMode || 'auto';
  const edgeEnabled = !!(settings as any)?.edgeLLMEnabled;

  const hasProposal = Boolean(pendingProposal);
  const showAiOverlay = isProofreading || isAnalyzing || isCorrectingWithVision;
  const aiStateLabel = isCorrectingWithVision ? 'Vision reviewing' : isAnalyzing ? 'Analyzing' : 'Preparing';
  const aiStateBadge = isCorrectingWithVision ? 'AI Vision' : apiStatus.hasGemini ? 'Gemini AI' : 'OpenRouter AI';
  const disableEditorInteractions = showAiOverlay;

  const [edgeProgress, setEdgeProgress] = useState(0);
  useEffect(() => {
    if (!edgeEnabled) {
      setEdgeProgress(0);
      return;
    }
    const timer = window.setInterval(() => setEdgeProgress(getEdgeProgress()), 300);
    return () => window.clearInterval(timer);
  }, [edgeEnabled]);

  // Update draft and metadata when switching files; restore ignored words and clear pending proposals
  useEffect(() => {
    const next = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
    setDraft(next);
    ensureOriginalSnapshots?.();
    setIgnoredWords((result as any).metadata?.ignoredWords || []);
    setPendingProposal(null);
    setPendingProposalRaw(null);
    setComparisonBase(null);
  }, [result.fileId, ensureOriginalSnapshots]);

  // Reset suggestion count when proposal is cleared
  useEffect(() => {
    if (!pendingProposal) setSuggestionCount(0);
  }, [pendingProposal]);

  // On first open for a file without explicit markdown, auto-format the OCR text
  useEffect(() => {
    if (!result.metadata?.layoutMarkdown) {
      const hasHeading = /^\s{0,3}#{1,6}\s/m.test(draft);
      if (!hasHeading && draft?.trim()) {
        const formatted = smartFormatToMarkdown(draft);
        if (formatted !== draft) setDraft(formatted);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.fileId]);

  // Debounced autosave of markdown to result metadata
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (draft !== initial) {
        updateResult(result.fileId, { metadata: { layoutMarkdown: draft } as any });
        setAutoSaved(true);
        window.setTimeout(() => setAutoSaved(false), 1000);
      }
    }, 1000);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [draft, initial, result.fileId, updateResult]);

  // Animate proofreading/analysis progress bar
  useEffect(() => {
    if (!isProofreading) {
      setPfProgress(0);
      return;
    }
    let progress = 0;
    const timer = window.setInterval(() => {
      progress = (progress + 5) % 100;
      const next = progress < 10 ? 10 : progress > 95 ? 10 : progress;
      setPfProgress(next);
    }, 120);
    return () => window.clearInterval(timer);
  }, [isProofreading]);

  const withEditor = useCallback((fn: (element: HTMLTextAreaElement) => void) => {
    const element = editorRef.current;
    if (!element) return;
    fn(element);
    element.focus();
  }, []);

  const applyWrap = (left: string, right: string) => {
    withEditor((element) => {
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const selected = draft.slice(start, end) || 'text';
      const next = replaceRange(draft, start, end, `${left}${selected}${right}`);
      setDraft(next);
      const cursor = start + left.length + selected.length + right.length;
      requestAnimationFrame(() => element.setSelectionRange(cursor, cursor));
    });
  };

  const applyPrefix = (prefix: string) => {
    withEditor((element) => {
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const before = draft.slice(0, start);
      const after = draft.slice(end);
      const lineStart = before.lastIndexOf('\n') + 1;
      const next = draft.slice(0, lineStart) + prefix + draft.slice(lineStart, end) + after;
      setDraft(next);
      const cursor = lineStart + prefix.length + (end - lineStart);
      requestAnimationFrame(() => element.setSelectionRange(cursor, cursor));
    });
  };

  const applyLinePrefix = (prefix: string) => {
    withEditor((element) => {
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const block = draft.slice(start, end);
      const updated = block.split(/\n/).map((line) => (line.trim() ? `${prefix}${line}` : line)).join('\n');
      const next = replaceRange(draft, start, end, updated);
      setDraft(next);
      const cursor = start + updated.length;
      requestAnimationFrame(() => element.setSelectionRange(cursor, cursor));
    });
  };

  const insertLink = () => {
    withEditor((element) => {
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const selected = draft.slice(start, end) || 'link-text';
      const url = 'https://';
      const snippet = `[${selected}](${url})`;
      const next = replaceRange(draft, start, end, snippet);
      setDraft(next);
      const caret = start + snippet.indexOf('(') + 1;
      requestAnimationFrame(() => element.setSelectionRange(caret, caret + url.length));
    });
  };

  const describeProvider = (value: unknown) => {
    const key = String(value);
    if (key === 'local') return 'Local';
    if (key.startsWith('openrouter')) return 'OpenRouter';
    return 'Gemini';
  };

  const runUnifiedAIFix = async () => {
    const originalFile = typedFiles.find((file: any) => file.id === result.fileId);
    const canVision = apiStatus.hasAnyApiKey && !!originalFile?.preview;

    if (!apiStatus.hasAnyApiKey) {
      toast.error('Add a Gemini or OpenRouter API key in Settings to use AI');
      toggleSettings();
      return;
    }

    setIsCorrectingWithVision(true);
    const provider = apiStatus.hasGemini ? 'Gemini' : 'OpenRouter';
    toast.loading(`${provider} AI preparing suggestions…`, { id: 'ai-fix' });
    setComparisonBase(normalizeMarkdownForReview(draft, result.detectedLanguage));

    try {
      if (canVision) {
        try {
          const { correctTextWithAIVision } = await import('@/services/geminiService');
          const { correctedText, source } = await correctTextWithAIVision(
            draft,
            originalFile!.preview || originalFile!.originalPreview || '',
            settings
          );
          const parseCorrected = (value: string): string => {
            try {
              // Some providers occasionally return the entire JSON blob as a string.
              // If so, extract and use only the correctedText field.
              if (/^\s*`{3}/.test(value) || /"correctedText"\s*:/.test(value)) {
                const json = extractJsonFromText(value);
                const obj = JSON.parse(json);
                if (obj && typeof obj.correctedText === 'string') return obj.correctedText;
              }
            } catch {
              // fall through and return the raw value below
            }
            return value;
          };

          const cleanedText = parseCorrected(correctedText);
          const staged = normalizeMarkdownForReview(cleanedText, result.detectedLanguage);
          setPendingProposalRaw(cleanedText);
          setPendingProposalExact(cleanedText);
          setPendingProposal(staged);
          setAppliedPulse(true);
          setTimeout(() => setAppliedPulse(false), 1500);
          toast.success(`${describeProvider(source)} suggested changes — review and accept/reject.`, { id: 'ai-fix' });
          return;
        } catch (visionError) {
          console.warn('Vision path failed; falling back to proofreading:', visionError);
        }
      }

      const { proofreadAmharicWithMeta } = await import('@/services/geminiService');
      const { suggestions, source } = await proofreadAmharicWithMeta(draft, settings, { maxSuggestions: 30 });

      let transformed = draft;
      let applied = 0;

      if (Array.isArray(suggestions) && suggestions.length) {
        for (const suggestion of suggestions) {
          const original = String(suggestion.original || '').trim();
          const replacement = String(suggestion.suggestion || '').trim();
          if (!original || !replacement || original === replacement) continue;

          const escaped = escapeRegex(original).replace(/\s+/g, '\\s+');
          const regex = new RegExp(escaped, 'g');
          const prior = transformed;
          transformed = transformed.replace(regex, replacement);
          if (transformed !== prior) {
            applied++;
            continue;
          }

          const fallback = transformed.split(original).join(replacement);
          if (fallback !== transformed) {
            transformed = fallback;
            applied++;
          }
        }
      }

      const exact = transformed;
      let previewText = transformed;
      const cleaned = cleanupAsciiNoiseAndItalics(transformed);
      if (cleaned !== transformed) {
        previewText = cleaned;
      }

      if (applied > 0 && exact !== draft) {
        const staged = normalizeMarkdownForReview(previewText, result.detectedLanguage);
        setPendingProposalRaw(previewText);
        setPendingProposalExact(exact);
        setPendingProposal(staged);
        setAppliedPulse(true);
        setTimeout(() => setAppliedPulse(false), 900);
        toast.success(`${describeProvider(source)} suggested ${applied} fixes — review and accept/reject.`, { id: 'ai-fix' });
      } else {
        toast(`${describeProvider(source)} found no changes needed.`, { id: 'ai-fix' });
      }
    } catch (error) {
      console.error('Unified AI Fix failed:', error);
      const providerName = apiStatus.hasGemini ? 'Gemini' : 'OpenRouter';
      toast.error(`${providerName} AI improvement failed`, { id: 'ai-fix' });
    } finally {
      setIsCorrectingWithVision(false);
    }
  };

  const getAiTitle = () => {
    if (!apiStatus.hasAnyApiKey) return 'Configure Gemini/OpenRouter in Settings (click to open)';
    return `AI review with ${apiStatus.hasGemini ? 'Gemini' : 'OpenRouter'} — propose changes for approval`;
  };


  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-1">
        <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm p-5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Layout-preserved editor
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">Focus mode</span>
            </h3>
            {hasProposal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-3 h-3" /> Fresh AI suggestions ready
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Refine structured Amharic output with live AI proofreading. Accept, adjust, or dismiss changes while keeping the original layout intact.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {currentFile?.name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground">
                <Type className="w-3 h-3" />
                {currentFile.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground">
              <span className="block w-2 h-2 rounded-full bg-emerald-500" />
              Engine: {engine}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground">Routing: {routingMode}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground">Language: {result.detectedLanguage || 'unknown'}</span>
            {edgeEnabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground">
                <Loader2 className={`w-3 h-3 ${edgeProgress > 0 && edgeProgress < 100 ? 'animate-spin text-primary' : 'text-emerald-500'}`} />
                Edge LLM {edgeProgress > 0 && edgeProgress < 100 ? `loading ${edgeProgress}%` : 'ready'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-[72vh] min-h-[24rem]">
        <div className="bg-card text-card-foreground border border-border rounded-3xl shadow-sm p-5 overflow-hidden flex flex-col h-full min-h-0">
          <div className="flex items-start justify-between mb-4 border-b border-border pb-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Code className="w-5 h-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Markdown editor</p>
                <p className="text-sm text-muted-foreground">
                  Polish the OCR draft before exporting or sharing. Keyboard shortcuts stay active for bold/italic.
                </p>
              </div>
            </div>
            {autoSaved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Auto-saved
              </span>
            )}
          </div>
          <div className={`flex flex-wrap gap-1.5 items-center mb-4 rounded-2xl border px-3 py-2 ${showAiOverlay ? 'bg-accent/60 border-accent' : 'bg-muted/70 border-border'}`}>
            <ToolbarButton title={getAiTitle()} onClick={runUnifiedAIFix} disabled={disableEditorInteractions}>
              {showAiOverlay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </ToolbarButton>
            <ToolbarButton
              title="Restore original OCR text"
              onClick={() => {
                const original = (result as any).metadata?.originalOCRText || '';
                if (!original) {
                  toast('No original snapshot available');
                  return;
                }
                if (!window.confirm('Restore the original OCR text? This will replace current draft.')) return;
                setDraft(original);
                setPendingProposal(null);
                setPendingProposalRaw(null);
                setComparisonBase(null);
                updateResult(result.fileId, {
                  extractedText: original,
                  layoutPreserved: original,
                  metadata: { ...(result as any).metadata, layoutMarkdown: original },
                });
                toast.success('Restored original OCR text');
              }}
              disabled={disableEditorInteractions}
            >
              <RotateCcw className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Format (auto)" onClick={() => setDraft((value) => smartFormatToMarkdown(value))} disabled={disableEditorInteractions}><Type className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 1" onClick={() => applyPrefix('# ')} disabled={disableEditorInteractions}><Heading1 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => applyPrefix('## ')} disabled={disableEditorInteractions}><Heading2 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bold" onClick={() => applyWrap('**', '**')} disabled={disableEditorInteractions}><Bold className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => applyWrap('*', '*')} disabled={disableEditorInteractions}><Italic className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bulleted list" onClick={() => applyLinePrefix('- ')} disabled={disableEditorInteractions}><List className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => applyLinePrefix('1. ')} disabled={disableEditorInteractions}><ListOrdered className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Quote" onClick={() => applyLinePrefix('> ')} disabled={disableEditorInteractions}><Quote className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Inline code" onClick={() => applyWrap('`', '`')} disabled={disableEditorInteractions}><Code className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Link" onClick={insertLink} disabled={disableEditorInteractions}><LinkIcon className="w-4 h-4" /></ToolbarButton>
            <button
              type="button"
              className={`px-2 py-1 text-[11px] rounded border ${disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-accent'} border-border`}
              title="Zen mode (fullscreen)"
              onClick={() => {
                if (disableEditorInteractions) return;
                setZen(true);
              }}
              disabled={disableEditorInteractions}
            >
              Zen
            </button>
            <div className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                className={`px-2 py-1 text-[11px] rounded border ${disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-accent'} border-border`}
                title="Smaller text"
                onClick={() => {
                  if (disableEditorInteractions) return;
                  setFontScale((s) => Math.max(0.8, +(s - 0.1).toFixed(2)));
                }}
                disabled={disableEditorInteractions}
              >
                A−
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] rounded border ${disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-accent'} border-border`}
                title="Larger text"
                onClick={() => {
                  if (disableEditorInteractions) return;
                  setFontScale((s) => Math.min(1.5, +(s + 0.1).toFixed(2)));
                }}
                disabled={disableEditorInteractions}
              >A+</button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] rounded border ${wrapEditor ? 'bg-foreground text-background border-foreground' : disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-accent border-border'}`}
                title="Toggle line wrap"
                onClick={() => {
                  if (disableEditorInteractions) return;
                  setWrapEditor((v) => !v);
                }}
                disabled={disableEditorInteractions}
              >Wrap</button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] rounded border ${disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-accent'} border-border`}
                title="Reset font & wrap"
                onClick={() => {
                  if (disableEditorInteractions) return;
                  setFontScale(1);
                  setWrapEditor(false);
                }}
                disabled={disableEditorInteractions}
              >Reset</button>
            </div>
            {settings.allowBasicLLMGuidance && settings.apiKey && (
              <button
                type="button"
                title="Quick tips (low tokens)"
                onClick={async () => {
                  try {
                    setTipsLoading(true);
                    const { getQuickTips } = await import('@/services/geminiService');
                    const tips = await getQuickTips(draft || '', settings);
                    setQuickTips(tips);
                  } finally {
                    setTipsLoading(false);
                  }
                }}
                className={`ml-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border ${disableEditorInteractions ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground hover:bg-accent'} border-border`}
                disabled={disableEditorInteractions}
              >
                {tipsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Tips
              </button>
            )}
          </div>
          {quickTips && quickTips.length > 0 && (
            <div className="mb-4 rounded-2xl border border-border bg-muted px-4 py-3 text-xs text-foreground">
              <div className="flex items-center gap-1 text-foreground font-semibold text-[11px] uppercase tracking-wide"><Sparkles className="w-3 h-3" /> Quick guidance</div>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                {quickTips.map((t, i) => (<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}

          {hasProposal && (
            <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted-foreground mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                <Sparkles className="w-3 h-3" />
                Right-click highlighted words in the preview to accept or ignore.
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCheck className="w-3 h-3" />
                Apply from the actions menu to commit all changes.
              </div>
            </div>
          )}

          <div className={`relative flex-1 min-h-0 ${appliedPulse ? 'ring-4 ring-emerald-500/30 rounded-2xl' : ''}`}>
            {showAiOverlay && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted rounded-t z-30 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-200 ease-linear ${isCorrectingWithVision ? 'bg-primary' : 'bg-accent'}`}
                  style={{ width: `${pfProgress}%` }}
                />
              </div>
            )}

            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              ref={editorRef}
              onKeyDown={(event) => {
                const isMeta = event.metaKey || event.ctrlKey;
                if (isMeta && (event.key === 'b' || event.key === 'B')) {
                  event.preventDefault();
                  applyWrap('**', '**');
                }
                if (isMeta && (event.key === 'i' || event.key === 'I')) {
                  event.preventDefault();
                  applyWrap('*', '*');
                }
              }}
              className={`w-full h-full min-h-[18rem] p-3 md:p-3.5 border border-input rounded-2xl font-mono bg-muted text-foreground placeholder:text-muted-foreground shadow-inner resize-none overflow-auto transition focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${wrapEditor ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'} ${showAiOverlay ? 'opacity-60' : ''}`}
              style={{ fontSize: `${Math.round(14 * fontScale)}px`, lineHeight: 1.6 }}
              disabled={showAiOverlay}
            />

            {showAiOverlay && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 backdrop-blur-sm text-sm text-foreground">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {aiStateBadge}
                </span>
                <p className="text-xs text-muted-foreground text-center max-w-[220px]">{aiStateLabel} the document to build cleaner suggestions. You can cancel anytime.</p>
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded-full border border-border bg-background hover:bg-accent"
                  onClick={() => {
                    setIsProofreading(false);
                    setIsAnalyzing(false);
                    setIsCorrectingWithVision(false);
                    toast('Canceled', { id: 'ai-fix' });
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
          <div className="sticky top-0 z-20 bg-card/95 backdrop-blur px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-foreground text-background">
                {previewMode === 'text' ? <Sparkles className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{previewMode === 'text' ? 'Smart preview' : 'Original snapshot'}</p>
                <p className="text-sm text-muted-foreground">
                  {previewMode === 'text'
                    ? hasProposal
                      ? 'Review highlighted diffs and right-click to accept or ignore.'
                      : 'Preview the cleaned markdown exactly as it will export.'
                    : 'Compare side-by-side with the captured file to validate layout.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2" ref={actionsContainerRef}>
              <div className="relative inline-flex bg-muted rounded-xl p-0.5 text-xs" role="tablist" aria-label="Preview mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'text'}
                  className={`px-2.5 py-1 rounded-lg outline-none focus:ring-2 focus:ring-ring transition ${previewMode === 'text' ? 'bg-background shadow border border-border text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setPreviewMode('text')}
                >Text</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'original'}
                  className={`px-2.5 py-1 rounded-lg outline-none focus:ring-2 focus:ring-ring transition ${previewMode === 'original' ? 'bg-background shadow border border-border text-foreground' : currentFile?.preview ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 cursor-not-allowed'}`}
                  onClick={() => currentFile?.preview && setPreviewMode('original')}
                  disabled={!currentFile?.preview}
                  title={currentFile?.preview ? 'View original layout' : 'No original preview available'}
                >Original</button>
              </div>
              {hasProposal && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold whitespace-nowrap">
                  {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'}
                </span>
              )}
              {hasProposal && (
                <button
                  type="button"
                  title="AI actions"
                  aria-haspopup="menu"
                  aria-expanded={actionsOpen}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border border-border bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring ${applyPulse ? 'ring-2 ring-green-300 shadow' : ''}`}
                  onClick={() => setActionsOpen(v => !v)}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
              {actionsOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 z-30 min-w-[220px] rounded-2xl border border-border bg-card shadow-xl">
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={() => {
                      let proposed = pendingProposalExact ?? pendingProposalRaw ?? pendingProposal ?? draft;
                      try {
                        if (/^\s*`{3}/.test(proposed) || /"correctedText"\s*:/.test(proposed)) {
                          const json = extractJsonFromText(proposed);
                          const obj = JSON.parse(json);
                          if (obj && typeof obj.correctedText === 'string') proposed = obj.correctedText;
                        }
                      } catch { }
                      const base = comparisonBase || draft;
                      if (proposed.length === 0 && base.length > 0 && !window.confirm('The suggestion would clear the content. Apply anyway?')) {
                        return;
                      }
                      setDraft(proposed);
                      setPendingProposal(null);
                      setPendingProposalRaw(null);
                      setPendingProposalExact(null);
                      setComparisonBase(null);
                      const snapshot = (result as any).metadata?.originalBeforeAI || base;
                      updateResult(result.fileId, {
                        extractedText: proposed,
                        layoutPreserved: proposed,
                        metadata: { ...(result as any).metadata, layoutMarkdown: proposed, originalBeforeAI: snapshot },
                      });
                      setSuggestionCount(0);
                      toast.success('Applied AI changes');
                      setApplyPulse(true);
                      window.setTimeout(() => setApplyPulse(false), 700);
                      setActionsOpen(false);
                    }}
                  >
                    <CheckCheck className="w-4 h-4 text-green-600" />
                    <span>Apply all changes</span>
                  </button>
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setPendingProposal(null);
                      setPendingProposalRaw(null);
                      setPendingProposalExact(null);
                      setComparisonBase(null);
                      setSuggestionCount(0);
                      toast('Discarded AI proposal');
                      setActionsOpen(false);
                    }}
                  >
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span>Discard suggestions</span>
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                    onClick={async () => {
                      try {
                        const base = pendingProposalRaw ?? pendingProposal ?? draft;
                        const normalized = normalizeMarkdownForReview(base, result.detectedLanguage);
                        const cleaned = cleanupAsciiNoiseAndItalics(normalized);
                        await navigator.clipboard.writeText(cleaned);
                        toast.success('Cleaned text copied');
                      } catch (e) {
                        console.warn('Copy failed', e);
                        toast.error('Copy failed');
                      } finally {
                        setActionsOpen(false);
                      }
                    }}
                  >
                    <CopyIcon className="w-4 h-4 text-muted-foreground" />
                    <span>Copy cleaned text</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showAiOverlay && previewMode === 'text' && (
            <div className="px-5 pt-4">
              <div className="h-3 w-52 bg-muted rounded-full animate-pulse" />
            </div>
          )}

          {hasProposal && previewMode === 'text' ? (
            <div className={`prose prose-slate dark:prose-invert max-w-none w-full px-5 pb-5 text-[15px] leading-7 overflow-auto flex-1 prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-a:text-primary ${isEthiopic ? 'font-ethiopic' : ''}`} style={{ fontSize: `${Math.round(15 * fontScale)}px`, lineHeight: 1.7 }}>
              <DiffView
                original={comparisonBase || draft}
                current={pendingProposal!}
                isEthiopic={isEthiopic}
                mode="word"
                ignoredWords={ignoredWords}
                onIgnoreWord={(word) => {
                  const normalized = word;
                  setIgnoredWords((prev) => {
                    if (prev.includes(normalized)) return prev;
                    const next = [...prev, normalized];
                    updateResult(result.fileId, { metadata: { ...(result as any).metadata, ignoredWords: next } });
                    return next;
                  });
                }}
                onSuggestionCountChange={(count) => setSuggestionCount(count)}
                onUpdate={(next) => {
                  if (next.base !== undefined) {
                    const normalizedBase = normalizeMarkdownForReview(next.base, result.detectedLanguage);
                    setDraft(normalizedBase);
                    setComparisonBase(normalizedBase);
                  }
                  if (next.proposal !== undefined) {
                    setPendingProposalRaw(next.proposal);
                    setPendingProposalExact(next.proposal);
                    const normalizedProposal = normalizeMarkdownForReview(next.proposal, result.detectedLanguage);
                    setPendingProposal(normalizedProposal);
                  }
                }}
              />
            </div>
          ) : previewMode === 'text' ? (
            <div
              className={`prose prose-slate dark:prose-invert max-w-none w-full px-5 pb-5 text-[15px] leading-7 prose-headings:font-semibold prose-h1:text-2xl prose-h1:leading-tight prose-h1:mb-3 prose-h2:text-xl prose-h2:mt-4 prose-h2:mb-2 prose-p:my-2 prose-p:text-justify prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:bg-muted prose-pre:rounded prose-pre:p-3 prose-blockquote:italic prose-blockquote:border-l-4 prose-blockquote:border-border prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-a:text-primary text-foreground overflow-auto flex-1 ${isEthiopic ? 'font-ethiopic leading-8 tracking-normal' : ''}`}
              style={{ fontSize: `${Math.round(15 * fontScale)}px`, lineHeight: 1.7 }}
              lang={result.detectedLanguage || 'am'}
              dir="auto"
            >
              <SafeMarkdown content={preview} />
            </div>
          ) : (
            <OriginalLayoutPanel fileName={currentFile?.name} dataUrl={currentFile?.preview || ''} />
          )}
        </div>
      </div>
      {zen && (
        <div className="fixed inset-0 z-[9998] bg-background/95 backdrop-blur-sm">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <button type="button" className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent" onClick={() => setZen(false)}>Exit</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full p-4">
            <div className="h-full">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className={`w-full h-full p-3 border border-input rounded-xl font-mono bg-muted ${wrapEditor ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'}`} style={{ fontSize: `${Math.round(14 * fontScale)}px`, lineHeight: 1.6 }} />
            </div>
            <div className="h-full">
              <div className={`prose prose-slate dark:prose-invert max-w-none w-full h-full px-3 overflow-auto ${isEthiopic ? 'font-ethiopic' : ''}`} style={{ fontSize: `${Math.round(15 * fontScale)}px`, lineHeight: 1.7 }}>
                <SafeMarkdown content={preview} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-end" />
    </div>
  );
};

const OriginalLayoutPanel: React.FC<{ fileName?: string; dataUrl: string }> = ({ fileName, dataUrl }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [convertedUrl, setConvertedUrl] = React.useState<string | null>(null);
  const displayUrl = convertedUrl || dataUrl;

  React.useEffect(() => {
    let canceled = false;
    const isTiff = (url: string, name?: string) => {
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

    const convertTiffToPng = async () => {
      try {
        if (!isTiff(dataUrl, fileName)) {
          setConvertedUrl(null);
          return;
        }
        const buf = await toArrayBuffer(dataUrl);
        const ifds = UTIF.decode(buf as any);
        if (!ifds || ifds.length === 0) return;
        const first = ifds[0];
        UTIF.decodeImage(buf as any, first);
        const rgba = UTIF.toRGBA8(first);
        const width = (first as any).width || (first as any).t256 || 0;
        const height = (first as any).height || (first as any).t257 || 0;
        if (!width || !height) return;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        ctx.putImageData(imageData, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        if (!canceled) setConvertedUrl(pngUrl);
      } catch (err) {
        console.warn('TIFF conversion failed; falling back to original URL', err);
        if (!canceled) setConvertedUrl(null);
      }
    };

    convertTiffToPng();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, fileName]);

  const exportPdf = async () => {
    if (!displayUrl) return;
    const { jsPDF } = await import('jspdf');
    // Load image to get dimensions
    const img = new Image();
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = displayUrl;
    });
    const orientation = dims.w >= dims.h ? 'l' : 'p';
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    // Fit image into page while preserving aspect
    const imgRatio = dims.w / dims.h;
    const pageRatio = pageW / pageH;
    let renderW = pageW, renderH = pageH;
    if (imgRatio > pageRatio) {
      renderW = pageW;
      renderH = pageW / imgRatio;
    } else {
      renderH = pageH;
      renderW = pageH * imgRatio;
    }
    const offsetX = (pageW - renderW) / 2;
    const offsetY = (pageH - renderH) / 2;
    const imgFormat = displayUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(displayUrl, imgFormat as any, offsetX, offsetY, renderW, renderH, undefined, 'FAST');
    const name = (fileName || 'document').replace(/\.\w+$/, '') + '-original.pdf';
    doc.save(name);
  };

  const printImage = () => {
    if (!displayUrl) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${fileName || 'Original'}</title><style>html,body{margin:0;padding:0}img{width:100%;height:auto;}</style></head><body><img src="${displayUrl}" onload="window.focus();window.print();"/></body></html>`);
    w.document.close();
  };

  if (!displayUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-muted rounded-lg border border-border">
        No original preview available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-muted">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent"
          onClick={exportPdf}
          title="Export original as PDF"
        >Export PDF</button>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent"
          onClick={printImage}
          title="Print original"
        >Print</button>
      </div>
      <div className="p-3 flex items-start justify-center">
        <img ref={imgRef} src={displayUrl} alt={fileName || 'Original'} className="max-w-full h-auto shadow-sm rounded" />
      </div>
    </div>
  );
};
