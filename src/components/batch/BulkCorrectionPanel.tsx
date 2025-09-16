import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  X,
  Wand2,
  AlertCircle,
  Info,
  Filter,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { CorrectionSuggestion } from '@/services/amharicBatchProcessor';

interface Props {
  corrections: CorrectionSuggestion[];
  onApplyCorrection: (correction: CorrectionSuggestion) => void;
  onApplyBulkCorrections: (corrections: CorrectionSuggestion[]) => void;
  onRejectCorrection: (correction: CorrectionSuggestion) => void;
  onPreviewDocument?: (documentId: string) => void;
}

type FilterType = 'all' | 'high' | 'medium' | 'low';
type GroupBy = 'document' | 'type' | 'confidence';

export const BulkCorrectionPanel: React.FC<Props> = ({
  corrections,
  onApplyCorrection,
  onApplyBulkCorrections,
  onRejectCorrection,
  onPreviewDocument
}) => {
  const [selectedCorrections, setSelectedCorrections] = useState<Set<string>>(new Set());
  const [confidenceFilter, setConfidenceFilter] = useState<FilterType>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('document');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter corrections based on confidence and search
  const filteredCorrections = useMemo(() => {
    return corrections.filter(correction => {
      // Confidence filter
      let passesConfidenceFilter = true;
      switch (confidenceFilter) {
        case 'high':
          passesConfidenceFilter = correction.confidence >= 0.8;
          break;
        case 'medium':
          passesConfidenceFilter = correction.confidence >= 0.6 && correction.confidence < 0.8;
          break;
        case 'low':
          passesConfidenceFilter = correction.confidence < 0.6;
          break;
      }

      // Search filter
      const passesSearchFilter = searchTerm === '' ||
        correction.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
        correction.corrected.toLowerCase().includes(searchTerm.toLowerCase()) ||
        correction.fileName.toLowerCase().includes(searchTerm.toLowerCase());

      return passesConfidenceFilter && passesSearchFilter;
    });
  }, [corrections, confidenceFilter, searchTerm]);

  // Group corrections
  const groupedCorrections = useMemo(() => {
    const groups = new Map<string, CorrectionSuggestion[]>();

    filteredCorrections.forEach(correction => {
      let groupKey: string;
      switch (groupBy) {
        case 'document':
          groupKey = correction.fileName;
          break;
        case 'type':
          groupKey = correction.reason;
          break;
        case 'confidence':
          if (correction.confidence >= 0.8) groupKey = 'High Confidence (80%+)';
          else if (correction.confidence >= 0.6) groupKey = 'Medium Confidence (60-79%)';
          else groupKey = 'Low Confidence (<60%)';
          break;
        default:
          groupKey = 'All';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(correction);
    });

    return Array.from(groups.entries()).map(([groupName, items]) => ({
      groupName,
      items,
      totalItems: items.length,
      averageConfidence: items.reduce((sum, item) => sum + item.confidence, 0) / items.length
    }));
  }, [filteredCorrections, groupBy]);

  const handleSelectCorrection = (correctionId: string) => {
    const newSelected = new Set(selectedCorrections);
    if (newSelected.has(correctionId)) {
      newSelected.delete(correctionId);
    } else {
      newSelected.add(correctionId);
    }
    setSelectedCorrections(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCorrections.size === filteredCorrections.length) {
      setSelectedCorrections(new Set());
    } else {
      setSelectedCorrections(new Set(filteredCorrections.map(c => getCorrectionId(c))));
    }
  };

  const handleApplySelected = () => {
    const correctionsToApply = filteredCorrections.filter(c =>
      selectedCorrections.has(getCorrectionId(c))
    );
    onApplyBulkCorrections(correctionsToApply);
    setSelectedCorrections(new Set());
  };

  const getCorrectionId = (correction: CorrectionSuggestion): string => {
    return `${correction.documentId}-${correction.position.start}-${correction.position.end}`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <X className="w-4 h-4 text-red-600" />;
  };

  const selectedCount = selectedCorrections.size;
  const totalCorrections = filteredCorrections.length;
  const highConfidenceSelected = filteredCorrections.filter(c =>
    selectedCorrections.has(getCorrectionId(c)) && c.confidence >= 0.8
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bulk Corrections</h2>
            <p className="text-sm text-gray-600 mt-1">
              {totalCorrections} corrections found across {new Set(corrections.map(c => c.documentId)).size} documents
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Action Bar */}
        {selectedCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-blue-600" />
                <span className="text-blue-800 font-medium">
                  {selectedCount} corrections selected ({highConfidenceSelected} high confidence)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedCorrections(new Set())}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  Clear selection
                </button>

                <button
                  onClick={handleApplySelected}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Apply Selected</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search corrections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as FilterType)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Confidence Levels</option>
            <option value="high">High Confidence (80%+)</option>
            <option value="medium">Medium Confidence (60-79%)</option>
            <option value="low">Low Confidence (&lt;60%)</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="document">Group by Document</option>
            <option value="type">Group by Error Type</option>
            <option value="confidence">Group by Confidence</option>
          </select>

          <button
            onClick={handleSelectAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            {selectedCorrections.size === totalCorrections ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Grouped Corrections */}
      <div className="space-y-4">
        {groupedCorrections.map((group, groupIndex) => (
          <div key={groupIndex} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{group.groupName}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>{group.totalItems} corrections</span>
                  <span>•</span>
                  <span>Avg: {(group.averageConfidence * 100).toFixed(1)}%</span>
                  {groupBy === 'document' && onPreviewDocument && (
                    <>
                      <span>•</span>
                      <button
                        onClick={() => onPreviewDocument(group.items[0].documentId)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Preview Document
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {group.items.map((correction, index) => {
                const correctionId = getCorrectionId(correction);
                const isSelected = selectedCorrections.has(correctionId);

                return (
                  <div key={index} className={`p-4 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectCorrection(correctionId)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          {getConfidenceIcon(correction.confidence)}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(correction.confidence)}`}>
                            {(correction.confidence * 100).toFixed(0)}% confidence
                          </span>
                          <span className="text-xs text-gray-500">{correction.reason}</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600 font-medium">Original:</span>
                            <code className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-mono">
                              "{correction.original}"
                            </code>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600 font-medium">Suggested:</span>
                            <code className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-mono">
                              "{correction.corrected}"
                            </code>
                          </div>

                          {showPreview && (
                            <div className="text-xs text-gray-500 mt-2">
                              Position: {correction.position.start}-{correction.position.end} in {correction.fileName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onApplyCorrection(correction)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Apply</span>
                        </button>

                        <button
                          onClick={() => onRejectCorrection(correction)}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 flex items-center space-x-1"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {totalCorrections === 0 && (
        <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No corrections needed!</h3>
          <p className="text-gray-600">All documents have been processed and no errors were detected.</p>
        </div>
      )}

      {/* Filtered Empty State */}
      {totalCorrections === 0 && corrections.length > 0 && (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <Filter className="w-8 h-8 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No corrections match your filters</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search terms or confidence level filters.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setConfidenceFilter('all');
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};