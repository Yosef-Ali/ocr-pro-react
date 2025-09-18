import React from 'react';
import { X, Upload, Globe, Settings2, Brain, Eye } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const HelpModal: React.FC = () => {
  const { toggleHelp } = useOCRStore();

  const steps = [
    {
      icon: Upload,
      title: 'Upload Documents',
      description: 'Drag and drop images or PDF files, or click to browse. Supports JPG, PNG, PDF up to 10MB.',
    },
    {
      icon: Globe,
      title: 'Select Language',
      description: 'Choose the target language or use auto-detection. The AI will identify the document language automatically.',
    },
    {
      icon: Settings2,
      title: 'Configure Options',
      description: 'Enable layout preservation, table detection, and image enhancement for better accuracy.',
    },
    {
      icon: Brain,
      title: 'Process with AI',
      description: 'Click "Start OCR Processing" to analyze your document with Gemini AI for high accuracy.',
    },
    {
      icon: Eye,
      title: 'View Results',
      description: 'Review extracted text, layout-preserved version, and detailed analysis including confidence scores.',
    },
  ];

  return (
    <Dialog open={true} onOpenChange={() => toggleHelp()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>How to Use OCR Pro</DialogTitle>
          <Button variant="ghost" onClick={toggleHelp} aria-label="Close"><X className="w-5 h-5" /></Button>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {index + 1}. {title}
                  </h4>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-primary/10 rounded-lg">
            <h4 className="font-semibold text-primary mb-2">Pro Tips</h4>
            <ul className="text-sm text-foreground space-y-1">
              <li>• For best results, use high-quality images with good lighting</li>
              <li>• Enable image enhancement for low-quality scans</li>
              <li>• Use batch processing for multiple documents</li>
              <li>• Export results in various formats (TXT, JSON, PDF)</li>
            </ul>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
