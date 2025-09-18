import React from 'react';
import { FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';
const MotionDiv = motion.div as any;

export const EmptyState: React.FC = () => {
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center py-12"
    >
      <MotionDiv
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "loop",
        }}
      >
        <FileSearch className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
      </MotionDiv>

      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
        No documents processed yet
      </h3>

      <p className="text-muted-foreground/60">
        Upload a document to start OCR processing
      </p>
    </MotionDiv>
  );
};
