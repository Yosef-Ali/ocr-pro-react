import React from 'react';
import { Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProcessingStatus as ProcessingStatusType } from '@/types';

interface Props {
  status: ProcessingStatusType;
}

const statusMessages: Record<ProcessingStatusType, string> = {
  idle: 'Ready to process',
  preparing: 'Preparing documents...',
  uploading: 'Uploading files...',
  analyzing: 'Analyzing document layout...',
  extracting: 'Extracting text with Gemini AI...',
  formatting: 'Preserving original formatting...',
  completed: 'Processing completed!',
  error: 'An error occurred',
};

export const ProcessingStatus: React.FC<Props> = ({ status }) => {
  const progress = {
    idle: 0,
    preparing: 10,
    uploading: 25,
    analyzing: 45,
    extracting: 70,
    formatting: 90,
    completed: 100,
    error: 0,
  }[status];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center py-12"
    >
      <div className="text-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center"
        >
          <Brain className="w-8 h-8 text-blue-600" />
        </motion.div>

        <h3 className="text-lg font-semibold text-foreground">
          Processing with Gemini AI
        </h3>

        <p className="text-muted-foreground">{statusMessages[status]}</p>

        <div className="w-64 mx-auto bg-muted rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
};
