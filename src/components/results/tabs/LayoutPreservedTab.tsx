import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OCRResult } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useOCRStore } from '@/store/ocrStore';
import { checkAvailableApiKeys } from '@/utils/validationUtils';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Type, Wand2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
// keep local OCR error detector below; unused helper imports removed

interface Props {
  result: OCRResult;
}

export const LayoutPreservedTab: React.FC<Props> = ({ result }) => {
  const { updateResult, settings, files, toggleSettings, ensureOriginalSnapshots } = useOCRStore() as any;
  const typedFiles: any[] = files;
  const apiStatus = checkAvailableApiKeys(settings);

  // Consolidated debug logging (runs when keys or status change)
  useEffect(() => {
    const { apiKey, openRouterApiKey } = settings;
    const info = {
      geminiExists: !!apiKey,
      geminiLen: apiKey?.length || 0,
      openRouterExists: !!openRouterApiKey,
      openRouterLen: openRouterApiKey?.length || 0,
      provider: apiStatus.primaryProvider,
      hasAny: apiStatus.hasAnyApiKey,
    };
    console.log('🔧 Layout tab debug (once per change):', info);
  }, [settings.apiKey, settings.openRouterApiKey, apiStatus.hasAnyApiKey, apiStatus.primaryProvider]);
  const initial = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
  const [draft, setDraft] = useState(initial);
  const [autoSaved, setAutoSaved] = useState(false);
  // Pending AI proposal for review
  const [pendingProposal, setPendingProposal] = useState<string | null>(null);
  const [comparisonBase, setComparisonBase] = useState<string | null>(null);
  // Note: original snapshot is handled on Accept; no need to read here
  const [isProofreading, setIsProofreading] = useState(false);
  const [appliedPulse, setAppliedPulse] = useState(false);
  const [pfProgress, setPfProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCorrectingWithVision, setIsCorrectingWithVision] = useState(false);
  const [ignoredWords, setIgnoredWords] = useState<string[]>(() => (result as any).metadata?.ignoredWords || []);
  const [suggestionCount, setSuggestionCount] = useState<number>(0);
  // removed unused local spellcheck state (we render inline highlights in SafeMarkdown)
  const debounceRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelRef = useRef<boolean>(false);
  const preview = useMemo(() => draft, [draft]);
  const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;
  const isEthiopic = (result.detectedLanguage === 'am') || ETH_RE.test(preview);
  useEffect(() => {
    // When switching to a different file/result, reset editor
    const next = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
    setDraft(next);
    ensureOriginalSnapshots?.();
    setIgnoredWords((result as any).metadata?.ignoredWords || []);
  }, [result.fileId]);

  // Auto-format once if no saved markdown exists and content has no headings
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


  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Debounce autosave by 1s after edits
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
  }, [draft, result.fileId, updateResult]);

  // Indeterminate progress animation while proofreading
  useEffect(() => {
    if (!isProofreading) { setPfProgress(0); return; }
    let p = 0;
    const id = window.setInterval(() => {
      p = (p + 5) % 100;
      // keep it between 10 and 95 for a smoother feel
      const next = p < 10 ? 10 : (p > 95 ? 10 : p);
      setPfProgress(next);
    }, 120);
    return () => window.clearInterval(id);
  }, [isProofreading]);

  // Editing helpers bound to this component
  const withEditor = (fn: (el: HTMLTextAreaElement) => void) => {
    const el = editorRef.current;
    if (!el) return;
    fn(el);
    // keep focus for smoother editing
    el.focus();
  };

  const applyWrap = (left: string, right: string) => withEditor((el) => {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = draft.slice(start, end) || 'text';
    const next = replaceRange(draft, start, end, `${left}${selected}${right}`);
    setDraft(next);
    const pos = start + left.length + selected.length + right.length;
    requestAnimationFrame(() => el.setSelectionRange(pos, pos));
  });

  const applyPrefix = (prefix: string) => withEditor((el) => {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = draft.slice(0, start);
    const selected = draft.slice(start, end) || 'Heading';
    const after = draft.slice(end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const newBefore = draft.slice(0, lineStart);
    const newLine = prefix + draft.slice(lineStart, end);
    const next = newBefore + newLine + after;
    setDraft(next);
    const pos = lineStart + prefix.length + selected.length;
    requestAnimationFrame(() => el.setSelectionRange(pos, pos));
  });

  const applyLinePrefix = (prefix: string) => withEditor((el) => {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = draft;
    const sel = text.slice(start, end);
    const lines = sel.split(/\n/);
    const updated = lines.map((l) => (l.trim() ? `${prefix}${l}` : l)).join('\n');
    const next = replaceRange(text, start, end, updated);
    setDraft(next);
    const pos = start + updated.length;
    requestAnimationFrame(() => el.setSelectionRange(pos, pos));
  });

  const insertLink = () => withEditor((el) => {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = draft.slice(start, end) || 'link-text';
    const url = 'https://';
    const snippet = `[${selected}](${url})`;
    const next = replaceRange(draft, start, end, snippet);
    setDraft(next);
    const caret = start + snippet.indexOf('(') + 1;
    const caretEnd = caret + url.length;
    requestAnimationFrame(() => el.setSelectionRange(caret, caretEnd));
  });

  // Removed dedicated proofreading UI; unified into runUnifiedAIFix

  // Removed intelligent analysis action from UI (still available to add later)
  const getAiTitle = () => {
    if (!apiStatus.hasAnyApiKey) return 'Configure Gemini/OpenRouter in Settings (click to open)';
    const provider = apiStatus.hasGemini ? 'Gemini' : 'OpenRouter';
    return `AI review with ${provider} — propose changes for approval`;
  };

  // Smart analysis actions removed

  // Smart analysis removed from UI

  // Unified AI Fix: Prefer Vision; fallback to Proofreading + cleanup
  const runUnifiedAIFix = async () => {
    const originalFile = typedFiles.find((f: any) => f.id === result.fileId);
    const canVision = apiStatus.hasAnyApiKey && !!originalFile?.preview;

    // NOTE: Any AI correction applied here is intentionally propagated to
    // extractedText + layoutPreserved + metadata.layoutMarkdown so that:
    // 1) The Extracted tab reflects improvements
    // 2) Exports / comparisons use the corrected layout
    // 3) We keep a single source of truth moving forward
    // This avoids divergence where user sees improved markdown but exports stale text.

    if (!apiStatus.hasAnyApiKey) {
      // No keys: guide user to Settings instead of silent local no-op
      toast.error('Add a Gemini or OpenRouter API key in Settings to use AI');
      toggleSettings();
      return;
    }

    // Show a provider-specific progress UI
    setIsCorrectingWithVision(true);
    const provider = apiStatus.hasGemini ? 'Gemini' : 'OpenRouter';
    toast.loading(`${provider} AI preparing suggestions…`, { id: 'ai-fix' });
    setComparisonBase(draft);

    try {
      // 1) Try Vision if possible
      if (canVision) {
        try {
          const { correctTextWithAIVision } = await import('@/services/geminiService');
          // Capture original snapshot once
          const { correctedText, source } = await correctTextWithAIVision(
            draft,
            originalFile!.preview!,
            settings
          );
          // Stage proposal for review, do not apply yet
          const stagedVision = sanitizeProposal(correctedText, result.detectedLanguage);
          setPendingProposal(stagedVision);
          setAppliedPulse(true);
          setTimeout(() => setAppliedPulse(false), 1500);
          const usedProvider = source === 'openrouter-gemini-2.5-pro' ? 'OpenRouter' : 'Gemini';
          toast.success(`${usedProvider} suggested changes — review and accept/reject.`, { id: 'ai-fix' });
          return;
        } catch (visionErr) {
          console.warn('Vision path failed; falling back to proofreading:', visionErr);
        }
      }

      // 2) Fallback: Proofread whole draft
      const { proofreadAmharicWithMeta } = await import('@/services/geminiService');
      const { suggestions, source } = await proofreadAmharicWithMeta(draft, settings, { maxSuggestions: 30 });
      let transformed = draft;
      let applied = 0;
      if (Array.isArray(suggestions) && suggestions.length) {
        for (const s of suggestions) {
          const orig = String(s.original || '').trim();
          const sug = String(s.suggestion || '').trim();
          if (!orig || !sug || orig === sug) continue;
          const escaped = escapeRegex(orig);
          const flex = escaped.replace(/\s+/g, '\\s+');
          const re = new RegExp(flex, 'g');
          const before = transformed;
          transformed = transformed.replace(re, sug);
          if (transformed !== before) { applied++; continue; }
          const before2 = transformed;
          transformed = transformed.split(orig).join(sug);
          if (transformed !== before2) applied++;
        }
      }

      // Deterministic cleanup
      const cleaned = cleanupAsciiNoiseAndItalics(transformed);
      if (cleaned !== transformed) { transformed = cleaned; applied++; }

      if (applied > 0 && transformed !== draft) {
        // Stage proposal for review
        const staged = sanitizeProposal(transformed, result.detectedLanguage);
        setPendingProposal(staged);
        setAppliedPulse(true);
        setTimeout(() => setAppliedPulse(false), 900);
        const usedProvider = (source as string) === 'openrouter-gemini-2.5-pro' ? 'OpenRouter' : source === 'local' ? 'Local' : 'Gemini';
        toast.success(`${usedProvider} suggested ${applied} fixes — review and accept/reject.`, { id: 'ai-fix' });
      } else {
        const usedProvider = (source as string) === 'openrouter-gemini-2.5-pro' ? 'OpenRouter' : source === 'local' ? 'Local' : 'Gemini';
        toast(`${usedProvider} found no changes needed.`, { id: 'ai-fix' });
      }
    } catch (e) {
      console.error('Unified AI Fix failed:', e);
      const providerName = apiStatus.hasGemini ? 'Gemini' : 'OpenRouter';
      toast.error(`${providerName} AI improvement failed`, { id: 'ai-fix' });
    } finally {
      setIsCorrectingWithVision(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-gray-500">Markdown Editor</label>
            {autoSaved && <span className="text-xs text-gray-500">Auto-saved</span>}
          </div>
          {/* Simplified Toolbar: AI Fix + basic formatting only */}
          <div className="flex flex-wrap gap-1 items-center mb-2">
            <ToolbarButton
              title={getAiTitle()}
              onClick={runUnifiedAIFix}
              disabled={isAnalyzing || isProofreading || isCorrectingWithVision}
            >
              {(isAnalyzing || isProofreading || isCorrectingWithVision) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </ToolbarButton>
            {/* Removed provider badge, diff toggles, and undo from toolbar for cleaner UX */}
            <ToolbarButton title="Format (auto)" onClick={() => setDraft((d) => smartFormatToMarkdown(d))}><Type className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 1" onClick={() => applyPrefix('# ')}><Heading1 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => applyPrefix('## ')}><Heading2 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bold" onClick={() => applyWrap('**', '**')}><Bold className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => applyWrap('*', '*')}><Italic className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Bulleted list" onClick={() => applyLinePrefix('- ')}><List className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => applyLinePrefix('1. ')}><ListOrdered className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Quote" onClick={() => applyLinePrefix('> ')}><Quote className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Inline code" onClick={() => applyWrap('`', '`')}><Code className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton title="Link" onClick={() => insertLink()}><LinkIcon className="w-4 h-4" /></ToolbarButton>
          </div>
          {/* Provider badge removed for minimalism */}
          <div className={`relative ${appliedPulse ? 'ring-2 ring-green-400 rounded' : ''}`}>
            {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-200 rounded-t z-20 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ease-linear ${isCorrectingWithVision ? 'bg-blue-500' : 'bg-purple-500'
                    }`}
                  style={{ width: `${pfProgress}%` }}
                />
              </div>
            )}

            {/* Editor */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              ref={editorRef}
              onKeyDown={(e) => {
                const isMeta = e.metaKey || e.ctrlKey;
                if (isMeta && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); applyWrap('**', '**'); }
                if (isMeta && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); applyWrap('*', '*'); }
              }}
              className={`w-full h-72 md:h-96 p-2 border rounded text-sm font-mono resize-y ${(isProofreading || isAnalyzing || isCorrectingWithVision) ? 'opacity-60' : ''}`}
              disabled={isProofreading || isAnalyzing || isCorrectingWithVision}
            />

            {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded bg-white/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{apiStatus.hasGemini ? 'Gemini' : 'OpenRouter'} AI preparing suggestions…</span>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 text-gray-700"
                  onClick={() => {
                    cancelRef.current = true;
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
        <div className="bg-gray-50 border rounded-lg p-3 overflow-auto h-72 md:h-96">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-gray-500">Preview</label>
            {(isProofreading || isAnalyzing || isCorrectingWithVision) && (
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${isCorrectingWithVision
                ? 'text-blue-700 bg-blue-50 border border-blue-200'
                : 'text-purple-700 bg-purple-50 border border-purple-200'
                }`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                {isCorrectingWithVision ? 'AI Vision' : isAnalyzing ? 'Analyzing' : 'Preparing'}
              </span>
            )}
            {pendingProposal && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded border bg-white text-gray-700" title="Remaining suggestions">
                  {suggestionCount} suggestions
                </span>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                  onClick={() => {
                    const proposed = pendingProposal;
                    const base = comparisonBase || draft;
                    if (proposed.trim().length === 0 && base.trim().length > 0) {
                      if (!window.confirm('The suggestion would clear the content. Apply anyway?')) return;
                    }
                    setDraft(proposed);
                    setPendingProposal(null);
                    setComparisonBase(null);
                    const snapshot = (result as any).metadata?.originalBeforeAI || base;
                    updateResult(result.fileId, {
                      extractedText: proposed,
                      layoutPreserved: proposed,
                      metadata: { ...(result as any).metadata, layoutMarkdown: proposed, originalBeforeAI: snapshot }
                    });
                    toast.success('Applied AI changes');
                  }}
                >
                  Apply All
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => { setPendingProposal(null); setComparisonBase(null); toast('Discarded AI proposal'); }}
                >
                  Discard All
                </button>
              </div>
            )}
          </div>
          {pendingProposal ? (
            <div className={`prose prose-slate mx-auto max-w-[42rem] text-[15px] leading-7 ${isEthiopic ? 'font-ethiopic' : ''}`}>
              <DiffView
                original={comparisonBase || draft}
                current={pendingProposal}
                isEthiopic={isEthiopic}
                mode={'word'}
                ignoredWords={ignoredWords}
                onIgnoreWord={(w: string) => {
                  const norm = w;
                  setIgnoredWords((prev) => {
                    if (prev.includes(norm)) return prev;
                    const next = [...prev, norm];
                    updateResult(result.fileId, { metadata: { ...(result as any).metadata, ignoredWords: next } });
                    return next;
                  });
                }}
                onSuggestionCountChange={(n: number) => setSuggestionCount(n)}
                onUpdate={(next) => {
                  if (next.base !== undefined) {
                    setDraft(next.base);
                    setComparisonBase(next.base);
                  }
                  if (next.proposal !== undefined) {
                    setPendingProposal(next.proposal);
                  }
                }}
              />
            </div>
          ) : (
            <div
              className={`prose prose-slate mx-auto max-w-[42rem] text-[15px] leading-7 prose-headings:font-semibold prose-h1:text-2xl prose-h1:leading-tight prose-h1:mb-3 prose-h2:text-xl prose-h2:mt-4 prose-h2:mb-2 prose-p:my-2 prose-p:text-justify prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:bg-gray-100 prose-pre:rounded prose-pre:p-3 prose-blockquote:italic prose-blockquote:border-l-4 prose-blockquote:border-gray-300 ${isEthiopic ? 'font-ethiopic' : ''}`}
              lang={result.detectedLanguage || 'am'}
              dir="auto"
            >
              <SafeMarkdown content={preview} />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end" />
    </div>
  );
};

const SafeMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; error: any } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if content is Amharic
  const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;
  const isEthiopic = ETH_RE.test(content);

  // Get OCR errors for Amharic content
  const ocrErrors = useMemo(() => {
    if (!isEthiopic) return [];
    return detectOCRErrors(content);
  }, [content, isEthiopic]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  if (error) {
    return (
      <div className="text-xs text-gray-600">
        <div className="mb-1">Preview failed — showing raw text:</div>
        <pre className="whitespace-pre-wrap break-words text-sm bg-white p-2 border rounded">{content}</pre>
      </div>
    );
  }

  try {
    return (
      <div ref={containerRef} className="relative">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => {
              const textContent = React.Children.toArray(children).join('');

              if (isEthiopic && ocrErrors.length > 0) {
                // Highlight OCR errors in the text
                let highlightedText = textContent;

                ocrErrors.forEach(error => {
                  const errorRegex = new RegExp(error.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                  highlightedText = highlightedText.replace(errorRegex,
                    `<span class="underline decoration-wavy decoration-red-500 decoration-2 underline-offset-4 cursor-context-menu bg-red-50" data-error="${encodeURIComponent(JSON.stringify(error))}">${error.text}</span>`
                  );
                });

                if (highlightedText !== textContent) {
                  return (
                    <p
                      dangerouslySetInnerHTML={{ __html: highlightedText }}
                      onContextMenu={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.dataset.error) {
                          e.preventDefault();
                          try {
                            const errorData = JSON.parse(decodeURIComponent(target.dataset.error));
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              error: errorData
                            });
                          } catch (err) {
                            console.error('Failed to parse error data:', err);
                          }
                        }
                      }}
                    />
                  );
                }
              }

              return <p>{children}</p>;
            }
          }}
        >
          {content}
        </ReactMarkdown>

        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-48"
            style={{
              left: contextMenu.x,
              top: contextMenu.y
            }}
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="font-medium text-gray-900 text-sm">"{contextMenu.error.text}"</div>
              <div className="text-xs text-gray-600 mt-1">{contextMenu.error.reason}</div>
              <div className="text-xs text-gray-500">Confidence: {contextMenu.error.confidence}%</div>
            </div>

            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-700 flex items-center gap-2"
              onClick={() => {
                // For demo purposes, just show alert - you can implement the fix logic
                alert(`Would fix: "${contextMenu.error.text}" → "${contextMenu.error.suggestion}"`);
                setContextMenu(null);
              }}
            >
              <span className="text-green-600">✓</span>
              {contextMenu.error.action === 'remove' ? 'Remove' : `Replace with "${contextMenu.error.suggestion}"`}
            </button>

            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2"
              onClick={() => setContextMenu(null)}
            >
              <span className="text-gray-400">✕</span>
              Ignore
            </button>
          </div>
        )}
      </div>
    );
  } catch (e: any) {
    setError(e?.message || 'Failed to render markdown');
    return null;
  }
};

// DiffView supports line or word mode with interactive per-word actions (right-click)
const DiffView: React.FC<{
  original: string;
  current: string;
  isEthiopic: boolean;
  mode: 'line' | 'word';
  ignoredWords?: string[];
  onIgnoreWord?: (word: string) => void;
  onSuggestionCountChange?: (n: number) => void;
  onUpdate?: (next: { base?: string; proposal?: string }) => void;
}> = ({ original, current, isEthiopic, mode, ignoredWords = [], onIgnoreWord, onSuggestionCountChange, onUpdate }) => {
  if (mode === 'line') {
    const oLines = original.split(/\r?\n/);
    const cLines = current.split(/\r?\n/);
    const max = Math.max(oLines.length, cLines.length);
    const rows = [] as Array<{ o: string; c: string; changed: boolean }>;
    for (let i = 0; i < max; i++) rows.push({ o: oLines[i] ?? '', c: cLines[i] ?? '', changed: (oLines[i] ?? '') !== (cLines[i] ?? '') });
    return (
      <div className={`grid grid-cols-2 gap-3 text-[13px] leading-relaxed ${isEthiopic ? 'font-ethiopic' : ''}`}>
        <div className="text-xs font-medium text-gray-500 pb-1 border-b">Original</div>
        <div className="text-xs font-medium text-gray-500 pb-1 border-b">Current</div>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <pre className={`whitespace-pre-wrap break-words p-1 rounded border bg-white min-h-[1.25rem] ${r.changed ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>{r.o}</pre>
            <pre className={`whitespace-pre-wrap break-words p-1 rounded border bg-white min-h-[1.25rem] ${r.changed ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>{r.c}</pre>
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Word diff mode
  // Normalize both sides to reduce false positives from invisible chars or canonical forms
  const normalizeForDiff = (txt: string) =>
    txt
      .replace(/\r\n?/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFC');

  // Tokenize into: words (letters+marks+digits, allowing a single slash-unit like n/xxx), numbers, whitespace, or ANY punctuation (Unicode)
  const reToken = /(\p{L}[\p{L}\p{M}\p{N}_]*(?:\/[\p{L}\p{M}\p{N}_]+)?|\p{N}+|\s+|\p{P}+)/gu;
  const tokenize = (txt: string) => {
    const parts = txt.match(reToken);
    return parts ?? [txt];
  };

  const normOriginal = normalizeForDiff(original);
  const normCurrent = normalizeForDiff(current);
  const oToks = tokenize(normOriginal);
  const cToks = tokenize(normCurrent);
  // Simple LCS-based alignment
  const lcs: number[][] = Array(oToks.length + 1).fill(null).map(() => Array(cToks.length + 1).fill(0));
  for (let i = oToks.length - 1; i >= 0; i--) {
    for (let j = cToks.length - 1; j >= 0; j--) {
      if (oToks[i] === cToks[j]) lcs[i][j] = 1 + lcs[i + 1][j + 1]; else lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Array<{ type: 'eq' | 'del' | 'ins'; o?: string; c?: string; i?: number; j?: number }> = [];
  let i = 0, j = 0;
  while (i < oToks.length && j < cToks.length) {
    if (oToks[i] === cToks[j]) { ops.push({ type: 'eq', o: oToks[i], c: cToks[j], i, j }); i++; j++; continue; }
    if (lcs[i + 1][j] >= lcs[i][j + 1]) { ops.push({ type: 'del', o: oToks[i], i }); i++; }
    else { ops.push({ type: 'ins', c: cToks[j], j }); j++; }
  }
  while (i < oToks.length) { ops.push({ type: 'del', o: oToks[i], i }); i++; }
  while (j < cToks.length) { ops.push({ type: 'ins', c: cToks[j], j }); j++; }

  // Char-level highlight for substitutions where a del followed by ins with no eq between
  const merged: Array<JSX.Element> = [];
  const [menu, setMenu] = React.useState<{ x: number; y: number; change: TokenChange } | null>(null);
  const shouldIgnore = (t?: string) => !!t && ignoredWords.includes(t);
  // Use the SAME tokenizer for applying changes so indices line up with diff ops
  const baseTokens = React.useMemo(() => tokenize(normOriginal), [normOriginal]);
  const propTokens = React.useMemo(() => tokenize(normCurrent), [normCurrent]);

  const applyChange = (kind: 'accept' | 'reject', change: TokenChange) => {
    if (!onUpdate) return;
    // Build next strings from tokens
    if (change.kind === 'sub') {
      if (kind === 'accept') {
        // accept substitution -> base adopts proposed token
        const nextBase = [...baseTokens];
        nextBase[change.i] = propTokens[change.j];
        onUpdate({ base: nextBase.join('') });
      } else {
        // reject substitution -> proposal reverts to base token
        const nextProp = [...propTokens];
        nextProp[change.j] = baseTokens[change.i];
        onUpdate({ proposal: nextProp.join('') });
      }
      return;
    }
    if (change.kind === 'ins') {
      if (kind === 'accept') {
        // accept insertion -> insert proposed token into base at nearby alignment point
        const nextBase = [...baseTokens];
        const insertAt = Math.min(change.j, nextBase.length);
        nextBase.splice(insertAt, 0, propTokens[change.j]);
        onUpdate({ base: nextBase.join('') });
      } else {
        // reject insertion -> remove from proposal
        const nextProp = [...propTokens];
        nextProp.splice(change.j, 1);
        onUpdate({ proposal: nextProp.join('') });
      }
      return;
    }
    if (change.kind === 'del') {
      if (kind === 'accept') {
        // accept deletion -> remove from base
        const nextBase = [...baseTokens];
        nextBase.splice(change.i, 1);
        onUpdate({ base: nextBase.join('') });
      } else {
        // reject deletion -> add back into proposal
        const nextProp = [...propTokens];
        const insertAt = Math.min(change.i, nextProp.length);
        nextProp.splice(insertAt, 0, baseTokens[change.i]);
        onUpdate({ proposal: nextProp.join('') });
      }
      return;
    }
  };
  const isWord = (t?: string) => !!t && /[\p{L}\p{N}]/u.test(t);
  let suggestionCountLocal = 0;
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.type === 'del' && ops[k + 1]?.type === 'ins') {
      const delTok = op.o || '';
      const insTok = ops[k + 1].c || '';
      // If both are mostly non-whitespace treat as substitution
      if ((isWord(delTok) || isWord(insTok)) && !(shouldIgnore(delTok) || shouldIgnore(insTok))) {
        suggestionCountLocal++;
        merged.push(
          <span key={k} className="inline-block mr-1 align-baseline">
            <span
              className={`relative underline decoration-wavy underline-offset-2 decoration-amber-600 text-current cursor-context-menu`}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, change: { kind: 'sub', i: op.i!, j: ops[k + 1].j!, o: delTok, c: insTok } });
              }}
            >
              {charDiff(delTok)}
            </span>
            <span
              className={`relative underline decoration-wavy underline-offset-2 decoration-green-600 text-current ml-1 cursor-context-menu`}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, change: { kind: 'sub', i: op.i!, j: ops[k + 1].j!, o: delTok, c: insTok } });
              }}
            >
              {charDiff(insTok, true)}
            </span>
          </span>
        );
        k++; // skip next
        continue;
      }
    }
    if (op.type === 'eq') {
      merged.push(<span key={k}>{op.o}</span>);
    } else if (op.type === 'del') {
      if (!isWord(op.o) || shouldIgnore(op.o)) { merged.push(<span key={k}>{op.o}</span>); }
      else {
        suggestionCountLocal++; merged.push(
          <span
            key={k}
            className="relative underline decoration-wavy underline-offset-2 decoration-amber-600 text-current cursor-context-menu"
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, change: { kind: 'del', i: op.i!, o: op.o! } }); }}
          >
            {op.o}
          </span>
        );
      }
    } else {
      if (!isWord(op.c) || shouldIgnore(op.c)) { merged.push(<span key={k}>{op.c}</span>); }
      else {
        suggestionCountLocal++; merged.push(
          <span
            key={k}
            className="relative underline decoration-wavy underline-offset-2 decoration-green-600 text-current cursor-context-menu"
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, change: { kind: 'ins', j: op.j!, c: op.c! } }); }}
          >
            {op.c}
          </span>
        );
      }
    }
  }

  React.useEffect(() => {
    onSuggestionCountChange?.(suggestionCountLocal);
  }, [suggestionCountLocal, onSuggestionCountChange]);

  return (
    <div className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words relative ${isEthiopic ? 'font-ethiopic' : ''}`}>
      {merged}
      {menu && (
        <RightClickMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onAccept={() => { applyChange('accept', menu.change); setMenu(null); }}
          onReject={() => { applyChange('reject', menu.change); setMenu(null); }}
          onIgnore={() => {
            const token = menu.change.kind === 'ins'
              ? menu.change.c
              : menu.change.kind === 'del'
                ? menu.change.o
                : (menu.change as Extract<TokenChange, { kind: 'sub' }>).o;
            if (token) onIgnoreWord?.(token);
            setMenu(null);
          }}
          onFixAllSimilar={menu.change.kind === 'sub' ? () => {
            if (!onUpdate) { setMenu(null); return; }
            const nextBase = [...baseTokens];
            const { o: from, c: to } = (menu.change as Extract<TokenChange, { kind: 'sub' }>);
            for (let idx = 0; idx < nextBase.length; idx++) {
              if (nextBase[idx] === from) nextBase[idx] = to;
            }
            onUpdate({ base: nextBase.join('') });
            setMenu(null);
          } : undefined}
        />)
      }
    </div>
  );
};

type TokenChange =
  | { kind: 'ins'; j: number; c: string }
  | { kind: 'del'; i: number; o: string }
  | { kind: 'sub'; i: number; j: number; o: string; c: string };


const RightClickMenu: React.FC<{ x: number; y: number; onAccept: () => void; onReject: () => void; onClose: () => void; onIgnore?: () => void; onFixAllSimilar?: () => void }> = ({ x, y, onAccept, onReject, onClose, onIgnore, onFixAllSimilar }) => {
  // Use a portal-like fixed menu
  return (
    <div
      className="fixed z-50 bg-white border rounded shadow-lg text-sm"
      style={{ left: x + 4, top: y + 4 }}
      onMouseLeave={onClose}
    >
      <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onAccept}>Use suggestion</button>
      <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onReject}>Keep original</button>
      {onIgnore && <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onIgnore}>Ignore this word</button>}
      {onFixAllSimilar && <>
        <div className="my-1 border-t" />
        <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onFixAllSimilar}>Fix all similar</button>
      </>}
    </div>
  );
};

function charDiff(token: string, insert = false): JSX.Element {
  const spans: JSX.Element[] = [];
  // naive approach: highlight entire token; refine by comparing to baseline would require context; kept simple
  for (let i = 0; i < token.length; i++) {
    spans.push(<span key={i} className={insert ? 'font-semibold' : ''}>{token[i]}</span>);
  }
  return <>{spans}</>;
}

// Toolbar UI and editing helpers
const ToolbarButton: React.FC<{ title: string; onClick: () => void | Promise<void>; children: React.ReactNode; disabled?: boolean }> = ({ title, onClick, children, disabled }) => (
  <button
    type="button"
    title={title}
    onClick={() => { if (!disabled) onClick(); }}
    disabled={disabled}
    className={`inline-flex items-center justify-center w-8 h-8 rounded border bg-white text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
  >
    {children}
  </button>
);

function replaceRange(text: string, start: number, end: number, insert: string) {
  return text.slice(0, start) + insert + text.slice(end);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Deterministic cleanup: remove ASCII noise between Ethiopic letters, drop Latin inside Ethiopic words, and italicize quoted segments
function cleanupAsciiNoiseAndItalics(input: string): string {
  let out = input;
  // Remove zero-width / BOM
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // ASCII noise between Ethiopic chars -> replace noise with single space
  out = out.replace(/([\u1200-\u137F])[#;:\/\\|`~^*_=+]+([\u1200-\u137F])/g, '$1 $2');
  // Latin letters embedded within Ethiopic words -> drop Latin
  out = out.replace(/([\u1200-\u137F]+)[a-zA-Z]+([\u1200-\u137F]+)/g, '$1$2');
  // Normalize excessive ASCII punctuation
  out = out.replace(/[!]{2,}/g, '!').replace(/[\?]{2,}/g, '?');
  // Ensure single spaces
  out = out.replace(/ {2,}/g, ' ');
  // Italicize text enclosed in Ethiopic/curly quotes
  out = out.replace(/[“«‘]([^”»’\n]{2,})[”»’]/g, '*$1*');
  return out;
}

// OCR-friendly smart formatter: adds simple headings/lists/quotes and cleans up noise
function smartFormatToMarkdown(input: string): string {
  if (!input) return '';
  const lines = input.split(/\r?\n/);


  const cleaned: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // keep page numbers; we'll allow styling in preview or leave as-is
    // normalize bullets like • and ◦
    let s = l.replace(/^\s*[•◦]\s*/, '- ');
    // quotes: Ethiopian/curly quotes → blockquote; also italicize the quoted text
    const t = s.trim();
    if (/^[“«].*[”»]$/.test(t)) {
      const inner = t.replace(/^[“«]\s*/, '').replace(/\s*[”»]$/, '');
      s = `> *${inner}*`;
    } else if (/^[“«]/.test(t)) {
      s = "> " + t; // at least make it a blockquote
    } else {
      // Inline italics: Ethiopic/curly or guillemet quoted segments → emphasis
      // Handle both double and single style quotes
      s = s.replace(/[“«‘]([^”»’]{2,})[”»’]/g, '*$1*');
    }
    cleaned.push(s);
  }

  // Collapse multiple blank lines
  const collapsed: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const l = cleaned[i];
    const prev = collapsed[collapsed.length - 1] || '';
    if (l.trim() === '' && prev.trim() === '') continue;
    collapsed.push(l);
  }

  // Heading heuristics near top
  const firstIdx = collapsed.findIndex((l) => l.trim() !== '');
  if (firstIdx !== -1) {
    const first = collapsed[firstIdx].trim();
    // const second = collapsed[firstIdx + 1]?.trim() ?? '';
    const nextNonEmptyIdx = collapsed.findIndex((l, idx) => idx > firstIdx && l.trim() !== '');
    const nextNonEmpty = nextNonEmptyIdx >= 0 ? collapsed[nextNonEmptyIdx].trim() : '';

    const short = (s: string, n = 40) => s && s.length <= n;
    const alreadyHeading = /^#{1,6}\s/.test(first);
    if (!alreadyHeading && short(first, 42)) {
      collapsed[firstIdx] = '# ' + first.replace(/^#+\s*/, '');
      // Potential subtitle as H2 if next short line
      if (short(nextNonEmpty, 60) && nextNonEmptyIdx !== -1) {
        const isListLike = /^[-*+]\s|^\d+\.|^>\s/.test(nextNonEmpty);
        const isHeading = /^#{1,6}\s/.test(nextNonEmpty);
        if (!isListLike && !isHeading) {
          collapsed[nextNonEmptyIdx] = '## ' + nextNonEmpty.replace(/^#+\s*/, '');
        }
      }
    }
  }

  // Numbered lists normalization: "1) text" => "1. text"
  for (let i = 0; i < collapsed.length; i++) {
    collapsed[i] = collapsed[i].replace(/^(\s*)\d+\)\s+/, (_match, g1) => g1 + '1. ');
  }

  // Ensure single blank line between blocks
  const finalLines: string[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const cur = collapsed[i];
    const prev = finalLines[finalLines.length - 1] || '';
    if (cur.trim() === '' && prev.trim() === '') continue;
    finalLines.push(cur);
  }
  return finalLines.join('\n');
}

// Remove unintended Latin words for Ethiopic languages but keep punctuation/whitespace
function sanitizeProposal(input: string, lang?: string | null): string {
  if (!input) return '';
  const isEth = lang === 'am' || /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(input);
  if (!isEth) return input;
  // Keep words that contain Ethiopic or digits; strip standalone Latin words
  return input.replace(/(\p{L}[\p{L}\p{M}\p{N}_]*|\p{N}+|\s+|.)/gu, (m) => {
    if (/^[\s]+$/.test(m)) return m;
    if (/^[0-9]+$/.test(m)) return m;
    if (/[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(m)) return m;
    if (/^[A-Za-z]+$/.test(m)) return ''; // drop plain Latin word
    return m; // punctuation or mixed stays
  });
}

// Focused OCR error detection - only high-confidence corruption
function detectOCRErrors(text: string) {
  const errorPatterns = [
    // Clear OCR noise patterns only
    { pattern: /\bA\d{3,4}\b/g, type: 'error', reason: 'OCR noise (A+numbers)', confidence: 95 },
    { pattern: /\b\d{3,4}A\s*F\b/g, type: 'error', reason: 'OCR noise fragment', confidence: 95 },
    { pattern: /\bTh\?\b/g, type: 'error', reason: 'Incomplete OCR fragment', confidence: 90 },
    { pattern: /\bAIC\b/g, type: 'error', reason: 'OCR noise (mixed scripts)', confidence: 85 },

    // Clear ASCII noise in Amharic
    { pattern: /#[\u1200-\u137F]/g, type: 'error', reason: 'ASCII symbol in Amharic', confidence: 90 },

    // Only obvious mixed script issues
    { pattern: /\b[A-Z]{3,}\b(?=\s*[\u1200-\u137F])/g, type: 'error', reason: 'Latin text mixed with Amharic', confidence: 80 }
  ];

  const errors: any[] = [];

  errorPatterns.forEach((errorType, patternIndex) => {
    let match;
    // Reset regex lastIndex
    errorType.pattern.lastIndex = 0;
    while ((match = errorType.pattern.exec(text)) !== null) {
      const errorText = match[0];
      const suggestion = generateSuggestion(errorText, errorType.reason);

      errors.push({
        text: errorText,
        start: match.index,
        end: match.index + errorText.length,
        type: errorType.type,
        reason: errorType.reason,
        confidence: errorType.confidence,
        suggestion: suggestion,
        id: `error-${patternIndex}-${match.index}`,
        action: suggestion === 'Remove' ? 'remove' : 'replace'
      });

      // Prevent infinite loops
      if (errorType.pattern.lastIndex === match.index) {
        errorType.pattern.lastIndex++;
      }
    }
  });

  return errors.sort((a, b) => b.start - a.start);
}

// Generate intelligent suggestions based on error type
function generateSuggestion(text: string, reason: string): string {
  if (reason.includes('noise') || reason.includes('fragment') || reason.includes('code pattern')) {
    return 'Remove';
  }
  if (reason.includes('ASCII') || reason.includes('Special characters')) {
    return text.replace(/[A-Za-z0-9#~`!@#$%^&*()_+=\\|{}:;"'<>,.]/g, '').trim() || 'Remove';
  }
  if (reason.includes('Number embedded')) {
    return text.replace(/\d/g, '');
  }
  if (reason.includes('Latin letters')) {
    return text.replace(/[A-Za-z]/g, '').trim() || 'Remove';
  }
  return text.trim() || 'Remove';
}

// Removed deprecated IntelligentPreview component (unused)

