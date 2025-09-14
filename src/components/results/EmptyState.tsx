import React from 'react';
import { FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';

export const EmptyState: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center py-12"
    >
      <motion.div
        animate={{ 
          y: [0, -10, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "loop",
        }}
      >
        <FileSearch className="w-16 h-16 mx-auto text-gray-300 mb-4" />
      </motion.div>
      
      <h3 className="text-lg font-semibold text-gray-600 mb-2">
        No documents processed yet
      </h3>
      
      <p className="text-gray-400">
        Upload a document to start OCR processing
      </p>
    </motion.div>
  );
};
