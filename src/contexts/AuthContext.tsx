import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { auth, googleProvider } from '@/config/firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { useOCRStore } from '@/store/ocrStore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentUser, hydrateFromRemote } = useOCRStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Convert Firebase user to our User type
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: firebaseUser.displayName || firebaseUser.email!,
            googleId: firebaseUser.uid,
            profilePicture: firebaseUser.photoURL || undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastLogin: Date.now(),
          };
          setUser(userData);
          setCurrentUser(userData);
          await syncUserToBackend(userData);
          // Hydrate user data after authentication
          await hydrateFromRemote();
        } catch (err) {
          console.error('Error processing user authentication:', err);
          setError('Failed to authenticate user');
        }
      } else {
        setUser(null);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await signInWithPopup(auth, googleProvider);
      // User state will be updated via onAuthStateChanged listener

    } catch (err: any) {
      console.error('Error signing in with Google:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Error signing in with email:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        if (cred.user && name) {
          await updateProfile(cred.user, { displayName: name });
        }
      } catch (e) {
        console.warn('Failed to set display name');
      }
      // onAuthStateChanged will handle sync and hydration
    } catch (err: any) {
      console.error('Error signing up with email:', err);
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Error sending password reset email:', err);
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await signOut(auth);
      // User state will be updated via onAuthStateChanged listener

    } catch (err: any) {
      console.error('Error signing out:', err);
      setError(err.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Sync user data to our backend when authenticated
  const syncUserToBackend = async (userData: User): Promise<void> => {
    try {
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to sync user data');
      }

    } catch (err) {
      console.error('Error syncing user to backend:', err);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    signOut: handleSignOut,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;