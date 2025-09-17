import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FilePlus, X, FileText, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { formatFileSize } from '@/utils/format';
import { LanguageSelector } from './LanguageSelector';
import { ProcessButton } from './ProcessButton';
import toast from 'react-hot-toast';
import { validateFileUpload } from '@/utils/validationUtils';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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

  const simulateUpload = async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, prev + Math.random() * 15);
      });
    }, 200);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const existingCount = useOCRStore.getState().files.length;
      const newIds = await addFiles(incomingFiles);
      if (newIds.length > 0) {
        setCurrentFileIndex(existingCount);
        toast.success(t('success.filesUploaded', { count: newIds.length }));
      }
    } finally {
      clearInterval(interval);
      setIsUploading(false);
      setUploadProgress(0);
    }
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
          {t('upload.title')}
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
            <h3 className="text-sm font-medium text-gray-700">{t('upload.uploadedFiles')} ({files.length})</h3>
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

        {/* Options group */}
        <div className="mt-6 border rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Target Language & OCR Options</h3>
          <LanguageSelector />
          <div className="mt-4 flex items-center text-xs text-gray-500 gap-2">
            <span className="inline-flex items-center gap-1">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="inline-block align-text-bottom text-gray-400"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.21.65.21 1v.09A1.65 1.65 0 0 0 21 12c0 .35-.07.69-.21 1v.09A1.65 1.65 0 0 0 19.4 15z" /></svg>
              OCR options moved: See <span className="font-medium text-gray-700">Settings</span>
            </span>
          </div>
        </div>
        <ProcessButton />
      </motion.div>
    </div>
  );
};
