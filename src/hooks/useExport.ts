import { useCallback } from 'react';
import { OCRResult, ExportOptions } from '@/types';
import { downloadBlob } from '@/utils/validationUtils';
import { notifications } from '@/utils/notifications';
// Heavy libs are dynamically imported where used to keep initial bundle small

export const useExport = () => {
  const exportResult = useCallback(async (result: OCRResult, options: ExportOptions) => {
    try {
      let content = '';
      let filename = `ocr-result-${Date.now()}`;
      let mimeType = 'text/plain';

      switch (options.format) {
        case 'txt':
          content = result.extractedText;
          if (options.includeMetadata) {
            content = `Language: ${result.detectedLanguage}\n` +
              `Confidence: ${(result.confidence * 100).toFixed(1)}%\n` +
              `Document Type: ${result.documentType}\n\n${ 
              content}`;
          }
          filename += '.txt';
          break;

        case 'json': {
          const jsonData: any = {
            text: result.extractedText,
            language: result.detectedLanguage,
            confidence: result.confidence,
            documentType: result.documentType,
          };

          if (options.includeAnalysis) {
            jsonData.analysis = result.layoutAnalysis;
          }

          if (options.includeMetadata) {
            jsonData.metadata = result.metadata;
          }

          content = JSON.stringify(jsonData, null, 2);
          filename += '.json';
          mimeType = 'application/json';
          break;
        }

        case 'csv': {
          const header = ['language', 'confidence', 'documentType', 'wordCount', 'characterCount'];
          const row = [
            JSON.stringify(result.detectedLanguage || ''),
            (result.confidence ?? 0).toString(),
            JSON.stringify(result.documentType || ''),
            (result.metadata?.wordCount ?? '').toString(),
            (result.metadata?.characterCount ?? '').toString(),
          ];
          content = `${header.join(',')}
${row.join(',')}
`;
          filename += '.csv';
          mimeType = 'text/csv';
          break;
        }

        case 'docx': {
          try {
            const { Document, Packer, Paragraph, TextRun } = await import('docx');
            const doc = new Document({
              sections: [
                {
                  properties: {},
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'OCR Result', bold: true, size: 24 })] }),
                    ...(options.includeMetadata
                      ? [new Paragraph(`Language: ${result.detectedLanguage}  |  Confidence: ${(result.confidence * 100).toFixed(1)}%  |  Type: ${result.documentType}`)]
                      : []),
                    ...result.extractedText.split('\n').map(line => new Paragraph(line)),
                  ],
                },
              ],
            });

            const blob = await Packer.toBlob(doc);
            const { saveAs } = await import('file-saver');
            saveAs(blob, `ocr-result-${Date.now()}.docx`);
            notifications.exportSuccess('DOCX');
          } catch (err) {
            console.error('DOCX export error:', err);
            notifications.exportError('DOCX');
          }
          return;
        }

        case 'pdf':
          try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            doc.setFont('helvetica', 'normal');
            const { needsEthiopicFont, ensureEthiopicFont } = await import('@/utils/pdfFonts');
            let y = 40;
            const left = 40;
            if (needsEthiopicFont(result.extractedText)) { await ensureEthiopicFont(doc); }
            doc.setFont(needsEthiopicFont(result.extractedText) ? 'NotoSansEthiopic' : 'helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('OCR Result', left, y); y += 18;
            doc.setFont(needsEthiopicFont(result.extractedText) ? 'NotoSansEthiopic' : 'helvetica', 'normal');
            doc.setFontSize(10);
            if (options.includeMetadata) {
              const meta = [
                `Language: ${result.detectedLanguage}`,
                `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
                `Document Type: ${result.documentType}`,
              ].join('  |  ');
              doc.text(meta, left, y); y += 18;
            }
            const text = options.preserveFormatting ? result.extractedText : result.extractedText.replace(/\s+/g, ' ');
            const lines = doc.splitTextToSize(text, 515);
            doc.text(lines, left, y);
            doc.save(`ocr-result-${Date.now()}.pdf`);
            notifications.exportSuccess('PDF');
          } catch (err) {
            console.error('PDF export error:', err);
            notifications.exportError('PDF');
          }
          return;

        default:
          notifications.error('Export format not yet supported');
          return;
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      downloadBlob(blob, filename);

      notifications.exportSuccess(filename);
    } catch (error) {
      console.error('Export error:', error);
      notifications.error('Failed to export results');
    }
  }, []);

  const exportMany = useCallback(async (results: OCRResult[], options: ExportOptions) => {
    try {
      if (options.format === 'csv') {
        const header = ['language', 'confidence', 'documentType', 'wordCount', 'characterCount'];
        const lines = [header.join(',')];
        for (const r of results) {
          lines.push([
            JSON.stringify(r.detectedLanguage || ''),
            (r.confidence ?? 0).toString(),
            JSON.stringify(r.documentType || ''),
            (r.metadata?.wordCount ?? '').toString(),
            (r.metadata?.characterCount ?? '').toString(),
          ].join(','));
        }
        const blob = new Blob([`${lines.join('\n')  }\n`], { type: 'text/csv' });
        downloadBlob(blob, `ocr-results-${Date.now()}.csv`);
        notifications.success('Exported CSV');
        return;
      }

      if (options.format === 'txt') {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        results.forEach((r, i) => {
          const name = `ocr-${i + 1}-${r.documentType || 'document'}.txt`;
          const content = r.extractedText;
          zip.file(name, content);
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const { saveAs } = await import('file-saver');
        saveAs(blob, `ocr-results-${Date.now()}.zip`);
        notifications.success('TXT files exported as ZIP');
        return;
      }

      if (options.format === 'pdf') {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const { default: jsPDF } = await import('jspdf');
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const doc = new jsPDF({ unit: 'pt', format: 'a4' });
          doc.setFont('helvetica', 'normal');
          const { needsEthiopicFont, ensureEthiopicFont } = await import('@/utils/pdfFonts');
          const useE = needsEthiopicFont(r.extractedText);
          if (useE) await ensureEthiopicFont(doc);
          let y = 40; const left = 40;
          doc.setFont(useE ? 'NotoSansEthiopic' : 'helvetica', 'bold'); doc.setFontSize(12); doc.text('OCR Result', left, y); y += 18;
          doc.setFont(useE ? 'NotoSansEthiopic' : 'helvetica', 'normal'); doc.setFontSize(10);
          const meta = `Language: ${r.detectedLanguage}  |  Confidence: ${(r.confidence * 100).toFixed(1)}%  |  Type: ${r.documentType}`;
          doc.text(meta, left, y); y += 18;
          const lines = doc.splitTextToSize(r.extractedText, 515);
          doc.text(lines, left, y);
          const pdf = doc.output('arraybuffer');
          const name = `ocr-${i + 1}-${r.documentType || 'document'}.pdf`;
          zip.file(name, pdf);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const { saveAs } = await import('file-saver');
        saveAs(blob, `ocr-results-${Date.now()}.zip`);
        notifications.success('PDF files exported as ZIP');
        return;
      }

      if (options.format === 'docx') {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const { Document, Packer, Paragraph, TextRun } = await import('docx');
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const doc = new Document({
            sections: [
              {
                properties: {},
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'OCR Result', bold: true, size: 24 })] }),
                  new Paragraph(`Language: ${r.detectedLanguage}  |  Confidence: ${(r.confidence * 100).toFixed(1)}%  |  Type: ${r.documentType}`),
                  ...r.extractedText.split('\n').map(line => new Paragraph(line)),
                ],
              },
            ],
          });
          const blob = await Packer.toBlob(doc);
          const name = `ocr-${i + 1}-${r.documentType || 'document'}.docx`;
          zip.file(name, blob);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const { saveAs } = await import('file-saver');
        saveAs(blob, `ocr-results-${Date.now()}.zip`);
        notifications.success('DOCX files exported as ZIP');
        return;
      }

      notifications.error('Bulk export format not supported');
    } catch (err) {
      console.error('Bulk export error:', err);
      notifications.error('Failed to bulk export results');
    }
  }, []);

  return { exportResult, exportMany };
};
