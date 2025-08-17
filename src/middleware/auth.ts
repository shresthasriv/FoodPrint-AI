import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '@/config/env';
import { logger } from '@/config/logger';

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: {
        apiKey: string;
        userId?: string;
        isValid: boolean;
      };
    }
  }
}

const VALID_API_KEYS = new Set([
  generateApiKeyHash('demo-key-1'),
  generateApiKeyHash('test-key-2'), 
  generateApiKeyHash('foodprint-api-key'),
]);

function generateApiKeyHash(apiKey: string): string {
  return crypto
    .createHmac('sha256', config.auth.apiKeySecret)
    .update(apiKey)
    .digest('hex');
}

export const authenticateApiKey = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string || 
                  req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.api_key as string;

    if (!apiKey) {
      logger.warn('Authentication attempt without API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      throw new AuthenticationError('API key is required');
    }

    if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 128) {
      logger.warn('Invalid API key format', {
        ip: req.ip,
        keyLength: apiKey.length,
        path: req.path,
      });
      throw new AuthenticationError('Invalid API key format');
    }

    const sanitizedApiKey = apiKey.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (sanitizedApiKey !== apiKey) {
      logger.warn('API key contains invalid characters', { ip: req.ip });
      throw new AuthenticationError('Invalid API key characters');
    }

    const hashedApiKey = generateApiKeyHash(apiKey);
    if (!VALID_API_KEYS.has(hashedApiKey)) {
      logger.warn('Invalid API key provided', {
        ip: req.ip,
        apiKeyPrefix: apiKey.substring(0, 4),
        path: req.path,
      });
      throw new AuthenticationError('Invalid API key');
    }

    req.auth = {
      apiKey: apiKey,
      userId: `user_${hashedApiKey.substring(0, 8)}`,
      isValid: true,
    };

    logger.debug('Successful API key authentication', {
      userId: req.auth.userId,
      ip: req.ip,
      path: req.path,
    });

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string || 
                  req.headers['authorization']?.replace('Bearer ', '');

    if (apiKey && typeof apiKey === 'string' && apiKey.length >= 8) {
      const sanitizedApiKey = apiKey.replace(/[^a-zA-Z0-9\-_]/g, '');
      if (sanitizedApiKey === apiKey) {
        const hashedApiKey = generateApiKeyHash(apiKey);
        if (VALID_API_KEYS.has(hashedApiKey)) {
          req.auth = {
            apiKey: apiKey,
            userId: `user_${hashedApiKey.substring(0, 8)}`,
            isValid: true,
          };
        }
      }
    }
    next();
  } catch {
    next();
  }
};

