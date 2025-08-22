/**
 * Constants for music analysis
 */

/**
 * Audio analysis constants
 */
export const AUDIO_ANALYSIS = {
  /** FFT size for frequency analysis */
  FFT_SIZE: 2048,
  
  /** Hop length for sliding window */
  HOP_LENGTH: 512,
  
  /** Window function for FFT */
  WINDOW_FUNCTION: 'hann' as const,
  
  /** Minimum interval between edit points (ms) */
  MIN_EDIT_POINT_INTERVAL: 500,
  
  /** Maximum edit points per minute */
  MAX_EDIT_POINTS_PER_MINUTE: 30,
  
  /** Onset detection threshold */
  ONSET_THRESHOLD: 0.3,
  
  /** Beat detection sensitivity */
  BEAT_SENSITIVITY: 0.5,
  
  /** Frequency bands for analysis */
  FREQUENCY_BANDS: {
    SUB_BASS: [20, 60],
    BASS: [60, 250],
    LOW_MID: [250, 500],
    MID: [500, 2000],
    HIGH_MID: [2000, 4000],
    HIGH: [4000, 8000],
    BRILLIANCE: [8000, 20000]
  } as const,
  
  /** Dynamic range thresholds */
  DYNAMICS: {
    QUIET_THRESHOLD: -40,  // dB
    NORMAL_THRESHOLD: -20,  // dB
    LOUD_THRESHOLD: -10,    // dB
    PEAK_THRESHOLD: -3      // dB
  } as const
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Enable intermediate result caching */
  ENABLED: true,
  
  /** Cache TTL in seconds */
  TTL_SECONDS: 3600,
  
  /** Maximum cache size in MB */
  MAX_SIZE_MB: 100,
  
  /** Cache directory */
  CACHE_DIR: '.cache/music-analysis'
} as const;

/**
 * Performance configuration
 */
export const PERFORMANCE_CONFIG = {
  /** Enable parallel processing */
  PARALLEL_PROCESSING: true,
  
  /** Number of worker threads */
  WORKER_THREADS: 4,
  
  /** Chunk size for batch processing */
  BATCH_CHUNK_SIZE: 1000,
  
  /** Memory limit per analysis (MB) */
  MEMORY_LIMIT_MB: 512
} as const;

/**
 * Quality presets
 */
export const QUALITY_PRESETS = {
  LOW: {
    fftSize: 1024,
    hopLength: 256,
    processingQuality: 'fast'
  },
  MEDIUM: {
    fftSize: 2048,
    hopLength: 512,
    processingQuality: 'balanced'
  },
  HIGH: {
    fftSize: 4096,
    hopLength: 1024,
    processingQuality: 'quality'
  },
  ULTRA: {
    fftSize: 8192,
    hopLength: 2048,
    processingQuality: 'maximum'
  }
} as const;

/**
 * Export all constants
 */
export default {
  AUDIO_ANALYSIS,
  CACHE_CONFIG,
  PERFORMANCE_CONFIG,
  QUALITY_PRESETS
};