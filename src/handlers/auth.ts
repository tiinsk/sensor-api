/**
 * Auth route handlers
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUser } from '../data/users';
import { verifyPassword } from '../lib/password';
import { signUserToken } from '../lib/jwt';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/login
 * Login with username/password, returns JWT token
 */
export async function login(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const { username, password } = LoginSchema.parse(body);

    // Get user from database
    const user = await getUser(username);
    if (!user || user.disabled) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized user' }),
      };
    }

    // Verify password
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized user' }),
      };
    }

    // Generate JWT token
    const token = signUserToken(username);

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request', details: error.errors }),
      };
    }

    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
