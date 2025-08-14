import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '@/models';

export const generateRequestId = (): string => uuidv4();

export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: unknown },
  requestId?: string,
  processingTime?: number
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    success,
    metadata: {
      timestamp: new Date().toISOString(),
      request_id: requestId || generateRequestId(),
    },
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (error !== undefined) {
    response.error = error;
  }

  if (processingTime !== undefined) {
    response.metadata!.processing_time_ms = processingTime;
  }

  return response;
};

export const normalizeIngredientName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(fresh|dried|raw|cooked|organic|ground)\b/g, '')
    .trim();

export const calculateProcessingTime = (startTime: [number, number]): number => {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  return Math.round(seconds * 1000 + nanoseconds / 1000000);
};

export const safeJsonParse = <T>(jsonString: string): T | null => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};

export const sanitizeTextInput = (input: string): string =>
  input.trim().replace(/[<>]/g, '').slice(0, 200);

export const findBestIngredientMatch = (
  ingredientName: string,
  database: Record<string, number>
): { key: string; confidence: number } | null => {
  const normalized = normalizeIngredientName(ingredientName);
  
  if (database[normalized]) {
    return { key: normalized, confidence: 1.0 };
  }
  
  const dbKeys = Object.keys(database);
  const partialMatches = dbKeys.filter(key => 
    normalized.includes(key) || key.includes(normalized)
  );
  
  if (partialMatches.length > 0) {
    const bestMatch = partialMatches.reduce((a, b) => a.length > b.length ? a : b);
    return { key: bestMatch, confidence: 0.8 };
  }
  
  return { key: 'unknown', confidence: 0.3 };
};
