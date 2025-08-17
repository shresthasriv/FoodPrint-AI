import request from 'supertest';
import express from 'express';
import { estimateFromText, estimateFromImage } from '@/controllers/estimateController';
import * as llmService from '@/services/llmService';
import * as visionService from '@/services/visionService';
import { asyncHandler } from '@/middleware';

jest.mock('@/services/llmService');
jest.mock('@/services/visionService');
jest.mock('@/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.headers['x-request-id'] = 'test-request-id';
  next();
});

describe('EstimateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('estimateFromText', () => {
    app.post('/test/text', asyncHandler(estimateFromText));

    it('should return carbon estimate for valid dish', async () => {
      const mockLLMResponse = {
        ingredients: [
          { name: 'chicken', confidence: 0.9 },
          { name: 'rice', confidence: 0.8 },
        ],
        dish_recognized: true,
        confidence: 0.85,
      };

      (llmService.extractIngredientsFromDish as jest.Mock).mockResolvedValue(mockLLMResponse);

      const response = await request(app)
        .post('/test/text')
        .send({ dish: 'Chicken Biryani' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dish).toBe('Chicken Biryani');
      expect(response.body.data.ingredients).toHaveLength(2);
      expect(response.body.data.estimated_carbon_kg).toBeGreaterThan(0);
      expect(response.body.metadata.request_id).toBe('test-request-id');
    });

    it('should handle LLM service errors gracefully', async () => {
      (llmService.extractIngredientsFromDish as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const response = await request(app)
        .post('/test/text')
        .send({ dish: 'Test Dish' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle low confidence responses', async () => {
      const mockLLMResponse = {
        ingredients: [{ name: 'unknown', confidence: 0.1 }],
        dish_recognized: false,
        confidence: 0.05,
      };

      (llmService.extractIngredientsFromDish as jest.Mock).mockResolvedValue(mockLLMResponse);

      const response = await request(app)
        .post('/test/text')
        .send({ dish: 'Weird Unrecognizable Dish XYZ123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ingredients).toHaveLength(1);
    });
  });

  describe('estimateFromImage', () => {
    app.post('/test/image', (req, _res, next) => {
      req.file = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        size: 1024,
        originalname: 'test.jpg',
      } as Express.Multer.File;
      next();
    }, asyncHandler(estimateFromImage));

    it('should return carbon estimate for valid image', async () => {
      const mockVisionResponse = {
        dish_name: 'Pizza Margherita',
        ingredients: [
          { name: 'cheese', confidence: 0.95 },
          { name: 'tomatoes', confidence: 0.9 },
        ],
        confidence: 0.9,
      };

      (visionService.analyzeImage as jest.Mock).mockResolvedValue(mockVisionResponse);

      const response = await request(app)
        .post('/test/image')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dish).toBe('Pizza Margherita');
      expect(response.body.data.ingredients).toHaveLength(2);
      expect(response.body.metadata.request_id).toBe('test-request-id');
    });

    it('should handle vision service errors gracefully', async () => {
      (visionService.analyzeImage as jest.Mock).mockRejectedValue(
        new Error('Vision service timeout')
      );

      const response = await request(app)
        .post('/test/image')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle images with no identifiable dish', async () => {
      const mockVisionResponse = {
        dish_name: undefined,
        ingredients: [{ name: 'unknown_food', confidence: 0.2 }],
        confidence: 0.1,
      };

      (visionService.analyzeImage as jest.Mock).mockResolvedValue(mockVisionResponse);

      const response = await request(app)
        .post('/test/image')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dish).toBe('Unknown dish from image');
    });
  });
});

