import { calculateCarbonFootprint } from '@/services/carbonService';
import { CARBON_FOOTPRINT_DB } from '@/utils/constants';

describe('CarbonService', () => {
  describe('calculateCarbonFootprint', () => {
    it('should calculate carbon footprint for known ingredients', () => {
      const ingredients = [
        { name: 'chicken', confidence: 0.9 },
        { name: 'rice', confidence: 0.8 },
      ];

      const result = calculateCarbonFootprint('Chicken Rice', ingredients, 'text');

      expect(result.dish).toBe('Chicken Rice');
      expect(result.estimated_carbon_kg).toBeGreaterThan(0);
      expect(result.ingredients).toHaveLength(2);
      expect(result.ingredients[0].name).toBe('chicken');
      expect(result.ingredients[0].carbon_kg).toBe(CARBON_FOOTPRINT_DB.chicken);
      expect(result.metadata?.source).toBe('text');
    });

    it('should handle unknown ingredients with fallback values', () => {
      const ingredients = [
        { name: 'exotic_unknown_ingredient_xyz', confidence: 0.5 },
      ];

      const result = calculateCarbonFootprint('Unknown Dish', ingredients, 'text');

      expect(result.ingredients[0].carbon_kg).toBe(CARBON_FOOTPRINT_DB.unknown);
      expect(result.ingredients[0].confidence).toBeLessThan(0.5);
    });

    it('should handle empty ingredients array', () => {
      const result = calculateCarbonFootprint('Empty Dish', [], 'text');

      expect(result.estimated_carbon_kg).toBe(0);
      expect(result.ingredients).toHaveLength(0);
    });

    it('should normalize ingredient names correctly', () => {
      const ingredients = [
        { name: 'CHICKEN  BREAST   ', confidence: 0.9 },
        { name: 'fresh organic rice', confidence: 0.8 },
      ];

      const result = calculateCarbonFootprint('Mixed Dish', ingredients, 'text');

      expect(result.ingredients[0].carbon_kg).toBe(CARBON_FOOTPRINT_DB.chicken);
      expect(result.ingredients[1].carbon_kg).toBe(CARBON_FOOTPRINT_DB.rice);
    });
  });
});

