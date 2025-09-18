import React, { useState, useMemo } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Download,
  // Filter icon used elsewhere; keeping only used imports
  Search,
  BarChart3,
  PieChart,
  Wand2
} from 'lucide-react';
import { BatchProcessingResult, CorrectionSuggestion } from '@/services/amharicBatchProcessor';

interface Props {
  batchResult: BatchProcessingResult;
  corrections: CorrectionSuggestion[];
  onApplyCorrections?: (correctionsToApply: CorrectionSuggestion[]) => void;
  onExportResults?: (format: 'json' | 'csv' | 'summary') => void;
  onViewDocument?: (documentId: string) => void;
}

export const BatchProcessingDashboard: React.FC<Props> = ({
  batchResult,
  corrections,
  onApplyCorrections,
  onExportResults,
  onViewDocument
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'F'>('all');
  const [sortBy, setSortBy] = useState<'quality' | 'corruption' | 'name'>('quality');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let docs = batchResult.documents.filter(doc => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGrade = filterGrade === 'all' || doc.grade === filterGrade;
      return matchesSearch && matchesGrade;
    });

    // Sort documents
    docs.sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return b.qualityScore - a.qualityScore;
        case 'corruption':
          const corruptionOrder = { 'low': 3, 'medium': 2, 'high': 1 };
          return corruptionOrder[b.corruptionLevel] - corruptionOrder[a.corruptionLevel];
        case 'name':
          return a.fileName.localeCompare(b.fileName);
        default:
          return 0;
      }
    });

    return docs;
  }, [batchResult.documents, searchTerm, filterGrade, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = batchResult.summary.totalDocuments;
    const gradeStats = batchResult.documents.reduce((acc, doc) => {
      acc[doc.grade] = (acc[doc.grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const corruptionStats = batchResult.documents.reduce((acc, doc) => {
      acc[doc.corruptionLevel] = (acc[doc.corruptionLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { gradeStats, corruptionStats, total };
  }, [batchResult]);

  const handleSelectDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.documentId)));
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
  case 'A': return 'text-emerald-500 bg-emerald-500/10';
  case 'B': return 'text-primary bg-primary/10';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
  default: return 'text-muted-foreground bg-muted';
    }
  };

  const getCorruptionColor = (level: string) => {
    switch (level) {
  case 'low': return 'text-emerald-500 bg-emerald-500/10';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
  default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
              <p className="text-2xl font-bold">{batchResult.summary.totalDocuments}</p>
            </div>
          </div>
        </div>

  <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Quality</p>
              <p className="text-2xl font-bold text-gray-900">
                {(batchResult.summary.averageQuality * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Corrupted Words</p>
              <p className="text-2xl font-bold text-gray-900">{batchResult.summary.totalCorruptedWords}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {((batchResult.summary.successfullyProcessed / batchResult.summary.totalDocuments) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Quality Grade Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.gradeStats).map(([grade, count]) => (
              <div key={grade} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getGradeColor(grade)}`}>
                    Grade {grade}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getGradeColor(grade).replace('text-', 'bg-').replace('bg-', 'bg-').split(' ')[1]}`}
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Corruption Level Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.corruptionStats).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`px-2 py-1 rounded text-sm font-medium capitalize ${getCorruptionColor(level)}`}>
                    {level}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getCorruptionColor(level).replace('text-', 'bg-').replace('bg-', 'bg-').split(' ')[1]}`}
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Common Issues */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Most Common Issues</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {batchResult.commonIssues.slice(0, 6).map((issue, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700 flex-1">{issue.issue}</span>
              <span className="text-sm font-medium text-gray-900 bg-white px-2 py-1 rounded">
                {issue.frequency}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Grades</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
              <option value="D">Grade D</option>
              <option value="F">Grade F</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="quality">Sort by Quality</option>
              <option value="corruption">Sort by Corruption</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          <div className="flex space-x-2">
            {selectedDocuments.size > 0 && (
              <button
                onClick={() => {
                  const ids = Array.from(selectedDocuments);
                  const toApply = corrections.filter(c => ids.includes(c.documentId));
                  if (toApply.length) onApplyCorrections?.(toApply);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>Apply Corrections ({selectedDocuments.size})</span>
              </button>
            )}

            <button
              onClick={() => onExportResults?.('csv')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Documents ({filteredDocuments.length})</h3>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {selectedDocuments.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corruption
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((doc) => (
                <tr key={doc.documentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.documentId)}
                      onChange={() => handleSelectDocument(doc.documentId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="flex-shrink-0 h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
                        <div className="text-sm text-gray-500">{doc.totalWords} words</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getGradeColor(doc.grade)}`}>
                        {doc.grade}
                      </span>
                      <span className="text-sm text-gray-600">
                        {(doc.qualityScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-sm font-medium capitalize ${getCorruptionColor(doc.corruptionLevel)}`}>
                        {doc.corruptionLevel}
                      </span>
                      <span className="text-sm text-gray-600">
                        {doc.corruptedWords} errors
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-xs truncate">
                      {doc.issues.slice(0, 2).join(', ')}
                      {doc.issues.length > 2 && ` (+${doc.issues.length - 2} more)`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onViewDocument?.(doc.documentId)}
                      className="text-blue-600 hover:text-blue-700 mr-3"
                    >
                      View
                    </button>
                    {doc.corruptedWords > 0 && (
                      <button
                        onClick={() => {
                          const toApply = corrections.filter(c => c.documentId === doc.documentId);
                          if (toApply.length) onApplyCorrections?.(toApply);
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        Fix
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      {batchResult.overallRecommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {batchResult.overallRecommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start">
                <AlertTriangle className="flex-shrink-0 h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <span className="text-yellow-700">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};