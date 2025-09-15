import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FilePlus, X, FileText, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { formatFileSize } from '@/utils/format';
import { LanguageSelector } from './LanguageSelector';
import { OCROptions } from './OCROptions';
import { ProcessButton } from './ProcessButton';
import toast from 'react-hot-toast';
import { validateFileUpload } from '@/utils/validationUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/x-tiff': ['.tif', '.tiff'],
  'image/tiff': ['.tif', '.tiff'],
  'application/pdf': ['.pdf'],
};

export const UploadSection: React.FC = () => {
  const { files, addFiles, removeFile, setCurrentFileIndex } = useOCRStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Additional custom validation for accepted files
    const validFiles: File[] = [];
    const validationErrors: string[] = [];

    for (const file of acceptedFiles) {
      const validation = validateFileUpload(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => {
        const errorMessages = errors.map((e: any) => e.message).join(', ');
        return `${file.name}: ${errorMessages}`;
      });
      validationErrors.push(...errors);
    }

    if (validationErrors.length > 0) {
      toast.error(`Failed to upload: ${validationErrors.join('; ')}`);
    }

    if (validFiles.length > 0) {
      simulateUpload(validFiles);
    }
  }, []);

  const simulateUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const startIndex = files.length;
    addFiles(files);
    if (files.length > 0) setCurrentFileIndex(startIndex);
    setIsUploading(false);
    setUploadProgress(0);
    toast.success(`Uploaded ${files.length} file(s) successfully`);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-blue-600" />
          Upload Document
        </h2>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          role="button"
          tabIndex={0}
          aria-label={isDragActive ? 'Drop files here to upload' : 'Drag and drop files here, or press Enter to browse files'}
          aria-describedby="upload-instructions"
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
            }
          `}
        >
          <input {...getInputProps()} aria-hidden="true" />

          {isUploading ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                />
              </div>
              <p className="text-sm text-gray-600">Uploading... {Math.round(uploadProgress)}%</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <FilePlus className="w-8 h-8 text-blue-600" aria-hidden="true" />
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or <span className="text-blue-600 font-medium">browse files</span>
                </p>
                <p id="upload-instructions" className="text-xs text-gray-400">
                  Supports: PDF, JPG, PNG, GIF, WEBP, TIFF (Max 10MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Uploaded Files ({files.length})</h3>
            <ul role="list" aria-label="Uploaded files">
              <AnimatePresence>
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {file.type.includes('pdf') ? (
                          <FileText className="w-5 h-5 text-red-500" aria-hidden="true" />
                        ) : (
                          <Image className="w-5 h-5 text-green-500" aria-hidden="true" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        aria-label={`Remove file ${file.name}`}
                        className="text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded p-1"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </motion.div>
                  </li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}

        <LanguageSelector />
        <OCROptions />
        <ProcessButton />
      </motion.div>
    </div>
  );
};