import React from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const LoginButton: React.FC = () => {
  const { signInWithGoogle, loading, error } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleLogin}
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
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </button>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
          {error}
        </div>
      )}
      
    </div>
  );
};