import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { AIServiceError } from '@/models';
import { safeJsonParse } from '@/utils/helpers';

const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface LLMIngredient {
  name: string;
  estimated_amount?: string;
  confidence: number;
}

export interface LLMResponse {
  ingredients: LLMIngredient[];
  dish_recognized: boolean;
  confidence: number;
}

const INGREDIENT_EXTRACTION_PROMPT = `You are a food expert tasked with identifying ingredients in dishes.

Given a dish name, provide a JSON response with this exact structure:
{
  "ingredients": [
    {
      "name": "ingredient_name",
      "estimated_amount": "approximate quantity or portion size",
      "confidence": 0.0-1.0
    }
  ],
  "dish_recognized": true/false,
  "confidence": 0.0-1.0
}

Rules:
- Use common ingredient names (e.g., "chicken" not "chicken breast")
- Include main ingredients only, skip garnishes unless significant
- For confidence: 1.0 = very certain, 0.5 = moderate, 0.0 = complete guess
- Set dish_recognized to false for nonsensical or unrecognizable dish names
- Estimated amount should be realistic for a single serving
- Focus on ingredients that significantly contribute to carbon footprint

Dish: `;

export const extractIngredientsFromDish = async (dishName: string): Promise<LLMResponse> => {
  const startTime = process.hrtime();
  
  try {
    if (!dishName || typeof dishName !== 'string') {
      throw new AIServiceError('Invalid dish name provided');
    }

    const sanitizedDish = dishName.slice(0, 200).trim();
    if (sanitizedDish.length === 0) {
      throw new AIServiceError('Dish name cannot be empty');
    }

    logger.info('Extracting ingredients from dish', { dish: sanitizedDish });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timeout')), 30000);
    });

    const requestPromise = openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a food expert. Always respond with valid JSON only. Do not include any explanations outside the JSON structure.',
        },
        {
          role: 'user',
          content: `${INGREDIENT_EXTRACTION_PROMPT}${sanitizedDish}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const response = await Promise.race([requestPromise, timeoutPromise]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AIServiceError('No response content from LLM');
    }

    if (content.length > 50000) {
      throw new AIServiceError('LLM response too large');
    }

    const parsedResponse = safeJsonParse<LLMResponse>(content);
    if (!parsedResponse) {
      logger.error('Failed to parse LLM response', { 
        dish: sanitizedDish,
        content: content.substring(0, 500)
      });
      throw new AIServiceError('Failed to parse LLM response as JSON');
    }

    if (!parsedResponse.ingredients || !Array.isArray(parsedResponse.ingredients)) {
      throw new AIServiceError('Invalid LLM response structure');
    }

    if (parsedResponse.ingredients.length > 50) {
      logger.warn('LLM returned too many ingredients', {
        dish: sanitizedDish,
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

    logger.info('Successfully extracted ingredients', {
      dish: sanitizedDish,
      ingredientCount: parsedResponse.ingredients.length,
      confidence: parsedResponse.confidence,
      processingTimeMs: Math.round(duration),
    });

    return parsedResponse;
  } catch (error) {
    const processingTime = process.hrtime(startTime);
    const duration = processingTime[0] * 1000 + processingTime[1] / 1000000;

    logger.error('Failed to extract ingredients', {
      dish: dishName,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Math.round(duration),
    });

    if (error instanceof AIServiceError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      throw new AIServiceError('AI service request timed out, please try again');
    }

    throw new AIServiceError(
      'Failed to extract ingredients from dish name',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
};
