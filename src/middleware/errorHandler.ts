import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/models';
import { createApiResponse } from '@/utils/helpers';
import { HTTP_STATUS, API_CODES } from '@/utils/constants';
import { logger } from '@/config/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  if (error instanceof AppError) {
    const response = createApiResponse(
      false,
      undefined,
      {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      req.headers['x-request-id'] as string
    );
    res.status(error.statusCode).json(response);
    return;
  }

  if (error.name === 'ValidationError') {
    const response = createApiResponse(
      false,
      undefined,
      {
        code: API_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.message,
      },
      req.headers['x-request-id'] as string
    );
    res.status(HTTP_STATUS.BAD_REQUEST).json(response);
    return;
  }

  if (error.name === 'MulterError') {
    const response = createApiResponse(
      false,
      undefined,
      {
        code: API_CODES.FILE_UPLOAD_ERROR,
        message: 'File upload error',
        details: error.message,
      },
      req.headers['x-request-id'] as string
    );
    res.status(HTTP_STATUS.BAD_REQUEST).json(response);
    return;
  }

  const response = createApiResponse(
    false,
    undefined,
    {
      code: API_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
    req.headers['x-request-id'] as string
  );
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response = createApiResponse(
    false,
    undefined,
    {
      code: API_CODES.VALIDATION_ERROR,
      message: `Route ${req.method} ${req.path} not found`,
    },
    req.headers['x-request-id'] as string
  );
  res.status(HTTP_STATUS.NOT_FOUND).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => (req: Request, res: Response, next: NextFunction): void => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
