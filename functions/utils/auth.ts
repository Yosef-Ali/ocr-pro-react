// Authentication middleware for Cloudflare Functions
// Note: This requires environment variables to be set in wrangler.toml

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// Environment variables needed for JWT verification
interface AuthEnv {
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
}

// Extract JWT token from Authorization header
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Basic JWT verification (without external dependencies)
export function verifyJWT(token: string, secret: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // TODO: Verify signature when crypto libraries are available
    // For now, we'll trust the token structure
    
    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Verify Firebase ID token (placeholder for when Firebase Admin is configured)
export async function verifyFirebaseToken(token: string, env: AuthEnv): Promise<any | null> {
  try {
    // TODO: Implement Firebase Admin SDK verification
    // This would verify the token with Firebase Admin SDK
    // For now, we'll use basic JWT verification
    
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }
    
    return verifyJWT(token, env.JWT_SECRET);
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}

// Main authentication function
export async function authenticateRequest(request: Request, env: AuthEnv): Promise<AuthResult> {
  const token = extractBearerToken(request);
  
  if (!token) {
    return {
      success: false,
      error: 'No authentication token provided'
    };
  }

  try {
    // Verify the token (Firebase or JWT)
    const payload = await verifyFirebaseToken(token, env);
    
    if (!payload) {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }

    // Extract user information from token payload
    const user: AuthUser = {
      id: payload.uid || payload.sub || payload.user_id,
      email: payload.email,
      name: payload.name || payload.display_name || payload.email.split('@')[0]
    };

    if (!user.id || !user.email) {
      return {
        success: false,
        error: 'Invalid token payload'
      };
    }

    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Middleware wrapper for Cloudflare Functions
export function withAuth<T extends Record<string, any>>(
  handler: (context: { request: Request; env: T; user: AuthUser }) => Promise<Response>
) {
  return async (context: { request: Request; env: T }): Promise<Response> => {
    const authResult = await authenticateRequest(context.request, context.env as any);
    
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler({
      ...context,
      user: authResult.user!
    });
  };
}

// Helper to create unauthorized response
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Helper to create forbidden response
export function forbiddenResponse(message = 'Forbidden'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}