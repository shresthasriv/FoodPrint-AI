import rateLimit from 'express-rate-limit';
import { config } from '@/config/env';
import { createApiResponse } from '@/utils/helpers';
import { API_CODES } from '@/utils/constants';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: createApiResponse(
    false,
    undefined,
    {
      code: API_CODES.RATE_LIMIT_ERROR,
      message: 'Too many requests, please try again later',
    }
  ),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.apiKey || req.ip || 'unknown',
  skip: (req) => req.path === '/health' || req.path === '/',
});
