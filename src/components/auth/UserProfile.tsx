import React, { useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
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
        className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center"
        aria-haspopup="menu"
        aria-expanded={isDropdownOpen}
      >
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium">{initials}</span>
        )}
        <span className="sr-only">Open user menu</span>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50">
          <div className="px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="font-medium">{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Signed in {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'recently'}
                </div>
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <UserIcon className="w-4 h-4 mr-3" />
              Profile Settings
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className={`flex items-center w-full px-4 py-2 text-sm ${loading ? 'text-muted-foreground cursor-not-allowed' : 'text-destructive hover:bg-destructive/10'}`}
            >
              {loading ? (
                <span className="w-4 h-4 mr-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-3" />
              )}
              {loading ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {isDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
      )}
    </div>
  );
};