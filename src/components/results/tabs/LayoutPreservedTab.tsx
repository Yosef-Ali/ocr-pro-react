import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as UTIF from 'utif';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Type, Wand2, Loader2, RotateCcw, CheckCheck, XCircle, MoreVertical, Copy as CopyIcon } from 'lucide-react';
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
  const docStats = useMemo(() => {
    const text = draft || '';
    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const paragraphs = text.split(/\n{2,}/).filter((section) => section.trim().length > 0).length;
    const lines = text ? text.split(/\r?\n/).length : 0;
    const readingMinutes = words === 0 ? 0 : Math.max(1, Math.round(words / 180));
    return { words, characters, paragraphs, lines, readingMinutes };
  }, [draft]);

  const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;
  const isEthiopic = (result.detectedLanguage === 'am') || ETH_RE.test(preview);
  const engine = (result.metadata as any)?.engine || 'unknown';
  const routingMode = (settings as any)?.routingMode || 'auto';
  const edgeEnabled = !!(settings as any)?.edgeLLMEnabled;

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Layout-preserved editor
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100">Focus mode</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Maintain structured Amharic output while reviewing AI suggestions. Formatting and inline fixes update instantly without losing layout.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {currentFile?.name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                <Type className="w-3 h-3" />
                {currentFile.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              <span className="block w-2 h-2 rounded-full bg-emerald-500" />
              Engine: {engine}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Routing: {routingMode}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Lang: {result.detectedLanguage || 'unknown'}</span>
            {edgeEnabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                <Loader2 className={`w-3 h-3 ${edgeProgress > 0 && edgeProgress < 100 ? 'animate-spin text-blue-500' : 'text-emerald-500'}`} />
                Edge LLM {edgeProgress > 0 && edgeProgress < 100 ? `loading ${edgeProgress}%` : 'ready'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-700">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200" title="Total words in the markdown draft">
            <span className="uppercase text-[10px] text-gray-500">Words</span>
            <span className="font-semibold text-gray-900">{docStats.words.toLocaleString()}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200" title="Total characters including punctuation">
            <span className="uppercase text-[10px] text-gray-500">Characters</span>
            <span className="font-semibold text-gray-900">{docStats.characters.toLocaleString()}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200" title="Paragraphs detected from blank-line separation">
            <span className="uppercase text-[10px] text-gray-500">Paragraphs</span>
            <span className="font-semibold text-gray-900">{docStats.paragraphs}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200" title="Line count in the markdown source">
            <span className="uppercase text-[10px] text-gray-500">Lines</span>
            <span className="font-semibold text-gray-900">{docStats.lines}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200" title="Estimated reading time at 180 words per minute">
            <span className="uppercase text-[10px] text-gray-500">Read</span>
            <span className="font-semibold text-gray-900">{docStats.readingMinutes ? `${docStats.readingMinutes}m` : '—'}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[70vh] min-h-[24rem]">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 overflow-hidden flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Markdown editor</label>
            {autoSaved && <span className="text-xs text-emerald-600">Auto-saved</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center mb-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <ToolbarButton title={getAiTitle()} onClick={runUnifiedAIFix} disabled={isAnalyzing || isProofreading || isCorrectingWithVision}>
              {(isAnalyzing || isProofreading || isCorrectingWithVision) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
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
            >
              <RotateCcw className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Format (auto)" onClick={() => setDraft((value) => smartFormatToMarkdown(value))}><Type className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 1" onClick={() => applyPrefix('# ')}><Heading1 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => applyPrefix('## ')}><Heading2 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bold" onClick={() => applyWrap('**', '**')}><Bold className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => applyWrap('*', '*')}><Italic className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bulleted list" onClick={() => applyLinePrefix('- ')}><List className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => applyLinePrefix('1. ')}><ListOrdered className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Quote" onClick={() => applyLinePrefix('> ')}><Quote className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Inline code" onClick={() => applyWrap('`', '`')}><Code className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Link" onClick={insertLink}><LinkIcon className="w-4 h-4" /></ToolbarButton>
            <button type="button" className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-gray-50" title="Zen mode (fullscreen)" onClick={() => setZen(true)}>Zen</button>
            <div className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-gray-50"
                title="Smaller text"
                onClick={() => setFontScale(s => Math.max(0.8, +(s - 0.1).toFixed(2)))}
              >A−</button>
              <button
                type="button"
                className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-gray-50"
                title="Larger text"
                onClick={() => setFontScale(s => Math.min(1.5, +(s + 0.1).toFixed(2)))}
              >A+</button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] rounded border ${wrapEditor ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}
                title="Toggle line wrap"
                onClick={() => setWrapEditor(v => !v)}
              >Wrap</button>
              <button
                type="button"
                className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-gray-50"
                title="Reset font & wrap"
                onClick={() => { setFontScale(1); setWrapEditor(false); }}
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
                className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border bg-white text-gray-700 hover:bg-gray-50"
              >
                {tipsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Tips
              </button>
            )}
          </div>
          {quickTips && quickTips.length > 0 && (
            <div className="mb-3 text-xs text-gray-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <div className="font-medium text-emerald-800 mb-1">Quick Tips</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {quickTips.map((t, i) => (<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center text-[11px] text-gray-500 mb-2">
            {pendingProposal && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Right-click highlighted words in the preview to resolve.
              </div>
            )}
          </div>

          <div className={`relative flex-1 min-h-0 ${appliedPulse ? 'ring-2 ring-green-400 rounded-xl' : ''}`}>
            {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-200 rounded-t z-20 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ease-linear ${isCorrectingWithVision ? 'bg-blue-500' : 'bg-purple-500'}`}
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
              className={`w-full h-full min-h-[18rem] p-3 md:p-2.5 border border-gray-200 rounded-xl font-mono bg-gray-50 resize-none overflow-auto ${wrapEditor ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'} focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition ${(isProofreading || isAnalyzing || isCorrectingWithVision) ? 'opacity-60' : ''}`}
              style={{ fontSize: `${Math.round(14 * fontScale)}px`, lineHeight: 1.6 }}
              disabled={isProofreading || isAnalyzing || isCorrectingWithVision}
            />

            {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{apiStatus.hasGemini ? 'Gemini' : 'OpenRouter'} AI preparing suggestions…</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded-full border bg-white hover:bg-gray-50 text-gray-700"
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

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 overflow-hidden flex flex-col h-full min-h-0">
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2 mb-3 bg-white/90 supports-[backdrop-filter]:bg-white/60 backdrop-blur border-b rounded-t-2xl flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Preview</label>
            <div className="flex items-center gap-2">
              <div className="relative inline-flex bg-gray-100 rounded-lg p-0.5 text-xs" role="tablist" aria-label="Preview mode" ref={actionsContainerRef}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'text'}
                  className={`px-2 py-0.5 rounded-md outline-none focus:ring-2 focus:ring-blue-400 ${previewMode === 'text' ? 'bg-white shadow border' : 'text-gray-600 hover:text-gray-800'}`}
                  onClick={() => setPreviewMode('text')}
                >Text</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'original'}
                  className={`px-2 py-0.5 rounded-md outline-none focus:ring-2 focus:ring-blue-400 ${previewMode === 'original' ? 'bg-white shadow border' : 'text-gray-600 hover:text-gray-800'}`}
                  onClick={() => setPreviewMode('original')}
                  disabled={!currentFile?.preview}
                  title={currentFile?.preview ? 'View original layout' : 'No original preview available'}
                >Original</button>
                {pendingProposal && (
                  <button
                    type="button"
                    title="AI Actions"
                    aria-haspopup="menu"
                    aria-expanded={actionsOpen}
                    className={`ml-0.5 px-1.5 py-0.5 rounded-md outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 hover:text-gray-900 ${applyPulse ? 'ring-2 ring-green-300 shadow' : ''}`}
                    onClick={() => setActionsOpen(v => !v)}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
                {actionsOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[220px] rounded-lg border bg-white shadow-lg">
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        let proposed = pendingProposalExact ?? pendingProposalRaw ?? pendingProposal ?? draft;
                        try {
                          if (/^\s*`{3}/.test(proposed) || /\"correctedText\"\s*:/.test(proposed)) {
                            const json = extractJsonFromText(proposed);
                            const obj = JSON.parse(json);
                            if (obj && typeof obj.correctedText === 'string') proposed = obj.correctedText;
                          }
                        } catch { }
                        const base = comparisonBase || draft;
                        if (proposed.length === 0 && base.length > 0) {
                          if (!window.confirm('The suggestion would clear the content. Apply anyway?')) return;
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
                      <span>Apply All</span>
                    </button>
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
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
                      <XCircle className="w-4 h-4 text-gray-600" />
                      <span>Discard All</span>
                    </button>
                    <div className="my-1 border-t" />
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
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
                      <CopyIcon className="w-4 h-4 text-gray-700" />
                      <span>Copy cleaned text</span>
                    </button>
                  </div>
                )}
              </div>
              {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${isCorrectingWithVision ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-purple-700 bg-purple-50 border-purple-200'}`}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {isCorrectingWithVision ? 'AI Vision' : isAnalyzing ? 'Analyzing' : 'Preparing'}
                </span>
              )}
              {pendingProposal && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold whitespace-nowrap">
                  {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          {(isProofreading || isAnalyzing || isCorrectingWithVision) && previewMode === 'text' && (
            <div className="mb-2 -mx-4 px-4">
              <div className="h-3 w-48 bg-gray-200/80 rounded-full animate-pulse" />
            </div>
          )}

          {pendingProposal && previewMode === 'text' ? (
            <div className={`prose prose-slate max-w-none w-full px-2 md:px-3 text-[15px] leading-7 overflow-auto flex-1 ${isEthiopic ? 'font-ethiopic' : ''}`} style={{ fontSize: `${Math.round(15 * fontScale)}px`, lineHeight: 1.7 }}>
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
              className={`prose prose-slate max-w-none w-full px-2 md:px-3 text-[15px] leading-7 prose-headings:font-semibold prose-h1:text-2xl prose-h1:leading-tight prose-h1:mb-3 prose-h2:text-xl prose-h2:mt-4 prose-h2:mb-2 prose-p:my-2 prose-p:text-justify prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:bg-gray-100 prose-pre:rounded prose-pre:p-3 prose-blockquote:italic prose-blockquote:border-l-4 prose-blockquote:border-gray-300 text-gray-900 overflow-auto flex-1 ${isEthiopic ? 'font-ethiopic leading-8 tracking-normal' : ''}`}
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
        <div className="fixed inset-0 z-[9998] bg-white/95 backdrop-blur-sm">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <button type="button" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={() => setZen(false)}>Exit</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full p-4">
            <div className="h-full">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className={`w-full h-full p-3 border rounded-xl font-mono bg-gray-50 ${wrapEditor ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'}`} style={{ fontSize: `${Math.round(14 * fontScale)}px`, lineHeight: 1.6 }} />
            </div>
            <div className="h-full">
              <div className={`prose prose-slate max-w-none w-full h-full px-3 overflow-auto ${isEthiopic ? 'font-ethiopic' : ''}`} style={{ fontSize: `${Math.round(15 * fontScale)}px`, lineHeight: 1.7 }}>
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
      <div className="flex-1 flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-lg border">
        No original preview available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto rounded-lg border bg-gray-50">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
          onClick={exportPdf}
          title="Export original as PDF"
        >Export PDF</button>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
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
