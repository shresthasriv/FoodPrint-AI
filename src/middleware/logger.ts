import { Request, Response, NextFunction } from 'express';
import { generateRequestId } from '@/utils/helpers';
import { logger } from '@/config/logger';

export const addRequestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime();
  const requestId = req.headers['x-request-id'];

  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    requestId,
  });

  const originalJson = res.json;
  res.json = function(body: unknown) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = Math.round(seconds * 1000 + nanoseconds / 1000000);

    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId,
    });

    return originalJson.call(this, body);
  };

  next();
};
