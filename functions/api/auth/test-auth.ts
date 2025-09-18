import { jsonResponse, methodNotAllowed } from '../../utils/http';
import { authenticateRequest } from '../../utils/auth';

// Minimal local type shapes to avoid external type dependency  
type LocalPagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = {
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return testAuth(env, request);
    default:
      return methodNotAllowed();
  }
};

async function testAuth(env: Env, request: Request): Promise<Response> {
  // Test authentication
  const authResult = await authenticateRequest(request, env);
  
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ 
        authenticated: false, 
        error: authResult.error,
        message: 'Authentication failed'
      }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  const user = authResult.user!;
  
  return jsonResponse({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    message: 'Authentication successful',
    timestamp: new Date().toISOString()
  });
}