export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const API_CODES = {
  SUCCESS: 'SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
} as const;

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const CARBON_FOOTPRINT_DB: Record<string, number> = {
  beef: 60.0,
  lamb: 39.2,
  pork: 12.1,
  chicken: 6.9,
  fish: 6.1,
  shrimp: 18.0,
  eggs: 4.2,
  milk: 3.2,
  cheese: 13.5,
  butter: 23.8,
  rice: 4.0,
  wheat: 1.4,
  bread: 1.6,
  pasta: 1.1,
  potatoes: 0.5,
  tomatoes: 2.1,
  onions: 0.5,
  carrots: 0.4,
  'olive oil': 5.4,
  'vegetable oil': 3.2,
  salt: 0.1,
  sugar: 1.8,
  beans: 2.0,
  lentils: 1.9,
  tofu: 3.0,
  nuts: 2.3,
  spices: 1.0,
  unknown: 2.0,
} as const;
