import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../ConfigLoader.js';
import { ConfigUtils } from '../utils/ConfigUtils.js';

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = ConfigLoader.getInstance();
  });

  afterEach(async () => {
    await loader.cleanup();
  });

  describe('Matching Segments', () => {
    it('should load matching segments configuration', async () => {
      const config = await loader.getMatchingSegments();
      
      expect(config).toBeDefined();
      expect(config.segments).toBeDefined();
      expect(config.segments.opening).toBeDefined();
      expect(config.segments.opening.range).toEqual([0, 3000]);
    });

    it('should get segment by time', async () => {
      const segment1 = await loader.getSegmentByTime(1500); // 1.5秒
      expect(segment1.name).toBe('opening');
      
      const segment2 = await loader.getSegmentByTime(5000); // 5秒
      expect(segment2.name).toBe('development');
      
      const segment3 = await loader.getSegmentByTime(40000); // 40秒
      expect(segment3.name).toBe('climax');
    });

    it('should apply dynamic adjustments', async () => {
      const context = {
        music: { phase: 'chorus', intensity: 0.9 }
      };
      
      const adjusted = await loader.applyAdjustments('development', context);
      
      // サビでsyncが強化されているか確認
      expect(adjusted.weights.sync).toBeGreaterThan(0.4);
    });
  });

  describe('Analysis Settings', () => {
    it('should load analysis settings', async () => {
      const config = await loader.getAnalysisSettings();
      
      expect(config).toBeDefined();
      expect(config.music).toBeDefined();
      expect(config.video).toBeDefined();
      expect(config.matching.patterns).toHaveLength(3);
    });

    it('should have required patterns', async () => {
      const config = await loader.getAnalysisSettings();
      const patternNames = config.matching.patterns.map(p => p.name);
      
      expect(patternNames).toContain('dynamic_cut');
      expect(patternNames).toContain('narrative_flow');
      expect(patternNames).toContain('hybrid_balance');
    });
  });
});

describe('ConfigUtils', () => {
  describe('Time conversions', () => {
    it('should convert seconds to milliseconds', () => {
      expect(ConfigUtils.secondsToMs(1.5)).toBe(1500);
      expect(ConfigUtils.secondsToMs(60)).toBe(60000);
    });

    it('should convert milliseconds to seconds', () => {
      expect(ConfigUtils.msToSeconds(1500)).toBe(1.5);
      expect(ConfigUtils.msToSeconds(60000)).toBe(60);
    });

    it('should convert timecode to milliseconds', () => {
      expect(ConfigUtils.timecodeToMs('00:00:01.500')).toBe(1500);
      expect(ConfigUtils.timecodeToMs('00:01:00.000')).toBe(60000);
      expect(ConfigUtils.timecodeToMs('01:23:45.678')).toBe(5025678);
    });

    it('should convert milliseconds to timecode', () => {
      expect(ConfigUtils.msToTimecode(1500)).toBe('00:00:01.500');
      expect(ConfigUtils.msToTimecode(60000)).toBe('00:01:00.000');
      expect(ConfigUtils.msToTimecode(5025678)).toBe('01:23:45.678');
    });
  });

  describe('Weight normalization', () => {
    it('should normalize weights to sum to 1.0', () => {
      const weights = ConfigUtils.normalizeWeights({
        visual: 0.5,
        sync: 0.5,
        semantic: 0.5,
        stability: 0.5,
      });
      
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('Relative values', () => {
    it('should convert to relative value', () => {
      expect(ConfigUtils.toRelativeValue(50, 0, 100)).toBe(0.5);
      expect(ConfigUtils.toRelativeValue(75, 50, 100)).toBe(0.5);
      expect(ConfigUtils.toRelativeValue(0, -100, 100)).toBe(0.5);
    });

    it('should convert from relative value', () => {
      expect(ConfigUtils.fromRelativeValue(0.5, 0, 100)).toBe(50);
      expect(ConfigUtils.fromRelativeValue(0.5, 50, 100)).toBe(75);
      expect(ConfigUtils.fromRelativeValue(0.5, -100, 100)).toBe(0);
    });
  });

  describe('30% change rule', () => {
    it('should validate 30% change', () => {
      const result1 = ConfigUtils.calculate30PercentChange({
        position: 0.4,
        size: 0.2,
        color: 0.1,
      });
      expect(result1.isValid).toBe(true);
      expect(result1.maxChange).toBe(0.4);
      expect(result1.dimension).toBe('position');

      const result2 = ConfigUtils.calculate30PercentChange({
        position: 0.2,
        size: 0.2,
        color: 0.1,
      });
      expect(result2.isValid).toBe(false);
    });
  });
});