import { Request, Response } from 'express';
import { EstimateTextRequest, CarbonEstimate } from '@/models';
import { extractIngredientsFromDish } from '@/services/llmService';
import { analyzeImage } from '@/services/visionService';
import { calculateCarbonFootprint } from '@/services/carbonService';
import { createApiResponse, calculateProcessingTime } from '@/utils/helpers';
import { logger } from '@/config/logger';

/**
 * @swagger
 * /api/v1/estimate:
 *   post:
 *     summary: Estimate carbon footprint from dish name
 *     description: Uses LLM to extract ingredients from dish name and calculate carbon footprint
 *     tags: [Carbon Estimation]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dish
 *             properties:
 *               dish:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 example: "Chicken Biryani"
 *                 description: Name of the dish to analyze
 *           examples:
 *             simple:
 *               summary: Simple dish
 *               value:
 *                 dish: "Chicken Biryani"
 *             international:
 *               summary: International dish
 *               value:
 *                 dish: "Spaghetti Carbonara"
 *             complex:
 *               summary: Complex dish
 *               value:
 *                 dish: "Thai Green Curry with Jasmine Rice"
 *     responses:
 *       200:
 *         description: Carbon footprint estimation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CarbonEstimateResponse'
 *             examples:
 *               chicken_biryani:
 *                 summary: Chicken Biryani Example
 *                 value:
 *                   success: true
 *                   data:
 *                     dish: "Chicken Biryani"
 *                     estimated_carbon_kg: 4.2
 *                     ingredients:
 *                       - name: "Rice"
 *                         carbon_kg: 1.1
 *                         confidence: 0.85
 *                       - name: "Chicken"
 *                         carbon_kg: 2.5
 *                         confidence: 0.9
 *                       - name: "Spices"
 *                         carbon_kg: 0.2
 *                         confidence: 0.7
 *                       - name: "Oil"
 *                         carbon_kg: 0.4
 *                         confidence: 0.8
 *                     metadata:
 *                       processing_time_ms: 1250
 *                       source: "text"
 *                   metadata:
 *                     timestamp: "2024-01-20T10:30:00.000Z"
 *                     request_id: "abc-123-def"
 *                     processing_time_ms: 1250
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       503:
 *         $ref: '#/components/responses/AIServiceError'
 */

export const estimateFromText = async (req: Request, res: Response): Promise<void> => {
  const startTime = process.hrtime();
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const { dish }: EstimateTextRequest = req.body;
    
    logger.info('Processing text estimation request', { dish, requestId });

    const llmResponse = await extractIngredientsFromDish(dish);
    
    if (!llmResponse.dish_recognized || llmResponse.confidence < 0.1) {
      logger.warn('Dish not recognized or low confidence', {
        dish,
        recognized: llmResponse.dish_recognized,
        confidence: llmResponse.confidence,
        requestId,
      });
    }

    const carbonEstimate = calculateCarbonFootprint(
      dish,
      llmResponse.ingredients,
      'text',
      calculateProcessingTime(startTime)
    );

    const response = createApiResponse<CarbonEstimate>(
      true,
      carbonEstimate,
      undefined,
      requestId,
      calculateProcessingTime(startTime)
    );

    res.json(response);
  } catch (error) {
    logger.error('Text estimation failed', {
      dish: (req.body as EstimateTextRequest).dish,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
    throw error;
  }
};

/**
 * @swagger
 * /api/v1/estimate/image:
 *   post:
 *     summary: Estimate carbon footprint from food image
 *     description: Uses vision AI to identify dish and ingredients from uploaded image, then calculates carbon footprint
 *     tags: [Carbon Estimation]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Food image file (JPEG, PNG, WebP, max 10MB)
 *           examples:
 *             pizza:
 *               summary: Pizza image
 *               description: Upload an image of pizza
 *             salad:
 *               summary: Salad image  
 *               description: Upload an image of salad
 *     responses:
 *       200:
 *         description: Carbon footprint estimation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CarbonEstimateResponse'
 *             examples:
 *               pizza:
 *                 summary: Pizza Analysis Example
 *                 value:
 *                   success: true
 *                   data:
 *                     dish: "Margherita Pizza"
 *                     estimated_carbon_kg: 3.8
 *                     ingredients:
 *                       - name: "Cheese"
 *                         carbon_kg: 2.7
 *                         confidence: 0.95
 *                       - name: "Tomatoes"
 *                         carbon_kg: 0.4
 *                         confidence: 0.9
 *                       - name: "Wheat"
 *                         carbon_kg: 0.7
 *                         confidence: 0.8
 *                     metadata:
 *                       processing_time_ms: 2100
 *                       source: "image"
 *                   metadata:
 *                     timestamp: "2024-01-20T10:30:00.000Z"
 *                     request_id: "xyz-789-uvw"
 *                     processing_time_ms: 2100
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/AuthenticationError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       503:
 *         $ref: '#/components/responses/AIServiceError'
 */
export const estimateFromImage = async (req: Request, res: Response): Promise<void> => {
  const startTime = process.hrtime();
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    if (!req.file) {
      throw new Error('No image file provided');
    }

    const { buffer, mimetype } = req.file;
    
    logger.info('Processing image estimation request', {
      imageSize: buffer.length,
      mimeType: mimetype,
      requestId,
    });

    const visionResponse = await analyzeImage(buffer, mimetype);
    
    if (visionResponse.confidence < 0.1) {
      logger.warn('Low confidence in image analysis', {
        confidence: visionResponse.confidence,
        dishName: visionResponse.dish_name,
        requestId,
      });
    }

    const dishName = visionResponse.dish_name || 'Unknown dish from image';
    
    const carbonEstimate = calculateCarbonFootprint(
      dishName,
      visionResponse.ingredients,
      'image',
      calculateProcessingTime(startTime)
    );

    const response = createApiResponse<CarbonEstimate>(
      true,
      carbonEstimate,
      undefined,
      requestId,
      calculateProcessingTime(startTime)
    );

    res.json(response);
  } catch (error) {
    logger.error('Image estimation failed', {
      imageSize: req.file?.size,
      mimeType: req.file?.mimetype,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
    throw error;
  }
};
