import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '@/models';
import { sanitizeTextInput } from '@/utils/helpers';
import { config } from '@/config/env';

const textEstimationSchema = Joi.object({
  dish: Joi.string()
    .min(1)
    .max(200)
    .pattern(/^[a-zA-Z0-9\s\-.,!?'"()]+$/)
    .required()
    .messages({
      'string.empty': 'Dish name cannot be empty',
      'string.min': 'Dish name must be at least 1 character long',
      'string.max': 'Dish name cannot exceed 200 characters',
      'string.pattern.base': 'Dish name contains invalid characters',
      'any.required': 'Dish name is required',
    }),
});

export const validateTextEstimation = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const { error, value } = textEstimationSchema.validate(req.body);

    if (error) {
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
      throw new ValidationError('No image file provided');
    }

    const file = req.file;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        { received: file.mimetype }
      );
    }

    const maxSizeBytes = config.upload.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${config.upload.maxFileSizeMB}MB`,
        { 
          receivedSizeMB: Math.round(file.size / (1024 * 1024) * 100) / 100,
          maxSizeMB: config.upload.maxFileSizeMB 
        }
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new ValidationError('Uploaded file is empty or corrupted');
    }

    next();
  } catch (err) {
    next(err);
  }
};
