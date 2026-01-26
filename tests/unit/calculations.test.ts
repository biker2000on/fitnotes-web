import { describe, it, expect } from 'vitest';
import {
  calculate1RM,
  calculateVolume,
  gramsToKg,
  gramsToLbs,
  kgToGrams,
  lbsToGrams,
} from '@/lib/calculations';

describe('calculate1RM', () => {
  it('should return weight when reps is 1', () => {
    expect(calculate1RM(100000, 1)).toBe(100000); // 100kg
  });

  it('should return 0 when reps is 0', () => {
    expect(calculate1RM(100000, 0)).toBe(0);
  });

  it('should calculate 1RM using Epley formula for multiple reps', () => {
    // 100kg × (1 + 5/30) = 100kg × 1.1667 = 116.67kg ≈ 117kg
    expect(calculate1RM(100000, 5)).toBe(116667);
  });

  it('should calculate 1RM for 10 reps', () => {
    // 80kg × (1 + 10/30) = 80kg × 1.3333 = 106.67kg ≈ 107kg
    expect(calculate1RM(80000, 10)).toBe(106667);
  });

  it('should round to nearest integer', () => {
    // Test rounding
    expect(calculate1RM(75000, 8)).toBe(95000); // 75 × (1 + 8/30) = 95
  });
});

describe('calculateVolume', () => {
  it('should calculate volume correctly', () => {
    expect(calculateVolume(100000, 5)).toBe(500000); // 100kg × 5 reps
  });

  it('should return 0 when reps is 0', () => {
    expect(calculateVolume(100000, 0)).toBe(0);
  });

  it('should return 0 when weight is 0', () => {
    expect(calculateVolume(0, 10)).toBe(0);
  });

  it('should handle large volumes', () => {
    expect(calculateVolume(200000, 12)).toBe(2400000); // 200kg × 12 reps
  });
});

describe('Weight conversions', () => {
  describe('gramsToKg', () => {
    it('should convert grams to kilograms', () => {
      expect(gramsToKg(1000)).toBe(1);
      expect(gramsToKg(2500)).toBe(2.5);
      expect(gramsToKg(100000)).toBe(100);
    });

    it('should handle 0', () => {
      expect(gramsToKg(0)).toBe(0);
    });
  });

  describe('gramsToLbs', () => {
    it('should convert grams to pounds', () => {
      expect(gramsToLbs(453592)).toBeCloseTo(1000, 0); // 1000 lbs
      expect(gramsToLbs(45359)).toBeCloseTo(100, 0); // 100 lbs
    });

    it('should handle 0', () => {
      expect(gramsToLbs(0)).toBe(0);
    });

    it('should be accurate for common weights', () => {
      // 100kg = 220.46 lbs
      expect(gramsToLbs(100000)).toBeCloseTo(220.46, 1);
    });
  });

  describe('kgToGrams', () => {
    it('should convert kilograms to grams', () => {
      expect(kgToGrams(1)).toBe(1000);
      expect(kgToGrams(2.5)).toBe(2500);
      expect(kgToGrams(100)).toBe(100000);
    });

    it('should round to nearest integer', () => {
      expect(kgToGrams(1.2345)).toBe(1235);
    });

    it('should handle 0', () => {
      expect(kgToGrams(0)).toBe(0);
    });
  });

  describe('lbsToGrams', () => {
    it('should convert pounds to grams', () => {
      expect(lbsToGrams(1)).toBe(454); // 1 lb ≈ 454g
      expect(lbsToGrams(100)).toBe(45359); // 100 lbs
    });

    it('should round to nearest integer', () => {
      expect(lbsToGrams(2.2046)).toBe(1000); // ~1kg
    });

    it('should handle 0', () => {
      expect(lbsToGrams(0)).toBe(0);
    });

    it('should be accurate for common weights', () => {
      // 220.46 lbs should be approximately 100kg (100000g)
      // Allow 1 gram tolerance due to rounding
      expect(lbsToGrams(220.46)).toBeCloseTo(100000, -1);
    });
  });

  describe('Round-trip conversions', () => {
    it('should maintain accuracy for kg round-trip', () => {
      const originalKg = 100;
      const grams = kgToGrams(originalKg);
      const backToKg = gramsToKg(grams);
      expect(backToKg).toBe(originalKg);
    });

    it('should maintain approximate accuracy for lbs round-trip', () => {
      const originalLbs = 220.46;
      const grams = lbsToGrams(originalLbs);
      const backToLbs = gramsToLbs(grams);
      expect(backToLbs).toBeCloseTo(originalLbs, 1);
    });
  });
});

describe('Integration scenarios', () => {
  it('should calculate correct 1RM for standard bench press progression', () => {
    // Week 1: 60kg × 8 reps
    const week1_1RM = calculate1RM(60000, 8);
    expect(week1_1RM).toBe(76000); // ~76kg

    // Week 4: 65kg × 8 reps
    const week4_1RM = calculate1RM(65000, 8);
    expect(week4_1RM).toBe(82333); // ~82kg

    // Progress should be detected
    expect(week4_1RM).toBeGreaterThan(week1_1RM);
  });

  it('should detect volume PR even if weight is same', () => {
    // Week 1: 100kg × 5 reps = 500kg volume
    const week1Volume = calculateVolume(100000, 5);
    expect(week1Volume).toBe(500000);

    // Week 2: 100kg × 6 reps = 600kg volume (PR!)
    const week2Volume = calculateVolume(100000, 6);
    expect(week2Volume).toBe(600000);

    expect(week2Volume).toBeGreaterThan(week1Volume);
  });
});
