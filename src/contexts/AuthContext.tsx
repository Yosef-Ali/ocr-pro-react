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
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { useOCRStore } from '@/store/ocrStore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

      // Add timeout wrapper for Firebase operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your internet connection.')), 30000);
      });

      await Promise.race([
        signInWithPopup(auth, googleProvider),
        timeoutPromise
      ]);
      // User state will be updated via onAuthStateChanged listener

    } catch (err: any) {
      console.error('Error signing in with Google:', err);
      
      // Handle specific Firebase errors with user-friendly messages
      let errorMessage = 'Failed to sign in with Google';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign in was cancelled. Please try again.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message === 'Request timed out. Please check your internet connection.') {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Add timeout wrapper for Firebase operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your internet connection.')), 30000);
      });

      const cred = await Promise.race([
        signInWithEmailAndPassword(auth, email, password),
        timeoutPromise
      ]) as any;

      // Check if email is verified
      if (cred.user && !cred.user.emailVerified) {
        await signOut(auth);
        setError('Please verify your email before signing in. Check your inbox for a verification email.');
        return;
      }

    } catch (err: any) {
      console.error('Error signing in with email:', err);
      
      // Handle specific Firebase errors with user-friendly messages
      let errorMessage = 'Failed to sign in';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message === 'Request timed out. Please check your internet connection.') {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Add timeout wrapper for Firebase operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your internet connection.')), 30000);
      });

      const cred = await Promise.race([
        createUserWithEmailAndPassword(auth, email, password),
        timeoutPromise
      ]) as any;
      
      try {
        if (cred.user && name) {
          await updateProfile(cred.user, { displayName: name });
        }
        
        // Send email verification
        if (cred.user) {
          await sendEmailVerification(cred.user);
          setSuccessMessage('Account created successfully! Please check your email to verify your account before signing in.');
        }
      } catch (e) {
        console.warn('Failed to set display name or send verification email:', e);
      }
      // onAuthStateChanged will handle sync and hydration
    } catch (err: any) {
      console.error('Error signing up with email:', err);
      
      // Handle specific Firebase errors with user-friendly messages
      let errorMessage = 'Failed to sign up';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message === 'Request timed out. Please check your internet connection.') {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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

  const clearSuccessMessage = () => {
    setSuccessMessage(null);
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
    successMessage,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    signOut: handleSignOut,
    clearError,
    clearSuccessMessage,
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