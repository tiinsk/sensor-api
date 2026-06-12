/**
 * Authentication middleware for lambda-api
 */

import { Request, Response, NextFunction } from 'lambda-api';
import { verifyToken, isUserToken, isApiKeyToken, TokenPayload } from './jwt';
import { getUser } from '../data/users';
import { getApiKey } from '../data/auth';

export interface AuthContext {
  isAuthenticated: boolean;
  username?: string;
  apiKey?: string;
  deviceId?: string;
}

export interface UserAuthContext {
  isAuthenticated: true;
  username: string;
}

type AuthenticatedRequest = Request & { authContext: AuthContext };

type UserAuthenticatedRequest = Request & { authContext: UserAuthContext };

export const getUserAuth = (req: Request): UserAuthContext =>
  (req as UserAuthenticatedRequest).authContext;

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;

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
export async function authenticate(req: Request): Promise<AuthContext> {
  const token = extractToken(req);

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
 * Middleware to require authentication
 * Use this as middleware in lambda-api routes
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authContext = await authenticate(req);

  if (!authContext.isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Attach auth context to request for use in handlers
  (req as AuthenticatedRequest).authContext = authContext;
  next();
}

/**
 * Middleware to require a user JWT (not an API key token)
 */
export async function requireUserAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authContext = await authenticate(req);

  if (!authContext.isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!authContext.username) {
    return res.status(403).json({ error: 'User token required' });
  }

  (req as UserAuthenticatedRequest).authContext = {
    isAuthenticated: authContext.isAuthenticated,
    username: authContext.username,
  };
  next();
}
