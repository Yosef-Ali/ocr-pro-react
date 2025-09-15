/**
 * Centralized notification service for consistent toast messages
 */
import toast from 'react-hot-toast';

export const notifications = {
    success: (message: string, options?: any) => toast.success(message, options),
    error: (message: string, options?: any) => toast.error(message, options),
    loading: (message: string, options?: any) => toast.loading(message, options),
    dismiss: (toastId?: string) => toast.dismiss(toastId),

    // Common notification patterns
    exportSuccess: (format: string) => toast.success(`Exported as ${format}`),
    exportError: (format: string) => toast.error(`Failed to export ${format}`),
    processingStart: (message = 'Processing...') => toast.loading(message),
    processingComplete: (message = 'Processing completed') => toast.success(message),
    processingError: (message = 'Processing failed') => toast.error(message),
};