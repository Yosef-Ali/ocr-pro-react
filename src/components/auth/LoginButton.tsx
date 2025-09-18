import React, { useState } from 'react';
import { User as UserIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/config/firebase';
import { AuthModal } from './AuthModal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export const LoginButton: React.FC = () => {
  const { loading } = useAuth();
  const firebaseConfigured = isFirebaseConfigured();
  const [open, setOpen] = useState(false);

  // All auth actions handled in AuthModal now

  if (!firebaseConfigured) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-card text-foreground">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm">Firebase Not Configured</span>
        </div>
        <div className="text-sm text-muted-foreground text-center max-w-md">
          To enable authentication, configure Firebase by setting the <code className="bg-muted px-1 rounded">VITE_FIREBASE_CONFIG</code> environment variable.
          <br />
          See <code className="bg-muted px-1 rounded">firebase-setup.md</code> for setup instructions.
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        onClick={() => setOpen(true)}
        disabled={loading}
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label={loading ? 'Signing in' : 'Sign in'}
      >
        {loading ? (
          <Spinner size="sm" variant="muted" />
        ) : (
          <UserIcon className="w-5 h-5 text-foreground" />
        )}
        <span className="sr-only">{loading ? 'Signing in…' : 'Sign in'}</span>
      </Button>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
};