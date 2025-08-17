import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '@/models';
import { sanitizeTextInput } from '@/utils/helpers';
import { config } from '@/config/env';
import { logger } from '@/config/logger';

const textEstimationSchema = Joi.object({
  dish: Joi.string()
    .min(1)
    .max(200)
    .pattern(/^[a-zA-Z0-9\s\-.,!?'"()\u00C0-\u017F\u4e00-\u9fff\u0600-\u06ff\u0900-\u097f]+$/)
    .required()
    .custom((value, helpers) => {
      if (value.trim().length === 0) {
        return helpers.error('string.empty');
      }
      const suspiciousPatterns = [
        /<script/i, /javascript:/i, /onload=/i, /onerror=/i,
        /SELECT.*FROM/i, /UNION.*SELECT/i, /DROP.*TABLE/i,
        /INSERT.*INTO/i, /DELETE.*FROM/i, /UPDATE.*SET/i,
        /exec\s*\(/i, /eval\s*\(/i, /function\s*\(/i,
        /\.\.\//g, /\.\.\\\/g, \/etc\/passwd/i,
        /__proto__/i, /prototype/i, /constructor/i,
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(value))) {
        return helpers.error('string.malicious');
      }
      
      const repeatedChars = /(.)\1{50,}/.test(value);
      if (repeatedChars) {
        return helpers.error('string.repeated');
      }
      
      return value;
    })
    .messages({
      'string.empty': 'Dish name cannot be empty',
      'string.min': 'Dish name must be at least 1 character long',
      'string.max': 'Dish name cannot exceed 200 characters',
      'string.pattern.base': 'Dish name contains invalid characters',
      'string.malicious': 'Dish name contains potentially malicious content',
      'string.repeated': 'Dish name contains excessive repeated characters',
      'any.required': 'Dish name is required',
    }),
}).unknown(false);

export const validateTextEstimation = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      logger.warn('Invalid request body type', { 
        bodyType: typeof req.body,
        ip: req.ip 
      });
      throw new ValidationError('Request body must be a valid JSON object');
    }

    if (JSON.stringify(req.body).length > 10000) {
      logger.warn('Oversized request body', { 
        size: JSON.stringify(req.body).length,
        ip: req.ip 
      });
      throw new ValidationError('Request body is too large');
    }

    const keys = Object.keys(req.body);
    if (keys.length > 10) {
      logger.warn('Too many request body keys', { 
        keyCount: keys.length,
        ip: req.ip 
      });
      throw new ValidationError('Request body has too many properties');
    }

    const { error, value } = textEstimationSchema.validate(req.body);

    if (error) {
      logger.warn('Text validation failed', {
        error: error.details,
        ip: req.ip,
        dish: req.body.dish?.substring(0, 50),
      });
      throw new ValidationError(
        'Invalid request data',
        error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }))
      );
    }

    req.body = { dish: sanitizeTextInput(value.dish) };
    next();
  } catch (err) {
    next(err);
  }
};

export const validateImageUpload = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.file) {
      logger.warn('Image upload attempt without file', { ip: req.ip });
      throw new ValidationError('No image file provided');
    }

    const file = req.file;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn('Invalid file type uploaded', {
        mimetype: file.mimetype,
        filename: file.originalname,
        ip: req.ip,
      });
      throw new ValidationError(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        { received: file.mimetype }
      );
    }

    const maxSizeBytes = config.upload.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      logger.warn('Oversized file uploaded', {
        size: file.size,
        maxSize: maxSizeBytes,
        ip: req.ip,
      });
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${config.upload.maxFileSizeMB}MB`,
        { 
          receivedSizeMB: Math.round(file.size / (1024 * 1024) * 100) / 100,
          maxSizeMB: config.upload.maxFileSizeMB 
        }
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      logger.warn('Empty file uploaded', { ip: req.ip });
      throw new ValidationError('Uploaded file is empty or corrupted');
    }

    if (file.originalname && file.originalname.length > 255) {
      logger.warn('Filename too long', {
        filenameLength: file.originalname.length,
        ip: req.ip,
      });
      throw new ValidationError('Filename is too long');
    }

    const suspiciousFilenames = [
      /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i, /\.pif$/i,
      /\.com$/i, /\.jar$/i, /\.php$/i, /\.jsp$/i, /\.asp$/i,
      /\.js$/i, /\.vbs$/i, /\.sh$/i, /\.py$/i,
    ];
    
    if (file.originalname && suspiciousFilenames.some(pattern => pattern.test(file.originalname))) {
      logger.warn('Suspicious filename detected', {
        filename: file.originalname,
        ip: req.ip,
      });
      throw new ValidationError('Invalid file extension');
    }

    if (file.buffer.length < 100) {
      logger.warn('File too small to be valid image', {
        size: file.buffer.length,
        ip: req.ip,
      });
      throw new ValidationError('File is too small to be a valid image');
    }

    const imageHeaders = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
    };

    const fileHeader = Array.from(file.buffer.slice(0, 4));
    const isValidHeader = Object.entries(imageHeaders).some(([type, header]) => {
      if (type === file.mimetype) {
        return header.every((byte, index) => fileHeader[index] === byte);
      }
      return false;
    });

    if (!isValidHeader) {
      logger.warn('Invalid image header detected', {
        mimetype: file.mimetype,
        header: fileHeader,
        ip: req.ip,
      });
      throw new ValidationError('File header does not match declared image type');
    }

    next();
  } catch (err) {
    next(err);
  }
};
