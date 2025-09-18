import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { analyzeAmharicTextForHighlighting } from '@/utils/textUtils';
import { containsEthiopic } from '@/utils/textUtils';

interface WordAnalysis {
  word: string;
  position: { start: number; end: number };
  confidence: number;
  issues?: string[];
  suggestions?: string[];
}

interface ProofreadingSuggestion {
  original: string;
  suggestion: string;
  reason?: string;
  confidence?: number;
}

interface Props {
  text: string;
  wordAnalysis: WordAnalysis[];
  suggestions: ProofreadingSuggestion[];
  onWordClick?: (word: WordAnalysis) => void;
  onApplySuggestion?: (original: string, suggestion: string) => void;
}

export const IntelligentTextHighlighter: React.FC<Props> = ({
  text,
  wordAnalysis,
  suggestions,
  onWordClick,
  onApplySuggestion
}) => {
  const [hoveredWord, setHoveredWord] = useState<WordAnalysis | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Enhanced analysis combining existing analysis with Amharic-specific validation
  const enhancedWordAnalysis = useMemo(() => {
    const hasAmharic = containsEthiopic(text);

    if (!hasAmharic) {
      // For non-Amharic text, use the original analysis
      return wordAnalysis;
    }

    // Get Amharic-specific analysis
    const amharicAnalysis = analyzeAmharicTextForHighlighting(text);

    // Create a map for quick lookup of Amharic analysis by word and position
    const amharicMap = new Map<string, typeof amharicAnalysis[0]>();
    amharicAnalysis.forEach(analysis => {
      const key = `${analysis.word}-${analysis.position.start}-${analysis.position.end}`;
      amharicMap.set(key, analysis);
    });

    // Enhance existing analysis with Amharic-specific data
    return wordAnalysis.map(existingAnalysis => {
      const key = `${existingAnalysis.word}-${existingAnalysis.position.start}-${existingAnalysis.position.end}`;
      const amharicData = amharicMap.get(key);

      if (amharicData) {
        // Use Amharic analysis confidence and issues
        return {
          ...existingAnalysis,
          confidence: amharicData.confidence,
          issues: [
            ...(existingAnalysis.issues || []),
            ...(amharicData.issues || [])
          ].filter((issue, index, arr) => arr.indexOf(issue) === index), // Remove duplicates
          suggestions: [
            ...(existingAnalysis.suggestions || []),
            ...(amharicData.suggestions || [])
          ].filter((suggestion, index, arr) => arr.indexOf(suggestion) === index) // Remove duplicates
        };
      }

      return existingAnalysis;
    });
  }, [text, wordAnalysis]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  // Function to get confidence level styling
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'bg-green-100 border-green-300 text-green-800'; // High confidence - green
    } else if (confidence >= 0.6) {
      return 'bg-yellow-100 border-yellow-300 text-yellow-800'; // Medium confidence - yellow
    } else {
      return 'bg-red-100 border-red-300 text-red-800'; // Low confidence - red
    }
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    } else if (confidence >= 0.6) {
      return <HelpCircle className="w-3 h-3 text-yellow-600" />;
    } else {
      return <AlertCircle className="w-3 h-3 text-red-600" />;
    }
  };

  // Split text into segments with highlighting
  const renderHighlightedText = () => {
    if (!enhancedWordAnalysis.length) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort word analysis by position
    const sortedAnalysis = [...enhancedWordAnalysis].sort((a, b) => a.position.start - b.position.start);

    sortedAnalysis.forEach((analysis, index) => {
      const { position, confidence, word, issues } = analysis;

      // Add text before this word
      if (position.start > lastIndex) {
        segments.push(
          <span key={`text-${index}`} className="whitespace-pre-wrap">
            {text.slice(lastIndex, position.start)}
          </span>
        );
      }

      // Add highlighted word
      const isProblematic = confidence < 0.8 || (issues && issues.length > 0);

      segments.push(
        <span
          key={`word-${index}`}
          className={`relative inline-block cursor-pointer transition-all duration-200 ${isProblematic
              ? `border-b-2 ${getConfidenceStyle(confidence)} hover:shadow-sm`
              : 'hover:bg-accent'
            }`}
          onMouseEnter={() => isProblematic && setHoveredWord(analysis)}
          onMouseLeave={() => setHoveredWord(null)}
          onMouseMove={handleMouseMove}
          onClick={() => onWordClick?.(analysis)}
          title={isProblematic ? `Confidence: ${(confidence * 100).toFixed(1)}%` : ''}
        >
          {word}
        </span>
      );

      lastIndex = position.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-final" className="whitespace-pre-wrap">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return segments;
  };

  return (
    <div className="relative">
      <div className="leading-relaxed text-base font-mono">
        {renderHighlightedText()}
      </div>

      {/* Hover tooltip */}
      {hoveredWord && (
        <div
          className="fixed z-50 bg-card text-card-foreground border border-border rounded-lg shadow-lg p-3 max-w-xs"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 10,
            transform: 'translate(0, -100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {getConfidenceIcon(hoveredWord.confidence)}
            <span className="font-semibold text-sm">
              Confidence: {(hoveredWord.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="text-sm">
            <div className="font-mono bg-muted px-2 py-1 rounded mb-2">
              "{hoveredWord.word}"
            </div>

            {hoveredWord.issues && hoveredWord.issues.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-foreground mb-1">
                  Issues: {containsEthiopic(hoveredWord.word) && <span className="text-primary">(Amharic Analysis)</span>}
                </div>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {hoveredWord.issues.map((issue, idx) => (
                    <li key={idx} className={
                      issue.includes('Mixed') || issue.includes('ASCII') || issue.includes('character')
                        ? 'text-red-600 font-medium'
                        : ''
                    }>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hoveredWord.suggestions && hoveredWord.suggestions.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">Suggestions:</div>
                <div className="space-y-1">
                  {hoveredWord.suggestions.slice(0, 3).map((suggestion, idx) => (
                    <button
                      key={idx}
                      className="block w-full text-left px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-foreground rounded transition-colors"
                      onClick={() => onApplySuggestion?.(hoveredWord.word, suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show related suggestions from general proofreading */}
            {suggestions
              .filter(s => s.original.includes(hoveredWord.word) || hoveredWord.word.includes(s.original))
              .slice(0, 2)
              .map((suggestion, idx) => (
                <div key={idx} className="mt-2 pt-2 border-t border-border">
                  <div className="text-xs font-semibold text-foreground">Context suggestion:</div>
                  <button
                    className="block w-full text-left px-2 py-1 text-xs bg-purple-50 hover:bg-purple-100 rounded transition-colors mt-1"
                    onClick={() => onApplySuggestion?.(suggestion.original, suggestion.suggestion)}
                  >
                    "{suggestion.original}" → "{suggestion.suggestion}"
                  </button>
                  {suggestion.reason && (
                    <div className="text-xs text-muted-foreground mt-1">{suggestion.reason}</div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span>High confidence (80%+)</span>
        </div>
        <div className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-yellow-600" />
          <span>Medium confidence (60-79%)</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span>Low confidence (&lt;60%)</span>
        </div>
        <span>Hover over highlighted words for suggestions</span>
        {containsEthiopic(text) && (
          <div className="flex items-center gap-1 border-l border-gray-300 pl-4 ml-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-600 font-medium">Amharic-enhanced analysis active</span>
          </div>
        )}
      </div>
    </div>
  );
};