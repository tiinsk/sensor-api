/**
 * Auth route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getUser } from '../data/users';
import { verifyPassword } from '../lib/password';
import { signUserToken } from '../lib/jwt';
import { getUserAuth } from '../lib/auth-middleware';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/login
 * Login with username/password, returns JWT token
 */
export async function login(req: Request, res: Response) {
  try {
    // Parse and validate request body
    const { username, password } = LoginSchema.parse(req.body);

    // Get user from database
    const user = await getUser(username);
    if (!user || user.disabled) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    // Verify password
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    // Generate JWT token
    const token = signUserToken(username);

    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/session/extend
 * Issue a new user JWT when the current one is still valid
 */
export async function extendSession(req: Request, res: Response) {
  const token = signUserToken(getUserAuth(req).username);
  return res.json({ token });
}
