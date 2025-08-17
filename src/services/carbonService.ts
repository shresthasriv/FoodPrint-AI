import { Ingredient, CarbonEstimate } from '@/models';
import { CARBON_FOOTPRINT_DB } from '@/utils/constants';
import { findBestIngredientMatch, normalizeIngredientName } from '@/utils/helpers';
import { logger } from '@/config/logger';

export const calculateCarbonFootprint = (
  dishName: string,
  ingredients: Array<{ name: string; confidence?: number }>,
  source: 'text' | 'image',
  processingTimeMs?: number
): CarbonEstimate => {
  const startTime = process.hrtime();
  
  logger.info('Calculating carbon footprint', {
    dish: dishName,
    ingredientCount: ingredients.length,
    source,
  });

  const processedIngredients: Ingredient[] = ingredients.map(ingredient => {
    const normalizedName = normalizeIngredientName(ingredient.name);
    const match = findBestIngredientMatch(normalizedName, CARBON_FOOTPRINT_DB);
    
    let carbonValue = CARBON_FOOTPRINT_DB.unknown;
    let confidence = 0.3;
    
    if (match) {
      carbonValue = CARBON_FOOTPRINT_DB[match.key];
      confidence = match.confidence * (ingredient.confidence || 0.8);
    }

    logger.debug('Ingredient carbon mapping', {
      original: ingredient.name,
      normalized: normalizedName,
      matchedKey: match?.key,
      carbonValue,
      confidence,
    });

    return {
      name: ingredient.name,
      carbon_kg: Math.round(carbonValue * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  });

  const totalCarbon = processedIngredients.reduce(
    (sum, ingredient) => sum + ingredient.carbon_kg,
    0
  );

  const calculationTime = process.hrtime(startTime);
  const calculationDuration = calculationTime[0] * 1000 + calculationTime[1] / 1000000;

  const result: CarbonEstimate = {
    dish: dishName,
    estimated_carbon_kg: Math.round(totalCarbon * 100) / 100,
    ingredients: processedIngredients,
    metadata: {
      processing_time_ms: processingTimeMs ? 
        Math.round(processingTimeMs + calculationDuration) : 
        Math.round(calculationDuration),
      source,
    },
  };

  logger.info('Carbon footprint calculated', {
    dish: dishName,
    totalCarbon: result.estimated_carbon_kg,
    ingredientCount: processedIngredients.length,
    source,
    processingTimeMs: result.metadata?.processing_time_ms,
  });

  return result;
};
