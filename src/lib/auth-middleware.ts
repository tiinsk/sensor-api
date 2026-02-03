/**
 * Authentication middleware for Lambda handlers
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { verifyToken, isUserToken, isApiKeyToken, TokenPayload } from './jwt';
import { getUser } from '../data/users';
import { getApiKey } from '../data/auth';

export interface AuthContext {
  isAuthenticated: boolean;
  username?: string;
  apiKey?: string;
  deviceId?: string;
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(event: APIGatewayProxyEventV2): string | null {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Validate a token payload against the database
 */
async function validateTokenPayload(payload: TokenPayload): Promise<boolean> {
  try {
    if (isUserToken(payload)) {
      // Validate user token
      const user = await getUser(payload.username);
      return user !== null && !user.disabled;
    } else if (isApiKeyToken(payload)) {
      // Validate API key token
      const apiKey = await getApiKey(payload.apiKey);
      return apiKey !== null;
    }
    return false;
  } catch (error) {
    console.error('Error validating token payload:', error);
    return false;
  }
}

/**
 * Authenticate a request
 * Returns authentication context with user/api key information
 */
export async function authenticate(
  event: APIGatewayProxyEventV2
): Promise<AuthContext> {
  const token = extractToken(event);

  if (!token) {
    return { isAuthenticated: false };
  }

  // Verify JWT signature and expiration
  const payload = verifyToken(token);
  if (!payload) {
    return { isAuthenticated: false };
  }

  // Validate against database
  const isValid = await validateTokenPayload(payload);
  if (!isValid) {
    return { isAuthenticated: false };
  }

  // Build auth context
  if (isUserToken(payload)) {
    return {
      isAuthenticated: true,
      username: payload.username,
    };
  } else if (isApiKeyToken(payload)) {
    return {
      isAuthenticated: true,
      apiKey: payload.apiKey,
      deviceId: payload.deviceId,
    };
  }

  return { isAuthenticated: false };
}

/**
 * Require authentication for a handler
 * Returns 401 if not authenticated
 */
export async function requireAuth(
  event: APIGatewayProxyEventV2
): Promise<{ statusCode: 401; body: string } | AuthContext> {
  const authContext = await authenticate(event);

  if (!authContext.isAuthenticated) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  return authContext;
}
