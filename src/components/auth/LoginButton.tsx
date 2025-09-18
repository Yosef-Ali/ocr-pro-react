import React, { useState } from 'react';
import { LogIn, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/config/firebase';
import { AuthModal } from './AuthModal';

export const LoginButton: React.FC = () => {
  const { loading } = useAuth();
  const firebaseConfigured = isFirebaseConfigured();
  const [open, setOpen] = useState(false);

  // All auth actions handled in AuthModal now

  if (!firebaseConfigured) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-orange-300 bg-orange-50">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-orange-700 font-medium">Firebase Not Configured</span>
        </div>
        <div className="text-sm text-gray-600 text-center max-w-md">
          To enable authentication, configure Firebase by setting the <code className="bg-gray-100 px-1 rounded">VITE_FIREBASE_CONFIG</code> environment variable.
          <br />
          See <code className="bg-gray-100 px-1 rounded">firebase-setup.md</code> for setup instructions.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all
          ${loading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" />
        )}
        <span>
          {loading ? 'Signing in...' : 'Sign in'}
        </span>
      </button>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} />

      {/* Errors are displayed inside AuthModal */}

    </div>
  );
};