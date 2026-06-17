/**
 * Password hashing utilities using bcrypt
 */

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = async (
  password: string,
  passwordHash: string
): Promise<boolean> => bcrypt.compare(password, passwordHash);
