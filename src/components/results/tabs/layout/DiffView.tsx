import React from 'react';

export type TokenChange =
  | { kind: 'ins'; j: number; c: string }
  | { kind: 'del'; i: number; o: string }
  | { kind: 'sub'; i: number; j: number; o: string; c: string };

interface DiffViewProps {
  original: string;
  current: string;
  isEthiopic: boolean;
  mode: 'line' | 'word';
  ignoredWords?: string[];
  onIgnoreWord?: (word: string) => void;
  onSuggestionCountChange?: (n: number) => void;
  onUpdate?: (next: { base?: string; proposal?: string }) => void;
}

const ETH_WORD_RE = /[\p{L}\p{N}]/u;

const normalizeForDiff = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFC');

const TOKEN_REGEX = /(\p{L}[\p{L}\p{M}\p{N}_]*(?:\/[\p{L}\p{M}\p{N}_]+)?|\p{N}+|\s+|\p{P}+)/gu;
const tokenize = (text: string) => text.match(TOKEN_REGEX) ?? [text];

const isWord = (value?: string) => !!value && ETH_WORD_RE.test(value);

const DiffViewComponent: React.FC<DiffViewProps> = ({
  original,
  current,
  isEthiopic,
  mode,
  ignoredWords = [],
  onIgnoreWord,
  onSuggestionCountChange,
  onUpdate,
}) => {
  if (mode === 'line') {
    const oLines = original.split(/\r?\n/);
    const cLines = current.split(/\r?\n/);
    const max = Math.max(oLines.length, cLines.length);
    const rows = Array.from({ length: max }, (_, idx) => ({
      o: oLines[idx] ?? '',
      c: cLines[idx] ?? '',
      changed: (oLines[idx] ?? '') !== (cLines[idx] ?? ''),
    }));

    return (
      <div className={`grid grid-cols-2 gap-3 text-[13px] leading-relaxed ${isEthiopic ? 'font-ethiopic' : ''}`}>
        <div className="text-xs font-medium text-gray-500 pb-1 border-b">Original</div>
        <div className="text-xs font-medium text-gray-500 pb-1 border-b">Current</div>
        {rows.map((row, idx) => (
          <React.Fragment key={idx}>
            <pre className={`whitespace-pre-wrap break-words p-1 rounded border bg-white min-h-[1.25rem] ${row.changed ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>{row.o}</pre>
            <pre className={`whitespace-pre-wrap break-words p-1 rounded border bg-white min-h-[1.25rem] ${row.changed ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>{row.c}</pre>
          </React.Fragment>
        ))}
      </div>
    );
  }

  const normOriginal = normalizeForDiff(original);
  const normCurrent = normalizeForDiff(current);
  const oTokens = tokenize(normOriginal);
  const cTokens = tokenize(normCurrent);

  const lcs: number[][] = Array(oTokens.length + 1)
    .fill(null)
    .map(() => Array(cTokens.length + 1).fill(0));

  for (let i = oTokens.length - 1; i >= 0; i--) {
    for (let j = cTokens.length - 1; j >= 0; j--) {
      if (oTokens[i] === cTokens[j]) {
        lcs[i][j] = 1 + lcs[i + 1][j + 1];
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const ops: Array<{ type: 'eq' | 'del' | 'ins'; o?: string; c?: string; i?: number; j?: number }> = [];
  let i = 0;
  let j = 0;

  while (i < oTokens.length && j < cTokens.length) {
    if (oTokens[i] === cTokens[j]) {
      ops.push({ type: 'eq', o: oTokens[i], c: cTokens[j], i, j });
      i++;
      j++;
      continue;
    }
    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', o: oTokens[i], i });
      i++;
    } else {
      ops.push({ type: 'ins', c: cTokens[j], j });
      j++;
    }
  }

  while (i < oTokens.length) {
    ops.push({ type: 'del', o: oTokens[i], i });
    i++;
  }

  while (j < cTokens.length) {
    ops.push({ type: 'ins', c: cTokens[j], j });
    j++;
  }

  const [menu, setMenu] = React.useState<{ x: number; y: number; change: TokenChange } | null>(null);
  const changeMapRef = React.useRef(new Map<string, TokenChange>());
  const shouldIgnore = React.useCallback((token?: string) => !!token && ignoredWords.includes(token), [ignoredWords]);

  const baseTokens = React.useMemo(() => tokenize(normOriginal), [normOriginal]);
  const propTokens = React.useMemo(() => tokenize(normCurrent), [normCurrent]);

  const applyChange = (kind: 'accept' | 'reject', change: TokenChange) => {
    if (!onUpdate) return;

    if (change.kind === 'sub') {
      if (kind === 'accept') {
        const nextBase = [...baseTokens];
        nextBase[change.i] = propTokens[change.j];
        onUpdate({ base: nextBase.join('') });
      } else {
        const nextProp = [...propTokens];
        nextProp[change.j] = baseTokens[change.i];
        onUpdate({ proposal: nextProp.join('') });
      }
      return;
    }

    if (change.kind === 'ins') {
      if (kind === 'accept') {
        const nextBase = [...baseTokens];
        const insertAt = Math.min(change.j, nextBase.length);
        nextBase.splice(insertAt, 0, propTokens[change.j]);
        onUpdate({ base: nextBase.join('') });
      } else {
        const nextProp = [...propTokens];
        nextProp.splice(change.j, 1);
        onUpdate({ proposal: nextProp.join('') });
      }
      return;
    }

    if (change.kind === 'del') {
      if (kind === 'accept') {
        const nextBase = [...baseTokens];
        nextBase.splice(change.i, 1);
        onUpdate({ base: nextBase.join('') });
      } else {
        const nextProp = [...propTokens];
        const insertAt = Math.min(change.i, nextProp.length);
        nextProp.splice(insertAt, 0, baseTokens[change.i]);
        onUpdate({ proposal: nextProp.join('') });
      }
    }
  };

  const diffNodes = React.useMemo(() => {
    const nodes: JSX.Element[] = [];
    const changeMap = new Map<string, TokenChange>();
    let count = 0;

    const register = (key: string, change: TokenChange, className: string, children: React.ReactNode, tooltip?: string) => {
      changeMap.set(key, change);
      count++;
      nodes.push(
        <span key={key} data-change-id={key} className={className} title={tooltip}>
          {children}
        </span>
      );
    };

    for (let idx = 0; idx < ops.length; idx++) {
      const op = ops[idx];

      if (op.type === 'del' && ops[idx + 1]?.type === 'ins') {
        const delToken = op.o || '';
        const insToken = ops[idx + 1].c || '';
        if ((isWord(delToken) || isWord(insToken)) && !(shouldIgnore(delToken) || shouldIgnore(insToken))) {
          const key = `sub-${op.i}-${ops[idx + 1].j}`;
          register(
            key,
            { kind: 'sub', i: op.i!, j: ops[idx + 1].j!, o: delToken, c: insToken },
            'relative cursor-context-menu rounded-sm bg-amber-50/80 underline decoration-wavy decoration-amber-500 underline-offset-2 px-0.5 text-current',
            delToken,
            insToken ? `Suggestion: ${insToken}` : undefined
          );
          idx++;
          continue;
        }
      }

      if (op.type === 'eq') {
        nodes.push(<span key={`eq-${idx}`}>{op.o}</span>);
        continue;
      }

      if (op.type === 'del') {
        if (!isWord(op.o) || shouldIgnore(op.o)) {
          nodes.push(<span key={`del-${idx}`}>{op.o}</span>);
        } else {
          const key = `del-${op.i}-${idx}`;
          register(
            key,
            { kind: 'del', i: op.i!, o: op.o! },
            'relative cursor-context-menu rounded-sm bg-amber-50/80 underline decoration-wavy decoration-amber-500 underline-offset-2 px-0.5 text-current',
            op.o,
            'Mark as correct or remove'
          );
        }
        continue;
      }

      if (op.type === 'ins') {
        if (!isWord(op.c) || shouldIgnore(op.c)) {
          nodes.push(<span key={`ins-${idx}`}>{op.c}</span>);
        } else {
          const key = `ins-${op.j}-${idx}`;
          register(
            key,
            { kind: 'ins', j: op.j!, c: op.c! },
            'relative cursor-context-menu rounded-sm bg-green-50/80 underline decoration-wavy decoration-green-500 underline-offset-2 px-0.5 text-green-600 font-semibold',
            <span className="inline-flex items-center justify-center align-middle leading-none">＋</span>,
            `Insert "${op.c}"`
          );
        }
      }
    }

    return { nodes, changeMap, count };
  }, [ops, shouldIgnore]);

  React.useEffect(() => {
    changeMapRef.current = diffNodes.changeMap;
    onSuggestionCountChange?.(diffNodes.count);
  }, [diffNodes, onSuggestionCountChange]);

  const handleContextMenu = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const element = (event.target as HTMLElement).closest('[data-change-id]') as HTMLElement | null;
    if (!element) return;
    event.preventDefault();
    const key = element.getAttribute('data-change-id');
    if (!key) return;
    const change = changeMapRef.current.get(key);
    if (!change) return;
    setMenu({ x: event.clientX, y: event.clientY, change });
  }, []);

  return (
    <div
      className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words relative overflow-x-auto ${isEthiopic ? 'font-ethiopic' : ''}`}
      onContextMenu={handleContextMenu}
    >
      {diffNodes.nodes}
      {menu && (
        <RightClickMenu
          x={menu.x}
          y={menu.y}
          change={menu.change}
          onClose={() => setMenu(null)}
          onAccept={() => {
            applyChange('accept', menu.change);
            setMenu(null);
          }}
          onReject={() => {
            applyChange('reject', menu.change);
            setMenu(null);
          }}
          onIgnore={() => {
            let token: string | undefined;
            if (menu.change.kind === 'ins') token = menu.change.c;
            else if (menu.change.kind === 'del' || menu.change.kind === 'sub') token = menu.change.o;
            if (token) onIgnoreWord?.(token);
            setMenu(null);
          }}
          onFixAllSimilar={menu.change.kind === 'sub'
            ? () => {
              if (!onUpdate) {
                setMenu(null);
                return;
              }
              if (menu.change.kind !== 'sub') {
                setMenu(null);
                return;
              }
              const nextBase = [...baseTokens];
              const { o: from, c: to } = menu.change;
              for (let idx = 0; idx < nextBase.length; idx++) {
                if (nextBase[idx] === from) nextBase[idx] = to;
              }
              onUpdate({ base: nextBase.join('') });
              setMenu(null);
            }
            : undefined}
        />
      )}
    </div>
  );
};

interface RightClickMenuProps {
  x: number;
  y: number;
  change: TokenChange;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
  onIgnore?: () => void;
  onFixAllSimilar?: () => void;
}

const RightClickMenu: React.FC<RightClickMenuProps> = ({ x, y, change, onAccept, onReject, onClose, onIgnore, onFixAllSimilar }) => {
  const suggestion = change.kind === 'sub' ? change.c : change.kind === 'ins' ? change.c : undefined;
  const original = change.kind === 'sub' ? change.o : change.kind === 'del' ? change.o : undefined;

  const primaryLabel = change.kind === 'ins'
    ? `Insert "${change.c}"`
    : change.kind === 'del'
      ? `Remove "${change.o}"`
      : suggestion
        ? `Replace with "${suggestion}"`
        : 'Apply change';

  const secondaryLabel = change.kind === 'ins'
    ? 'Dismiss insertion'
    : change.kind === 'del'
      ? 'Keep this word'
      : original
        ? `Keep "${original}"`
        : 'Keep original';

  return (
    <div
      className="fixed z-50 bg-white border rounded shadow-lg text-sm min-w-[220px]"
      style={{ left: x + 4, top: y + 4 }}
      onMouseLeave={onClose}
    >
      {(suggestion || original) && (
        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
          {suggestion && (
            <div>
              Suggested: <span className="font-semibold text-gray-900">{suggestion}</span>
            </div>
          )}
          {original && suggestion && (
            <div className="text-[11px] text-gray-500">Original: {original}</div>
          )}
        </div>
      )}
      <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onAccept}>{primaryLabel}</button>
      <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onReject}>{secondaryLabel}</button>
      {onIgnore && (
        <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onIgnore}>Ignore this word</button>
      )}
      {onFixAllSimilar && (
        <>
          <div className="my-1 border-t" />
          <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={onFixAllSimilar}>Fix all similar</button>
        </>
      )}
    </div>
  );
};

export const DiffView = React.memo(DiffViewComponent);
