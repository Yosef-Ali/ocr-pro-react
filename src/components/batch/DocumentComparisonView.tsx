import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  FileText,
  BarChart3,
  Star,
  Award,
  AlertTriangle
} from 'lucide-react';
import { DocumentAnalysis } from '@/services/amharicBatchProcessor';

interface Props {
  documents: DocumentAnalysis[];
  onSelectDocument?: (documentId: string) => void;
  onViewDocument?: (documentId: string) => void;
}

type SortField = 'quality' | 'corruption' | 'words' | 'name' | 'issues';
type SortDirection = 'asc' | 'desc';

export const DocumentComparisonView: React.FC<Props> = ({
  documents,
  onSelectDocument,
  onViewDocument
}) => {
  const [sortField, setSortField] = useState<SortField>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());

  // Sort documents
  const sortedDocuments = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'quality':
          aValue = a.qualityScore;
          bValue = b.qualityScore;
          break;
        case 'corruption':
          const corruptionOrder = { 'low': 3, 'medium': 2, 'high': 1 };
          aValue = corruptionOrder[a.corruptionLevel];
          bValue = corruptionOrder[b.corruptionLevel];
          break;
        case 'words':
          aValue = a.totalWords;
          bValue = b.totalWords;
          break;
        case 'name':
          aValue = a.fileName.toLowerCase();
          bValue = b.fileName.toLowerCase();
          break;
        case 'issues':
          aValue = a.issues.length;
          bValue = b.issues.length;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [documents, sortField, sortDirection]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (documents.length === 0) return null;

    const qualities = documents.map(d => d.qualityScore);
    const totalWords = documents.reduce((sum, d) => sum + d.totalWords, 0);
    const totalCorrupted = documents.reduce((sum, d) => sum + d.corruptedWords, 0);

    const bestDoc = documents.reduce((best, current) =>
      current.qualityScore > best.qualityScore ? current : best
    );

    const worstDoc = documents.reduce((worst, current) =>
      current.qualityScore < worst.qualityScore ? current : worst
    );

    const gradeDistribution = documents.reduce((acc, doc) => {
      acc[doc.grade] = (acc[doc.grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      averageQuality: qualities.reduce((sum, q) => sum + q, 0) / qualities.length,
      highestQuality: Math.max(...qualities),
      lowestQuality: Math.min(...qualities),
      totalWords,
      totalCorrupted,
      corruptionRate: totalWords > 0 ? (totalCorrupted / totalWords) * 100 : 0,
      bestDocument: bestDoc,
      worstDocument: worstDoc,
      gradeDistribution
    };
  }, [documents]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleComparisonSelection = (documentId: string) => {
    const newSelection = new Set(selectedForComparison);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else if (newSelection.size < 3) { // Limit to 3 documents for comparison
      newSelection.add(documentId);
    }
    setSelectedForComparison(newSelection);
  };

  const getQualityTrend = (quality: number, average: number) => {
    const diff = quality - average;
    if (Math.abs(diff) < 0.05) return { icon: <Minus className="w-4 h-4 text-gray-500" />, color: 'text-gray-500' };
    if (diff > 0) return { icon: <TrendingUp className="w-4 h-4 text-green-600" />, color: 'text-green-600' };
    return { icon: <TrendingDown className="w-4 h-4 text-red-600" />, color: 'text-red-600' };
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCorruptionColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return (
      <ArrowUpDown
        className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} text-blue-600`}
      />
    );
  };

  if (!stats) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents to compare</h3>
        <p className="text-gray-600">Process some documents first to see the comparison view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Quality</p>
              <p className="text-2xl font-bold text-gray-900">
                {(stats.averageQuality * 100).toFixed(1)}%
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">
              Range: {(stats.lowestQuality * 100).toFixed(1)}% - {(stats.highestQuality * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Best Document</p>
              <p className="text-lg font-bold text-gray-900 truncate max-w-32">
                {stats.bestDocument.fileName}
              </p>
            </div>
            <Award className="h-8 w-8 text-yellow-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <Star className="w-4 h-4 text-yellow-500 mr-1" />
            <span className="text-gray-600">
              {(stats.bestDocument.qualityScore * 100).toFixed(1)}% quality
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Corruption Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.corruptionRate.toFixed(1)}%
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">
              {stats.totalCorrupted} of {stats.totalWords} words
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Grade Distribution</p>
              <div className="flex space-x-1 mt-1">
                {Object.entries(stats.gradeDistribution).map(([grade, count]) => (
                  <span key={grade} className={`px-1 py-0.5 rounded text-xs font-medium ${getGradeColor(grade)}`}>
                    {grade}: {count}
                  </span>
                ))}
              </div>
            </div>
            <FileText className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Comparison Selection */}
      {selectedForComparison.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">
                Documents Selected for Comparison ({selectedForComparison.size}/3)
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {Array.from(selectedForComparison).map(id =>
                  documents.find(d => d.documentId === id)?.fileName
                ).join(', ')}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedForComparison(new Set())}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear
              </button>
              {selectedForComparison.size >= 2 && (
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  Compare Documents
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Ranking Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Document Quality Ranking ({documents.length} documents)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Document</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('quality')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Quality Score</span>
                    {getSortIcon('quality')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('corruption')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Corruption</span>
                    {getSortIcon('corruption')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('words')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Content</span>
                    {getSortIcon('words')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('issues')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Issues</span>
                    {getSortIcon('issues')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDocuments.map((doc, index) => {
                const rank = index + 1;
                const isSelected = selectedForComparison.has(doc.documentId);
                const qualityTrend = getQualityTrend(doc.qualityScore, stats.averageQuality);

                return (
                  <tr
                    key={doc.documentId}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {rank <= 3 && (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                              rank === 2 ? 'bg-gray-100 text-gray-800' :
                                'bg-orange-100 text-orange-800'
                            }`}>
                            {rank}
                          </div>
                        )}
                        {rank > 3 && (
                          <span className="text-sm text-gray-600 w-6 text-center mr-2">{rank}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleComparisonSelection(doc.documentId)}
                          disabled={!isSelected && selectedForComparison.size >= 3}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 max-w-48 truncate">
                            {doc.fileName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {doc.processingTime.toFixed(0)}ms processing time
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getGradeColor(doc.grade)}`}>
                          {doc.grade}
                        </span>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {(doc.qualityScore * 100).toFixed(1)}%
                          </div>
                          <div className={`flex items-center ${qualityTrend.color}`}>
                            {qualityTrend.icon}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-sm font-medium capitalize ${getCorruptionColor(doc.corruptionLevel)}`}>
                          {doc.corruptionLevel}
                        </span>
                        <div className="text-sm text-gray-600">
                          {doc.corruptedWords} errors
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>{doc.totalWords.toLocaleString()} words</div>
                        <div className="text-gray-500">
                          {((doc.corruptedWords / doc.totalWords) * 100).toFixed(1)}% corrupted
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-48">
                        {doc.issues.length > 0 ? (
                          <div>
                            <div className="font-medium">{doc.issues.length} issues</div>
                            <div className="truncate">
                              {doc.issues.slice(0, 2).join(', ')}
                              {doc.issues.length > 2 && ` (+${doc.issues.length - 2})`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600">No issues</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onViewDocument?.(doc.documentId)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectDocument?.(doc.documentId)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Insights */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Top Performers</h4>
            <div className="space-y-2">
              {sortedDocuments.slice(0, 3).map((doc) => (
                <div key={doc.documentId} className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium text-green-900 truncate max-w-48">
                    {doc.fileName}
                  </span>
                  <span className="text-sm text-green-700">
                    {(doc.qualityScore * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Needs Attention</h4>
            <div className="space-y-2">
              {sortedDocuments.slice(-3).reverse().map((doc) => (
                <div key={doc.documentId} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <span className="text-sm font-medium text-red-900 truncate max-w-48">
                    {doc.fileName}
                  </span>
                  <span className="text-sm text-red-700">
                    {(doc.qualityScore * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};