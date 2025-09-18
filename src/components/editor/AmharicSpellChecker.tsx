import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Wand2,
  BookOpen,
  Target,
  TrendingUp,
  Zap,
  Settings as SettingsIcon
} from 'lucide-react';
import { AmharicWritingAssistant } from './AmharicWritingAssistant';

interface Props {
  initialText?: string;
  onCorrectedText?: (text: string) => void;
  showStatistics?: boolean;
  autoCorrectMode?: boolean;
}

export const AmharicSpellChecker: React.FC<Props> = ({
  initialText = '',
  onCorrectedText,
  showStatistics = true,
  autoCorrectMode = false
}) => {
  const [text, setText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mode, setMode] = useState<'write' | 'review'>('write');
  const [settings] = useState({
    autoCorrect: autoCorrectMode,
    strictMode: false,
    showConfidence: true,
    highlightIntensity: 'medium' as 'low' | 'medium' | 'high'
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!text.trim()) return null;

    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const amharicWords = words.filter(w => /[\u1200-\u137F]/.test(w));
    const errorCount = suggestions.filter(s => s.severity === 'error').length;
    const warningCount = suggestions.filter(s => s.severity === 'warning').length;

    const qualityScore = Math.max(0, Math.min(100,
      ((words.length - errorCount - warningCount * 0.5) / Math.max(1, words.length)) * 100
    ));

    return {
      totalWords: words.length,
      amharicWords: amharicWords.length,
      errors: errorCount,
      warnings: warningCount,
      suggestions: suggestions.filter(s => s.severity === 'suggestion').length,
      qualityScore: Math.round(qualityScore),
      ocrCorruption: suggestions.filter(s => s.type === 'ocr-corruption').length
    };
  }, [text, suggestions]);

  // Handle text changes
  const handleTextChange = (newText: string) => {
    setText(newText);
    onCorrectedText?.(newText);
  };

  // Handle suggestions update
  const handleSuggestionsChange = (newSuggestions: any[]) => {
    setSuggestions(newSuggestions);
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              🇪🇹 Amharic Spell Checker & Grammar Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Professional writing assistant for Amharic documents with OCR error correction
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Mode Toggle */}
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setMode('write')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'write'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Write
              </button>
              <button
                onClick={() => setMode('review')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'review'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Review
              </button>
            </div>

            {/* Settings */}
            <button
              className="flex items-center space-x-2 px-4 py-2 border border-border rounded-lg hover:bg-accent"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Statistics Bar */}
        {showStatistics && statistics && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Words</p>
                  <p className="text-lg font-semibold text-foreground">{statistics.totalWords}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Amharic</p>
                  <p className="text-lg font-semibold text-foreground">{statistics.amharicWords}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="text-lg font-semibold text-red-600">{statistics.errors}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                  <p className="text-lg font-semibold text-yellow-600">{statistics.warnings}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">OCR Issues</p>
                  <p className="text-lg font-semibold text-orange-600">{statistics.ocrCorruption}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Quality</p>
                  <p className={`text-lg font-semibold ${getQualityColor(statistics.qualityScore)}`}>
                    {statistics.qualityScore}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Bar */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {suggestions.length} issue{suggestions.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {statistics && (
                <div className="text-sm text-blue-700">
                  Quality: <span className="font-medium">{getQualityLabel(statistics.qualityScore)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                <Wand2 className="w-4 h-4" />
                <span>Fix All High-Confidence</span>
              </button>

              <button className="flex items-center space-x-2 px-4 py-2 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm">
                <RefreshCw className="w-4 h-4" />
                <span>Recheck</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Issues State */}
      {suggestions.length === 0 && text.trim() && (
        <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-900 px-6 py-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">
              Great! No spelling or grammar issues found.
            </span>
            {statistics && (
              <span className="text-sm text-green-700">
                Quality score: {statistics.qualityScore}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <AmharicWritingAssistant
          initialText={text}
          onTextChange={handleTextChange}
          onSuggestionsChange={handleSuggestionsChange}
          mode={mode === 'write' ? 'editor' : 'reviewer'}
          autoCorrect={settings.autoCorrect}
        />
      </div>

      {/* Footer with Tips */}
      <div className="bg-card border-t border-border px-6 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-1 bg-red-500 rounded"></div>
              <span>Errors</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-1 bg-yellow-500 rounded"></div>
              <span>Warnings</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-1 bg-blue-500 rounded"></div>
              <span>Suggestions</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            💡 Tip: Click on highlighted text to see suggestions. Powered by AI for Amharic OCR correction.
          </div>
        </div>
      </div>
    </div>
  );
};