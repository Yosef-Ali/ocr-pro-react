import type { User } from '@/types';

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Token management
export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store authentication token:', error);
  }
};

export const removeStoredToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Failed to remove authentication token:', error);
  }
};

// User data management
export const getStoredUser = (): User | null => {
  try {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User): void => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to store user data:', error);
  }
};

// Auth headers for API requests
export const getAuthHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token 
    ? { 'Authorization': `Bearer ${token}` }
    : {};
};

// Check if token is expired (basic JWT check)
export const isTokenExpired = (token: string): boolean => {
  try {
    // Basic JWT expiration check
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000;
    return payload.exp < now;
  } catch {
    return true;
  }
};

// Validate stored token
export const isValidStoredToken = (): boolean => {
  const token = getStoredToken();
  return token !== null && !isTokenExpired(token);
};

// Clear all authentication data
export const clearAuthData = (): void => {
  removeStoredToken();
};

// Format user display name
export const getUserDisplayName = (user: User): string => {
  return user.name || user.email.split('@')[0];
};

// Get user initials for avatar
export const getUserInitials = (user: User): string => {
  const name = getUserDisplayName(user);
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};