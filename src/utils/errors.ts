export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const BadRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const Unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const Forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);

export const NotFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const Conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const UnprocessableEntity = (message: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);

export const TooManyRequests = (message = 'Too many requests') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);
