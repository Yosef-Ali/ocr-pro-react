import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { detectOCRErrors, OcrError } from './utils';

interface SafeMarkdownProps {
  content: string;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content }) => {
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; error: OcrError } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ETH_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/;
  const isEthiopic = ETH_RE.test(content);

  const ocrErrors = useMemo(() => {
    if (!isEthiopic) return [] as OcrError[];
    return detectOCRErrors(content);
  }, [content, isEthiopic]);

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
                let highlightedText = textContent;

                ocrErrors.forEach((ocrError) => {
                  const escaped = ocrError.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const regex = new RegExp(escaped, 'g');
                  highlightedText = highlightedText.replace(
                    regex,
                    `<span class="underline decoration-wavy decoration-red-500 decoration-2 underline-offset-4 cursor-context-menu bg-red-50" data-error="${encodeURIComponent(JSON.stringify(ocrError))}">${ocrError.text}</span>`
                  );
                });

                if (highlightedText !== textContent) {
                  return (
                    <p
                      dangerouslySetInnerHTML={{ __html: highlightedText }}
                      onContextMenu={(event) => {
                        const target = event.target as HTMLElement;
                        if (!target.dataset.error) return;
                        event.preventDefault();
                        try {
                          const errorData = JSON.parse(decodeURIComponent(target.dataset.error)) as OcrError;
                          setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            error: errorData,
                          });
                        } catch (err) {
                          console.error('Failed to parse OCR error data', err);
                        }
                      }}
                    />
                  );
                }
              }

              return <p>{children}</p>;
            },
          }}
        >
          {content}
        </ReactMarkdown>

        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="font-medium text-gray-900 text-sm">"{contextMenu.error.text}"</div>
              <div className="text-xs text-gray-600 mt-1">{contextMenu.error.reason}</div>
              <div className="text-xs text-gray-500">Confidence: {contextMenu.error.confidence}%</div>
            </div>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-700 flex items-center gap-2"
              onClick={() => {
                alert(`Would fix: "${contextMenu.error.text}" → "${contextMenu.error.suggestion}"`);
                setContextMenu(null);
              }}
            >
              <span className="text-green-600">✓</span>
              {contextMenu.error.action === 'remove'
                ? 'Remove'
                : `Replace with "${contextMenu.error.suggestion}"`}
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
  } catch (err: any) {
    setError(err?.message || 'Failed to render markdown');
    return null;
  }
};
