import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { OCRResult } from '@/types';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { useOCRStore } from '@/store/ocrStore';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Type, Wand2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  result: OCRResult;
}

export const LayoutPreservedTab: React.FC<Props> = ({ result }) => {
  const { updateResult, settings, files, toggleSettings } = useOCRStore();
  const hasApiKey = !!settings.apiKey && settings.apiKey.trim().length > 0;
  const initial = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
  const [draft, setDraft] = useState(initial);
  const [autoSaved, setAutoSaved] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [appliedPulse, setAppliedPulse] = useState(false);
  const [pfProgress, setPfProgress] = useState(0);
  const [pfSource, setPfSource] = useState<null | 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-2.5-pro' | 'openrouter-gemini-2.5-pro' | 'local'>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCorrectingWithVision, setIsCorrectingWithVision] = useState(false);
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
  const haveAnyAiTitle = (hasApi: boolean, openRouterKey?: string) => {
    const hasAny = hasApi || !!openRouterKey;
    return hasAny ? 'AI Fix — Image-aware when available, otherwise proofreading' : 'Set Gemini or OpenRouter API key in Settings to enable AI';
  };

  // Smart analysis actions removed

  // Smart analysis removed from UI

  // Unified AI Fix: Prefer Vision; fallback to Proofreading + cleanup
  const runUnifiedAIFix = async () => {
    const originalFile = files.find(f => f.id === result.fileId);
    const canVision = (!!settings.apiKey || !!settings.openRouterApiKey) && !!originalFile?.preview;
    const haveAnyAI = !!settings.apiKey || !!settings.openRouterApiKey;

    if (!haveAnyAI) {
      // No keys: guide user to Settings instead of silent local no-op
      toast.error('Add an API key in Settings to use AI');
      toggleSettings();
      return;
    }

    // Show a single, generic progress UI
    setIsCorrectingWithVision(true);
    toast.loading('AI improving text…', { id: 'ai-fix' });

    try {
      // 1) Try Vision if possible
      if (canVision) {
        try {
          const { correctTextWithAIVision } = await import('@/services/geminiService');
          const { correctedText, corrections, source } = await correctTextWithAIVision(
            draft,
            originalFile!.preview!,
            settings
          );
          setDraft(correctedText);
          setPfSource(source);
          setAppliedPulse(true);
          setTimeout(() => setAppliedPulse(false), 1500);
          updateResult(result.fileId, { metadata: { layoutMarkdown: correctedText, aiVisionCorrections: corrections } as any });
          toast.success('AI Vision applied corrections from the image.', { id: 'ai-fix' });
          return;
        } catch (visionErr) {
          console.warn('Vision path failed; falling back to proofreading:', visionErr);
        }
      }

      // 2) Fallback: Proofread whole draft
      const { proofreadAmharicWithMeta } = await import('@/services/geminiService');
      const { suggestions, source } = await proofreadAmharicWithMeta(draft, settings, { maxSuggestions: 30 });
      setPfSource(source);

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
        setDraft(transformed);
        setAppliedPulse(true);
        setTimeout(() => setAppliedPulse(false), 900);
        updateResult(result.fileId, { metadata: { proofreadingSuggestions: suggestions } as any });
        toast.success(`Applied ${applied} AI fixes.`, { id: 'ai-fix' });
      } else {
        toast('No AI changes needed.', { id: 'ai-fix' });
      }
    } catch (e) {
      console.error('Unified AI Fix failed:', e);
      toast.error('AI improvement failed', { id: 'ai-fix' });
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
          {/* Simplified Toolbar: single AI Fix action */}
          <div className="flex flex-wrap gap-1 mb-2">
            <ToolbarButton
              title={haveAnyAiTitle(hasApiKey, settings.openRouterApiKey)}
              onClick={runUnifiedAIFix}
              disabled={isAnalyzing || isProofreading || isCorrectingWithVision}
            >
              {(isAnalyzing || isProofreading || isCorrectingWithVision) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </ToolbarButton>
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
          {pfSource && (
            <div className="mb-2 text-[11px] text-gray-600">
              AI source: {pfSource === 'local' ? 'Local cleanup' : pfSource === 'openrouter-gemini-2.5-pro' ? 'OpenRouter Gemini 2.0 Flash' : pfSource.replace('gemini-1.5-', 'Gemini 1.5 ').replace('gemini-2.5-', 'Gemini 2.5 ')}
            </div>
          )}
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
                  <span>AI improving text…</span>
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
                {isCorrectingWithVision ? 'AI Vision' : isAnalyzing ? 'Analyzing' : 'Proofreading'}
              </span>
            )}
          </div>
          <div
            className={`prose prose-slate mx-auto max-w-[42rem] text-[15px] leading-7 prose-headings:font-semibold prose-h1:text-2xl prose-h1:leading-tight prose-h1:mb-3 prose-h2:text-xl prose-h2:mt-4 prose-h2:mb-2 prose-p:my-2 prose-p:text-justify prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:bg-gray-100 prose-pre:rounded prose-pre:p-3 prose-blockquote:italic prose-blockquote:border-l-4 prose-blockquote:border-gray-300 ${isEthiopic ? 'font-ethiopic' : ''}`}
            lang={result.detectedLanguage || 'am'}
            dir="auto"
          >
            <Suspense fallback={<div className="text-xs text-gray-500">Loading preview…</div>}>
              <SafeMarkdown content={preview} />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end" />
    </div>
  );
};

const SafeMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const [error, setError] = useState<string | null>(null);
  if (error) {
    return (
      <div className="text-xs text-gray-600">
        <div className="mb-1">Preview failed — showing raw text:</div>
        <pre className="whitespace-pre-wrap break-words text-sm bg-white p-2 border rounded">{content}</pre>
      </div>
    );
  }
  try {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  } catch (e: any) {
    setError(e?.message || 'Failed to render markdown');
    return null;
  }
};

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

