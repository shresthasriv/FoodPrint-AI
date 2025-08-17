import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { AIServiceError } from '@/models';
import { safeJsonParse } from '@/utils/helpers';

const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface VisionIngredient {
  name: string;
  confidence: number;
  estimated_amount?: string;
}

export interface VisionResponse {
  dish_name?: string;
  ingredients: VisionIngredient[];
  confidence: number;
}

const VISION_ANALYSIS_PROMPT = `Analyze this food image and identify the dish and its main ingredients.

Provide a JSON response with this exact structure:
{
  "dish_name": "identified dish name or description",
  "ingredients": [
    {
      "name": "ingredient_name", 
      "confidence": 0.0-1.0,
      "estimated_amount": "approximate quantity visible"
    }
  ],
  "confidence": 0.0-1.0
}

Rules:
- If you can't clearly identify the dish, describe what you see
- Focus on main visible ingredients
- Use confidence scores: 1.0 = very certain, 0.5 = moderate, 0.0 = uncertain
- Include ingredients that contribute to carbon footprint
- If image is unclear/not food, set confidence to 0.0`;

export const analyzeImage = async (imageBuffer: Buffer, mimeType: string): Promise<VisionResponse> => {
  const startTime = process.hrtime();
  
  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new AIServiceError('Invalid image buffer provided');
    }

    if (imageBuffer.length > 20 * 1024 * 1024) {
      throw new AIServiceError('Image file too large for processing');
    }

    logger.info('Analyzing food image', { 
      imageSize: imageBuffer.length,
      mimeType,
    });

    const base64Image = imageBuffer.toString('base64');
    if (base64Image.length > 100 * 1024 * 1024) {
      throw new AIServiceError('Encoded image too large for AI processing');
    }

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI vision request timeout')), 45000);
    });

    const requestPromise = openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a food vision expert. Always respond with valid JSON only. Do not include any explanations outside the JSON structure.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: VISION_ANALYSIS_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const response = await Promise.race([requestPromise, timeoutPromise]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AIServiceError('No response content from vision model');
    }

    if (content.length > 50000) {
      throw new AIServiceError('Vision model response too large');
    }

    const parsedResponse = safeJsonParse<VisionResponse>(content);
    if (!parsedResponse) {
      logger.error('Failed to parse vision response', { 
        content: content.substring(0, 500)
      });
      throw new AIServiceError('Failed to parse vision model response as JSON');
    }

    if (!parsedResponse.ingredients || !Array.isArray(parsedResponse.ingredients)) {
      throw new AIServiceError('Invalid vision model response structure');
    }

    if (parsedResponse.ingredients.length > 50) {
      logger.warn('Vision model returned too many ingredients', {
        count: parsedResponse.ingredients.length,
      });
      parsedResponse.ingredients = parsedResponse.ingredients.slice(0, 20);
    }

    parsedResponse.ingredients = parsedResponse.ingredients.filter(ing => 
      ing.name && 
      typeof ing.name === 'string' && 
      ing.name.length > 0 && 
      ing.name.length < 100
    );

    const processingTime = process.hrtime(startTime);
    const duration = processingTime[0] * 1000 + processingTime[1] / 1000000;

    logger.info('Successfully analyzed image', {
      dishName: parsedResponse.dish_name,
      ingredientCount: parsedResponse.ingredients.length,
      confidence: parsedResponse.confidence,
      processingTimeMs: Math.round(duration),
    });

    return parsedResponse;
  } catch (error) {
    const processingTime = process.hrtime(startTime);
    const duration = processingTime[0] * 1000 + processingTime[1] / 1000000;

    logger.error('Failed to analyze image', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Math.round(duration),
    });

    if (error instanceof AIServiceError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      throw new AIServiceError('AI vision service request timed out, please try again');
    }

    throw new AIServiceError(
      'Failed to analyze food image',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
};
