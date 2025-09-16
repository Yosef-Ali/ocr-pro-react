import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Lightbulb,
  Zap
} from 'lucide-react';
import { analyzeAmharicTextForHighlighting, detectCorruptedAmharicText } from '@/utils/textUtils';
import { suggestAmharicCorrections } from '@/utils/amharicHelpers';

interface Suggestion {
  id: string;
  type: 'spelling' | 'grammar' | 'ocr-corruption' | 'punctuation' | 'style';
  severity: 'error' | 'warning' | 'suggestion';
  original: string;
  suggestion: string;
  reason: string;
  confidence: number;
  position: { start: number; end: number };
  category: string;
}

interface Props {
  initialText?: string;
  onTextChange?: (text: string) => void;
  onSuggestionsChange?: (suggestions: Suggestion[]) => void;
  mode?: 'editor' | 'reviewer';
  autoCorrect?: boolean;
}

export const AmharicWritingAssistant: React.FC<Props> = ({
  initialText = '',
  onTextChange,
  onSuggestionsChange,
  mode = 'editor',
  autoCorrect = false
}) => {
  const [text, setText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'errors' | 'warnings' | 'suggestions'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();

  // Real-time analysis with debouncing
  useEffect(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    analysisTimeoutRef.current = setTimeout(() => {
      analyzeText(text);
    }, 500); // 500ms debounce

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [text]);

  // Comprehensive text analysis
  const analyzeText = async (inputText: string) => {
    if (!inputText.trim()) {
      setSuggestions([]);
      return;
    }

    setIsAnalyzing(true);

    try {
      const newSuggestions: Suggestion[] = [];

      // 1. OCR Corruption Detection
      const corruptionAnalysis = detectCorruptedAmharicText(inputText);
      if (corruptionAnalysis.isCorrupted) {
        const ocrCorrections = suggestAmharicCorrections(inputText);
        ocrCorrections.forEach((correction, index) => {
          const startIndex = inputText.indexOf(correction.original);
          if (startIndex !== -1) {
            newSuggestions.push({
              id: `ocr-${index}`,
              type: 'ocr-corruption',
              severity: 'error',
              original: correction.original,
              suggestion: correction.suggestion,
              reason: correction.reason,
              confidence: correction.confidence,
              position: { start: startIndex, end: startIndex + correction.original.length },
              category: 'OCR Errors'
            });
          }
        });
      }

      // 2. Word-level Analysis
      const wordAnalysis = analyzeAmharicTextForHighlighting(inputText);
      wordAnalysis.forEach((analysis, index) => {
        if (analysis.issues && analysis.issues.length > 0) {
          const severity: Suggestion['severity'] =
            analysis.confidence < 0.4 ? 'error' :
              analysis.confidence < 0.7 ? 'warning' : 'suggestion';

          analysis.issues.forEach((issue, issueIndex) => {
            newSuggestions.push({
              id: `word-${index}-${issueIndex}`,
              type: getIssueType(issue),
              severity,
              original: analysis.word,
              suggestion: analysis.suggestions?.[0] || analysis.word,
              reason: issue,
              confidence: analysis.confidence,
              position: analysis.position,
              category: getCategoryFromIssue(issue)
            });
          });
        }
      });

      // 3. Grammar and Style Checks
      const grammarSuggestions = await analyzeGrammarAndStyle(inputText);
      newSuggestions.push(...grammarSuggestions);

      // 4. Punctuation Checks
      const punctuationSuggestions = await analyzePunctuation(inputText);
      newSuggestions.push(...punctuationSuggestions);

      // Remove duplicates and sort by position
      const uniqueSuggestions = newSuggestions
        .filter((suggestion, index, arr) =>
          arr.findIndex(s => s.position.start === suggestion.position.start && s.original === suggestion.original) === index
        )
        .sort((a, b) => a.position.start - b.position.start);

      setSuggestions(uniqueSuggestions);
      onSuggestionsChange?.(uniqueSuggestions);

      // Auto-apply high-confidence corrections if enabled
      if (autoCorrect) {
        const highConfidenceSuggestions = uniqueSuggestions.filter(s =>
          s.confidence >= 0.9 && s.severity === 'error'
        );
        if (highConfidenceSuggestions.length > 0) {
          applyMultipleSuggestions(highConfidenceSuggestions);
        }
      }

    } catch (error) {
      console.error('Text analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply suggestion
  const applySuggestion = (suggestion: Suggestion) => {
    const newText = text.slice(0, suggestion.position.start) +
      suggestion.suggestion +
      text.slice(suggestion.position.end);

    setText(newText);
    onTextChange?.(newText);

    // Remove applied suggestion
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    setSelectedSuggestion(null);
  };

  // Apply multiple suggestions
  const applyMultipleSuggestions = (suggestionsToApply: Suggestion[]) => {
    // Sort by position (reverse order to maintain indices)
    const sortedSuggestions = [...suggestionsToApply].sort((a, b) => b.position.start - a.position.start);

    let newText = text;
    sortedSuggestions.forEach(suggestion => {
      newText = newText.slice(0, suggestion.position.start) +
        suggestion.suggestion +
        newText.slice(suggestion.position.end);
    });

    setText(newText);
    onTextChange?.(newText);

    // Remove applied suggestions
    const appliedIds = new Set(suggestionsToApply.map(s => s.id));
    setSuggestions(prev => prev.filter(s => !appliedIds.has(s.id)));
  };

  // Dismiss suggestion
  const dismissSuggestion = (suggestion: Suggestion) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    setSelectedSuggestion(null);
  };

  // Filter suggestions by tab
  const filteredSuggestions = useMemo(() => {
    switch (activeTab) {
      case 'errors':
        return suggestions.filter(s => s.severity === 'error');
      case 'warnings':
        return suggestions.filter(s => s.severity === 'warning');
      case 'suggestions':
        return suggestions.filter(s => s.severity === 'suggestion');
      default:
        return suggestions;
    }
  }, [suggestions, activeTab]);

  // Get text with highlighting
  const getHighlightedText = () => {
    if (!suggestions.length) return text;

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    suggestions
      .sort((a, b) => a.position.start - b.position.start)
      .forEach((suggestion, index) => {
        // Add text before this suggestion
        if (suggestion.position.start > lastIndex) {
          segments.push(
            <span key={`text-${index}`}>
              {text.slice(lastIndex, suggestion.position.start)}
            </span>
          );
        }

        // Add highlighted suggestion
        const isSelected = selectedSuggestion?.id === suggestion.id;
        segments.push(
          <span
            key={`suggestion-${index}`}
            className={`relative cursor-pointer transition-all ${suggestion.severity === 'error'
                ? 'bg-red-100 border-b-2 border-red-500 hover:bg-red-200'
                : suggestion.severity === 'warning'
                  ? 'bg-yellow-100 border-b-2 border-yellow-500 hover:bg-yellow-200'
                  : 'bg-blue-100 border-b-2 border-blue-500 hover:bg-blue-200'
              } ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
            onClick={() => setSelectedSuggestion(suggestion)}
            title={suggestion.reason}
          >
            {text.slice(suggestion.position.start, suggestion.position.end)}
          </span>
        );

        lastIndex = suggestion.position.end;
      });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-final">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return segments;
  };

  const getSeverityIcon = (severity: Suggestion['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'suggestion':
        return <Lightbulb className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: Suggestion['severity']) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'suggestion':
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="font-semibold text-gray-900">Amharic Writing Assistant</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              {isAnalyzing && (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              )}
              {!isAnalyzing && suggestions.length > 0 && (
                <>
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <span>{suggestions.length} issue{suggestions.length !== 1 ? 's' : ''} found</span>
                </>
              )}
              {!isAnalyzing && suggestions.length === 0 && text.trim() && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>No issues found</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center space-x-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              <span>{showSuggestions ? 'Hide' : 'Show'} Suggestions</span>
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4">
          {mode === 'editor' ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-full p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg leading-relaxed"
              placeholder="ሰላም! Paste your Amharic text here for intelligent correction..."
              style={{ fontFamily: 'Nyala, "Noto Sans Ethiopic", monospace' }}
            />
          ) : (
            <div
              className="w-full h-full p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-auto font-mono text-lg leading-relaxed"
              style={{ fontFamily: 'Nyala, "Noto Sans Ethiopic", monospace' }}
            >
              {getHighlightedText()}
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Writing Suggestions</h4>

            {/* Tabs */}
            <div className="flex space-x-1 text-xs">
              {([
                { key: 'all', label: 'All', count: suggestions.length },
                { key: 'errors', label: 'Errors', count: suggestions.filter(s => s.severity === 'error').length },
                { key: 'warnings', label: 'Warnings', count: suggestions.filter(s => s.severity === 'warning').length },
                { key: 'suggestions', label: 'Style', count: suggestions.filter(s => s.severity === 'suggestion').length }
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2 py-1 rounded text-xs font-medium ${activeTab === tab.key
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 bg-gray-200 text-gray-700 px-1 rounded">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions List */}
          <div className="flex-1 overflow-auto">
            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No issues in this category</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${selectedSuggestion?.id === suggestion.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : getSeverityColor(suggestion.severity)
                      }`}
                    onClick={() => setSelectedSuggestion(suggestion)}
                  >
                    <div className="flex items-start space-x-2 mb-2">
                      {getSeverityIcon(suggestion.severity)}
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          {suggestion.category}
                        </p>
                        <p className="text-sm text-gray-900 font-medium">
                          "{suggestion.original}" → "{suggestion.suggestion}"
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {(suggestion.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            applySuggestion(suggestion);
                          }}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Apply
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissSuggestion(suggestion);
                          }}
                          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {suggestions.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const highConfidence = suggestions.filter(s => s.confidence >= 0.8 && s.severity === 'error');
                    if (highConfidence.length > 0) {
                      applyMultipleSuggestions(highConfidence);
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  <Zap className="w-4 h-4" />
                  <span>Fix High-Confidence Errors</span>
                </button>

                <button
                  onClick={() => setSuggestions([])}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                >
                  Dismiss All
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper functions
function getIssueType(issue: string): Suggestion['type'] {
  if (issue.includes('Mixed') || issue.includes('ASCII') || issue.includes('Numbers')) {
    return 'ocr-corruption';
  }
  if (issue.includes('character') || issue.includes('combination')) {
    return 'spelling';
  }
  return 'grammar';
}

function getCategoryFromIssue(issue: string): string {
  if (issue.includes('Mixed scripts')) return 'Script Mixing';
  if (issue.includes('ASCII noise')) return 'OCR Noise';
  if (issue.includes('Numbers')) return 'Number Mixing';
  if (issue.includes('character')) return 'Character Issues';
  return 'Other Issues';
}

async function analyzeGrammarAndStyle(text: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Check for proper sentence endings
  const sentences = text.split(/[።፤]/).filter(s => s.trim());
  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed && /[\u1200-\u137F]$/.test(trimmed)) {
      const position = text.indexOf(sentence) + sentence.length;
      suggestions.push({
        id: `grammar-${index}`,
        type: 'punctuation',
        severity: 'warning',
        original: trimmed,
        suggestion: trimmed + '።',
        reason: 'Amharic sentences should end with proper punctuation (።)',
        confidence: 0.8,
        position: { start: position - 1, end: position },
        category: 'Punctuation'
      });
    }
  });

  return suggestions;
}

function analyzePunctuation(text: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Check for ASCII punctuation that should be Amharic
  const replacements = [
    { from: /([አ-ፚ])\s*:\s*([አ-ፚ])/g, to: '$1፡$2', reason: 'Use Amharic word separator (፡) instead of colon' },
    { from: /([አ-ፚ])\s*,\s*([አ-ፚ])/g, to: '$1፣$2', reason: 'Use Amharic comma (፣) instead of ASCII comma' },
    { from: /([አ-ፚ])\s*\.\s*([አ-ፚ])/g, to: '$1።$2', reason: 'Use Amharic period (።) for sentence endings' }
  ];

  replacements.forEach((replacement, index) => {
    const matches = text.matchAll(replacement.from);
    for (const match of matches) {
      if (match.index !== undefined) {
        suggestions.push({
          id: `punct-${index}-${match.index}`,
          type: 'punctuation',
          severity: 'suggestion',
          original: match[0],
          suggestion: match[0].replace(replacement.from, replacement.to),
          reason: replacement.reason,
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
          category: 'Punctuation'
        });
      }
    }
  });

  return Promise.resolve(suggestions);
}