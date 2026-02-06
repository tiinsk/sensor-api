/**
 * Custom error classes for better error handling
 */

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConflictError extends Error {
  public readonly statusCode = 409;
  
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  public readonly statusCode = 400;
  
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Type guard to check if an error is an HTTP error with a status code
 */
export function isHttpError(error: unknown): error is NotFoundError | ConflictError | ValidationError | UnauthorizedError {
  return error instanceof NotFoundError || 
         error instanceof ConflictError || 
         error instanceof ValidationError ||
         error instanceof UnauthorizedError;
}
