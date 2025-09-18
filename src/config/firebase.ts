import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Get Firebase config from environment variables
const getFirebaseConfig = () => {
  const configString = (import.meta as any).env?.VITE_FIREBASE_CONFIG;
  if (!configString) {
    throw new Error('VITE_FIREBASE_CONFIG environment variable is not set');
  }
  
  try {
    return JSON.parse(configString);
  } catch (error) {
    throw new Error('Invalid VITE_FIREBASE_CONFIG format. Must be valid JSON.');
  }
};

// Firebase configuration object
export const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account' // Always show account selection
});

// Helper function to get current user's ID token
export const getCurrentUserToken = async (): Promise<string | null> => {
  if (auth?.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  return null;
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!auth?.currentUser;
};