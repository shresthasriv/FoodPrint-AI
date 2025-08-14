export interface Ingredient {
  name: string;
  carbon_kg: number;
  confidence?: number;
}

export interface CarbonEstimate {
  dish: string;
  estimated_carbon_kg: number;
  ingredients: Ingredient[];
  metadata?: {
    processing_time_ms?: number;
    source?: 'text' | 'image';
  };
}

export interface EstimateTextRequest {
  dish: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    request_id: string;
    processing_time_ms?: number;
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, 'AI_SERVICE_ERROR', details);
  }
}


