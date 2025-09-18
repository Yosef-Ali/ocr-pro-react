import React, { useState } from 'react';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName, getUserInitials } from '@/utils/auth';

export const UserProfile: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        
        {/* User Info */}
        <div className="text-left min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {user.email}
          </div>
        </div>
        
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user.email}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Signed in {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'recently'}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Actions */}
          <div className="py-1">
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <User className="w-4 h-4 mr-3" />
              Profile Settings
            </button>
            
            <button
              onClick={handleSignOut}
              disabled={loading}
              className={`
                flex items-center w-full px-4 py-2 text-sm transition-colors
                ${loading 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-red-600 hover:bg-red-50'
                }
              `}
            >
              {loading ? (
                <div className="w-4 h-4 mr-3 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-3" />
              )}
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};