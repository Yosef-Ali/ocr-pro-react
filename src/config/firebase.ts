import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Get Firebase config from environment variables
const getFirebaseConfig = () => {
  const configString = (import.meta as any).env?.VITE_FIREBASE_CONFIG;
  if (!configString) {
    console.warn('VITE_FIREBASE_CONFIG environment variable is not set. Using demo config.');
    // Return demo/placeholder config for development
    return {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "demo-app-id"
    };
  }
  
  try {
    return JSON.parse(configString);
  } catch (error) {
    console.error('Invalid VITE_FIREBASE_CONFIG format. Using demo config.');
    return {
      apiKey: "demo-api-key", 
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "demo-app-id"
    };
  }
};

// Firebase configuration object
export const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Configure auth settings
auth.settings.appVerificationDisabledForTesting = false;

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account' // Always show account selection
});

// Add additional Google provider scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Helper function to get current user's ID token
export const getCurrentUserToken = async (): Promise<string | null> => {
  try {
    if (auth?.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (error) {
    console.error('Error getting user token:', error);
  }
  return null;
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  try {
    return !!auth?.currentUser;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Helper function to check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return firebaseConfig.apiKey !== 'demo-api-key';
};