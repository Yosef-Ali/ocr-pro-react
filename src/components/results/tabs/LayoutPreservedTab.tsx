import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { OCRResult } from '@/types';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { useOCRStore } from '@/store/ocrStore';

interface Props {
  result: OCRResult;
}

export const LayoutPreservedTab: React.FC<Props> = ({ result }) => {
  const { updateResult } = useOCRStore();
  const initial = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const preview = useMemo(() => draft, [draft]);
  useEffect(() => {
    // When switching to a different file/result, reset editor
    const next = result.metadata?.layoutMarkdown ?? result.layoutPreserved;
    setDraft(next);
  }, [result.fileId, result.layoutPreserved, result.metadata?.layoutMarkdown]);
  const handleSave = () => {
    setSaving(true);
    updateResult(result.fileId, { metadata: { ...result.metadata, layoutMarkdown: draft } });
    setTimeout(() => setSaving(false), 600);
  };

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Debounce autosave by 1s after edits
    debounceRef.current = window.setTimeout(() => {
      if (draft !== initial) {
        updateResult(result.fileId, { metadata: { ...result.metadata, layoutMarkdown: draft } });
        setAutoSaved(true);
        window.setTimeout(() => setAutoSaved(false), 1000);
      }
    }, 1000);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [draft, result.fileId, updateResult, initial, result.metadata]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-3">
          <label className="block text-xs text-gray-500 mb-2">Markdown Editor</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-72 md:h-96 p-2 border rounded text-sm font-mono"
          />
          <div className="flex items-center justify-end gap-3 mt-2">
            {saving && <span className="text-xs text-gray-500">Saved</span>}
            <button onClick={handleSave} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm">Save</button>
          </div>
        </div>
        <div className="bg-gray-50 border rounded-lg p-3 overflow-auto h-72 md:h-96">
          <label className="block text-xs text-gray-500 mb-2">Preview</label>
          <div className="prose prose-slate max-w-none text-sm">
            <Suspense fallback={<div className="text-xs text-gray-500">Loading preview…</div>}>
              <SafeMarkdown content={preview} />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end">
        {autoSaved && <span className="text-xs text-gray-500">Auto-saved</span>}
      </div>
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
  } catch (e: unknown) {
    setError((e as Error)?.message || 'Failed to render markdown');
    return null;
  }
};
