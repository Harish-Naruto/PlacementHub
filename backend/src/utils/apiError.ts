import { NextFunction,Response,Request } from "express";


/**
 * A custom error type that carries an HTTP status code.
 */
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode = 500, isOperational = true, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard structure for API error responses
 */
interface ErrorResponse {
  error: boolean;
  message: string;
  code?: string;
  stack?: string;
}

/**
 * Express middleware to catch all errors and send JSON response.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error("[API Error]", err);
  const status = err instanceof ApiError ? err.statusCode : 500;
  const message =
    err instanceof ApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Internal Server Error";

  const responseBody: ErrorResponse = {
    error: true,
    message,
    ...(err instanceof ApiError && err.code ? { code: err.code } : {}),
  };

  // Include stack trace in development for debugging
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    responseBody.stack = err.stack;
  }

  res.status(status).json(responseBody);
}
