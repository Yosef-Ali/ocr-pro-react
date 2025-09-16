/**
 * Export service for batch-processed Amharic documents
 * Handles multiple export formats and bulk operations
 */
import { OCRResult } from '@/types';
import { DocumentAnalysis, BatchProcessingResult, CorrectionSuggestion } from './amharicBatchProcessor';

export interface ExportOptions {
  includeOriginal: boolean;
  includeCorrected: boolean;
  includeMetadata: boolean;
  includeAnalysis: boolean;
  format: 'txt' | 'docx' | 'pdf' | 'json' | 'csv' | 'xlsx' | 'html';
  groupBy?: 'document' | 'quality' | 'none';
  filterByQuality?: 'all' | 'good' | 'poor';
  fileName?: string;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  documentsIncluded: number;
  format: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Main export function for batch results
 */
export async function exportBatchResults(
  batchResult: BatchProcessingResult,
  ocrResults: OCRResult[],
  correctedTexts: { [documentId: string]: string },
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const filteredDocuments = filterDocumentsByQuality(batchResult.documents, options.filterByQuality);
    const content = await generateExportContent(
      filteredDocuments,
      ocrResults,
      correctedTexts,
      batchResult,
      options
    );

    const fileName = options.fileName || generateFileName(options.format, filteredDocuments.length);
    const blob = await createFileBlob(content, options.format);
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      fileName,
      fileSize: blob.size,
      documentsIncluded: filteredDocuments.length,
      format: options.format,
      downloadUrl
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      fileSize: 0,
      documentsIncluded: 0,
      format: options.format,
      error: error instanceof Error ? error.message : 'Unknown export error'
    };
  }
}

/**
 * Export corrections in various formats
 */
export async function exportCorrections(
  corrections: CorrectionSuggestion[],
  format: 'json' | 'csv' | 'xlsx',
  fileName?: string
): Promise<ExportResult> {
  try {
    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(corrections, null, 2);
        break;
      case 'csv':
        content = generateCorrectionsCSV(corrections);
        break;
      case 'xlsx':
        // For now, use CSV format - could be enhanced with a proper XLSX library
        content = generateCorrectionsCSV(corrections);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const finalFileName = fileName || `amharic-corrections-${new Date().toISOString().split('T')[0]}.${format}`;
    const blob = await createFileBlob(content, format);
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      fileName: finalFileName,
      fileSize: blob.size,
      documentsIncluded: corrections.length,
      format,
      downloadUrl
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      fileSize: 0,
      documentsIncluded: 0,
      format,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

/**
 * Export quality report
 */
export async function exportQualityReport(
  batchResult: BatchProcessingResult,
  format: 'pdf' | 'docx' | 'html',
  detailed: boolean = false
): Promise<ExportResult> {
  try {
    const content = generateQualityReport(batchResult, detailed);
    const fileName = `amharic-quality-report-${new Date().toISOString().split('T')[0]}.${format}`;

    let blob: Blob;
    switch (format) {
      case 'html':
        blob = new Blob([content], { type: 'text/html' });
        break;
      case 'pdf':
        // For now, generate HTML and let browser handle PDF conversion
        blob = new Blob([content], { type: 'text/html' });
        break;
      case 'docx':
        // For now, generate HTML - could be enhanced with proper DOCX generation
        blob = new Blob([content], { type: 'text/html' });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      fileName,
      fileSize: blob.size,
      documentsIncluded: batchResult.documents.length,
      format,
      downloadUrl
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      fileSize: 0,
      documentsIncluded: 0,
      format,
      error: error instanceof Error ? error.message : 'Report generation failed'
    };
  }
}

/**
 * Generate export content based on options
 */
async function generateExportContent(
  documents: DocumentAnalysis[],
  ocrResults: OCRResult[],
  correctedTexts: { [documentId: string]: string },
  batchResult: BatchProcessingResult,
  options: ExportOptions
): Promise<string> {
  const resultMap = new Map(ocrResults.map(r => [r.id, r]));

  switch (options.format) {
    case 'txt':
      return generateTextExport(documents, resultMap, correctedTexts, options);
    case 'json':
      return generateJSONExport(documents, resultMap, correctedTexts, batchResult, options);
    case 'csv':
      return generateCSVExport(documents, resultMap, correctedTexts, options);
    case 'html':
      return generateHTMLExport(documents, resultMap, correctedTexts, batchResult, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Generate plain text export
 */
function generateTextExport(
  documents: DocumentAnalysis[],
  resultMap: Map<string, OCRResult>,
  correctedTexts: { [documentId: string]: string },
  options: ExportOptions
): string {
  const sections: string[] = [];

  if (options.groupBy === 'quality') {
    documents.sort((a, b) => b.qualityScore - a.qualityScore);
  } else if (options.groupBy === 'document') {
    documents.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  documents.forEach((doc, index) => {
    const result = resultMap.get(doc.documentId);
    if (!result) return;

    sections.push(`\n${'='.repeat(60)}`);
    sections.push(`DOCUMENT ${index + 1}: ${doc.fileName}`);
    sections.push(`${'='.repeat(60)}\n`);

    if (options.includeMetadata) {
      sections.push(`Quality Score: ${(doc.qualityScore * 100).toFixed(1)}%`);
      sections.push(`Grade: ${doc.grade}`);
      sections.push(`Corruption Level: ${doc.corruptionLevel}`);
      sections.push(`Total Words: ${doc.totalWords}`);
      sections.push(`Corrupted Words: ${doc.corruptedWords}`);
      sections.push(`Processing Time: ${doc.processingTime.toFixed(0)}ms`);

      if (doc.issues.length > 0) {
        sections.push(`\nIssues Found:`);
        doc.issues.forEach(issue => sections.push(`  • ${issue}`));
      }

      if (doc.suggestions.length > 0) {
        sections.push(`\nRecommendations:`);
        doc.suggestions.forEach(suggestion => sections.push(`  • ${suggestion}`));
      }

      sections.push('\n' + '-'.repeat(40) + '\n');
    }

    if (options.includeOriginal) {
      sections.push('ORIGINAL TEXT:');
      sections.push(result.extractedText);
      sections.push('');
    }

    if (options.includeCorrected && correctedTexts[doc.documentId]) {
      sections.push('CORRECTED TEXT:');
      sections.push(correctedTexts[doc.documentId]);
      sections.push('');
    }
  });

  return sections.join('\n');
}

/**
 * Generate JSON export
 */
function generateJSONExport(
  documents: DocumentAnalysis[],
  resultMap: Map<string, OCRResult>,
  correctedTexts: { [documentId: string]: string },
  batchResult: BatchProcessingResult,
  options: ExportOptions
): string {
  const exportData: any = {
    exportInfo: {
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      exportOptions: options
    }
  };

  if (options.includeAnalysis) {
    exportData.batchSummary = batchResult.summary;
    exportData.commonIssues = batchResult.commonIssues;
    exportData.recommendations = batchResult.overallRecommendations;
  }

  exportData.documents = documents.map(doc => {
    const result = resultMap.get(doc.documentId);
    const docData: any = {
      fileName: doc.fileName,
      documentId: doc.documentId
    };

    if (options.includeMetadata) {
      docData.analysis = {
        qualityScore: doc.qualityScore,
        grade: doc.grade,
        corruptionLevel: doc.corruptionLevel,
        totalWords: doc.totalWords,
        corruptedWords: doc.corruptedWords,
        processingTime: doc.processingTime,
        issues: doc.issues,
        suggestions: doc.suggestions
      };
    }

    if (options.includeOriginal && result) {
      docData.originalText = result.extractedText;
    }

    if (options.includeCorrected && correctedTexts[doc.documentId]) {
      docData.correctedText = correctedTexts[doc.documentId];
    }

    return docData;
  });

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate CSV export
 */
function generateCSVExport(
  documents: DocumentAnalysis[],
  resultMap: Map<string, OCRResult>,
  correctedTexts: { [documentId: string]: string },
  options: ExportOptions
): string {
  const headers: string[] = ['File Name', 'Document ID'];

  if (options.includeMetadata) {
    headers.push(
      'Quality Score (%)',
      'Grade',
      'Corruption Level',
      'Total Words',
      'Corrupted Words',
      'Processing Time (ms)',
      'Issues Count',
      'Top Issues'
    );
  }

  if (options.includeOriginal) {
    headers.push('Original Text');
  }

  if (options.includeCorrected) {
    headers.push('Corrected Text');
  }

  const rows = documents.map(doc => {
    const result = resultMap.get(doc.documentId);
    const row: string[] = [
      `"${doc.fileName}"`,
      `"${doc.documentId}"`
    ];

    if (options.includeMetadata) {
      row.push(
        (doc.qualityScore * 100).toFixed(1),
        doc.grade,
        doc.corruptionLevel,
        doc.totalWords.toString(),
        doc.corruptedWords.toString(),
        doc.processingTime.toFixed(0),
        doc.issues.length.toString(),
        `"${doc.issues.slice(0, 3).join('; ')}"`
      );
    }

    if (options.includeOriginal && result) {
      row.push(`"${result.extractedText.replace(/"/g, '""')}"`);
    }

    if (options.includeCorrected && correctedTexts[doc.documentId]) {
      row.push(`"${correctedTexts[doc.documentId].replace(/"/g, '""')}"`);
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate HTML export
 */
function generateHTMLExport(
  documents: DocumentAnalysis[],
  resultMap: Map<string, OCRResult>,
  correctedTexts: { [documentId: string]: string },
  batchResult: BatchProcessingResult,
  options: ExportOptions
): string {
  const timestamp = new Date().toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amharic OCR Batch Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .document { border: 1px solid #ddd; margin-bottom: 30px; border-radius: 8px; overflow: hidden; }
        .document-header { background: #333; color: white; padding: 15px; }
        .document-content { padding: 20px; }
        .metadata { background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        .text-section { margin-bottom: 20px; }
        .text-section h4 { margin-bottom: 10px; color: #333; }
        .text-content { background: white; border: 1px solid #e0e0e0; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; }
        .grade-A { color: #28a745; }
        .grade-B { color: #007bff; }
        .grade-C { color: #ffc107; }
        .grade-D { color: #fd7e14; }
        .grade-F { color: #dc3545; }
        .issues { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .suggestions { background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Amharic OCR Batch Processing Results</h1>
        <p>Generated on ${timestamp}</p>
        <p>${documents.length} documents processed</p>
    </div>

    ${options.includeAnalysis ? `
    <div class="summary">
        <h2>Batch Summary</h2>
        <p><strong>Average Quality:</strong> ${(batchResult.summary.averageQuality * 100).toFixed(1)}%</p>
        <p><strong>Total Corrupted Words:</strong> ${batchResult.summary.totalCorruptedWords}</p>
        <p><strong>Processing Time:</strong> ${batchResult.summary.processingTime.toFixed(0)}ms</p>
        
        ${batchResult.commonIssues.length > 0 ? `
        <h3>Common Issues</h3>
        <ul>
            ${batchResult.commonIssues.slice(0, 5).map(issue =>
    `<li>${issue.issue} (${issue.frequency} occurrences)</li>`
  ).join('')}
        </ul>
        ` : ''}
        
        ${batchResult.overallRecommendations.length > 0 ? `
        <h3>Recommendations</h3>
        <ul>
            ${batchResult.overallRecommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
        ` : ''}
    </div>
    ` : ''}

    ${documents.map((doc, index) => {
    const result = resultMap.get(doc.documentId);
    return `
      <div class="document">
          <div class="document-header">
              <h2>Document ${index + 1}: ${doc.fileName}</h2>
          </div>
          <div class="document-content">
              ${options.includeMetadata ? `
              <div class="metadata">
                  <h3>Analysis Results</h3>
                  <p><strong>Quality Score:</strong> <span class="grade-${doc.grade}">${(doc.qualityScore * 100).toFixed(1)}% (Grade ${doc.grade})</span></p>
                  <p><strong>Corruption Level:</strong> ${doc.corruptionLevel}</p>
                  <p><strong>Content:</strong> ${doc.totalWords} words (${doc.corruptedWords} corrupted)</p>
                  <p><strong>Processing Time:</strong> ${doc.processingTime.toFixed(0)}ms</p>
                  
                  ${doc.issues.length > 0 ? `
                  <div class="issues">
                      <h4>Issues Found:</h4>
                      <ul>
                          ${doc.issues.map(issue => `<li>${issue}</li>`).join('')}
                      </ul>
                  </div>
                  ` : ''}
                  
                  ${doc.suggestions.length > 0 ? `
                  <div class="suggestions">
                      <h4>Recommendations:</h4>
                      <ul>
                          ${doc.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                      </ul>
                  </div>
                  ` : ''}
              </div>
              ` : ''}
              
              ${options.includeOriginal && result ? `
              <div class="text-section">
                  <h4>Original OCR Text</h4>
                  <div class="text-content">${result.extractedText}</div>
              </div>
              ` : ''}
              
              ${options.includeCorrected && correctedTexts[doc.documentId] ? `
              <div class="text-section">
                  <h4>Corrected Text</h4>
                  <div class="text-content">${correctedTexts[doc.documentId]}</div>
              </div>
              ` : ''}
          </div>
      </div>
      `;
  }).join('')}
</body>
</html>
  `.trim();
}

/**
 * Generate corrections CSV
 */
function generateCorrectionsCSV(corrections: CorrectionSuggestion[]): string {
  const headers = [
    'Document',
    'Original Text',
    'Suggested Correction',
    'Confidence (%)',
    'Reason',
    'Position Start',
    'Position End'
  ];

  const rows = corrections.map(correction => [
    `"${correction.fileName}"`,
    `"${correction.original.replace(/"/g, '""')}"`,
    `"${correction.corrected.replace(/"/g, '""')}"`,
    (correction.confidence * 100).toFixed(1),
    `"${correction.reason}"`,
    correction.position.start.toString(),
    correction.position.end.toString()
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate quality report HTML
 */
function generateQualityReport(batchResult: BatchProcessingResult, detailed: boolean): string {
  const timestamp = new Date().toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amharic OCR Quality Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff; }
        .grade-dist { display: flex; gap: 10px; margin: 20px 0; }
        .grade-item { padding: 10px; border-radius: 4px; text-align: center; min-width: 60px; }
        .grade-A { background: #d4edda; color: #155724; }
        .grade-B { background: #cce5ff; color: #004085; }
        .grade-C { background: #fff3cd; color: #856404; }
        .grade-D { background: #ffeaa7; color: #856404; }
        .grade-F { background: #f8d7da; color: #721c24; }
        .issues-list { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .recommendations { background: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Amharic OCR Quality Assessment Report</h1>
        <p>Generated on ${timestamp}</p>
    </div>

    <div class="metric">
        <h2>Overall Statistics</h2>
        <p><strong>Documents Processed:</strong> ${batchResult.summary.totalDocuments}</p>
        <p><strong>Successfully Processed:</strong> ${batchResult.summary.successfullyProcessed}</p>
        <p><strong>Average Quality Score:</strong> ${(batchResult.summary.averageQuality * 100).toFixed(1)}%</p>
        <p><strong>Total Words Processed:</strong> ${batchResult.documents.reduce((sum, doc) => sum + doc.totalWords, 0).toLocaleString()}</p>
        <p><strong>Total Corrupted Words:</strong> ${batchResult.summary.totalCorruptedWords}</p>
        <p><strong>Overall Corruption Rate:</strong> ${((batchResult.summary.totalCorruptedWords / batchResult.documents.reduce((sum, doc) => sum + doc.totalWords, 0)) * 100).toFixed(2)}%</p>
        <p><strong>Total Processing Time:</strong> ${batchResult.summary.processingTime.toFixed(0)}ms</p>
    </div>

    <div class="metric">
        <h2>Quality Grade Distribution</h2>
        <div class="grade-dist">
            ${Object.entries(batchResult.documents.reduce((acc, doc) => {
    acc[doc.grade] = (acc[doc.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)).map(([grade, count]) =>
    `<div class="grade-item grade-${grade}"><strong>${grade}</strong><br>${count} docs</div>`
  ).join('')}
        </div>
    </div>

    ${batchResult.commonIssues.length > 0 ? `
    <div class="issues-list">
        <h2>Most Common Issues</h2>
        <ol>
            ${batchResult.commonIssues.slice(0, 10).map(issue =>
    `<li>${issue.issue} <strong>(${issue.frequency} occurrences)</strong></li>`
  ).join('')}
        </ol>
    </div>
    ` : ''}

    ${batchResult.overallRecommendations.length > 0 ? `
    <div class="recommendations">
        <h2>Recommendations for Improvement</h2>
        <ul>
            ${batchResult.overallRecommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${detailed ? `
    <h2>Detailed Document Analysis</h2>
    <table>
        <thead>
            <tr>
                <th>Document</th>
                <th>Quality Score</th>
                <th>Grade</th>
                <th>Corruption Level</th>
                <th>Words</th>
                <th>Errors</th>
                <th>Top Issues</th>
            </tr>
        </thead>
        <tbody>
            ${batchResult.documents.map(doc => `
            <tr>
                <td>${doc.fileName}</td>
                <td>${(doc.qualityScore * 100).toFixed(1)}%</td>
                <td class="grade-${doc.grade}">${doc.grade}</td>
                <td>${doc.corruptionLevel}</td>
                <td>${doc.totalWords}</td>
                <td>${doc.corruptedWords}</td>
                <td>${doc.issues.slice(0, 2).join(', ')}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    ` : ''}
</body>
</html>
  `.trim();
}

/**
 * Helper functions
 */
function filterDocumentsByQuality(
  documents: DocumentAnalysis[],
  filter?: 'all' | 'good' | 'poor'
): DocumentAnalysis[] {
  if (!filter || filter === 'all') return documents;

  if (filter === 'good') {
    return documents.filter(doc => doc.qualityScore >= 0.7);
  }

  if (filter === 'poor') {
    return documents.filter(doc => doc.qualityScore < 0.7);
  }

  return documents;
}

function generateFileName(format: string, documentCount: number): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `amharic-batch-${documentCount}docs-${timestamp}.${format}`;
}

async function createFileBlob(content: string, format: string): Promise<Blob> {
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf'
  };

  const mimeType = mimeTypes[format] || 'text/plain';
  return new Blob([content], { type: mimeType });
}