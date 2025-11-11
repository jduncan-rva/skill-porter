/**
 * Skill Porter - Main Module
 * Universal tool to convert Claude Code skills to Gemini CLI extensions and vice versa
 */

import { PlatformDetector, PLATFORM_TYPES } from './analyzers/detector.js';
import { Validator } from './analyzers/validator.js';
import { ClaudeToGeminiConverter } from './converters/claude-to-gemini.js';
import { GeminiToClaudeConverter } from './converters/gemini-to-claude.js';

export class SkillPorter {
  constructor() {
    this.detector = new PlatformDetector();
    this.validator = new Validator();
  }

  /**
   * Analyze a skill/extension directory
   * @param {string} dirPath - Path to the directory to analyze
   * @returns {Promise<object>} Detection results
   */
  async analyze(dirPath) {
    return await this.detector.detect(dirPath);
  }

  /**
   * Convert a skill/extension
   * @param {string} sourcePath - Source directory path
   * @param {string} targetPlatform - Target platform ('claude' or 'gemini')
   * @param {object} options - Conversion options
   * @returns {Promise<object>} Conversion results
   */
  async convert(sourcePath, targetPlatform, options = {}) {
    const { outputPath = sourcePath, validate = true } = options;

    // Step 1: Detect source platform
    const detection = await this.detector.detect(sourcePath);

    if (detection.platform === PLATFORM_TYPES.UNKNOWN) {
      throw new Error('Unable to detect platform type. Ensure directory contains valid skill/extension files.');
    }

    // Step 2: Check if conversion is needed
    if (detection.platform === PLATFORM_TYPES.UNIVERSAL) {
      return {
        success: true,
        message: 'Already a universal skill/extension - no conversion needed',
        platform: PLATFORM_TYPES.UNIVERSAL
      };
    }

    if (detection.platform === targetPlatform) {
      return {
        success: true,
        message: `Already a ${targetPlatform} ${targetPlatform === 'claude' ? 'skill' : 'extension'} - no conversion needed`,
        platform: detection.platform
      };
    }

    // Step 3: Perform conversion
    let converter;
    let result;

    if (targetPlatform === PLATFORM_TYPES.GEMINI) {
      converter = new ClaudeToGeminiConverter(sourcePath, outputPath);
      result = await converter.convert();
    } else if (targetPlatform === PLATFORM_TYPES.CLAUDE) {
      converter = new GeminiToClaudeConverter(sourcePath, outputPath);
      result = await converter.convert();
    } else {
      throw new Error(`Invalid target platform: ${targetPlatform}. Must be 'claude' or 'gemini'`);
    }

    // Step 4: Validate if requested
    if (validate && result.success) {
      const validation = await this.validator.validate(outputPath, targetPlatform);
      result.validation = validation;

      if (!validation.valid) {
        result.success = false;
        result.errors = result.errors || [];
        result.errors.push('Validation failed', ...validation.errors);
      }
    }

    return result;
  }

  /**
   * Validate a skill/extension
   * @param {string} dirPath - Directory path to validate
   * @param {string} platform - Platform type ('claude', 'gemini', or 'universal')
   * @returns {Promise<object>} Validation results
   */
  async validate(dirPath, platform = null) {
    // Auto-detect platform if not specified
    if (!platform) {
      const detection = await this.detector.detect(dirPath);
      platform = detection.platform;
    }

    return await this.validator.validate(dirPath, platform);
  }

  /**
   * Create a universal skill/extension (both platforms)
   * @param {string} sourcePath - Source directory path
   * @param {object} options - Creation options
   * @returns {Promise<object>} Creation results
   */
  async makeUniversal(sourcePath, options = {}) {
    const { outputPath = sourcePath } = options;

    // Detect current platform
    const detection = await this.detector.detect(sourcePath);

    if (detection.platform === PLATFORM_TYPES.UNIVERSAL) {
      return {
        success: true,
        message: 'Already a universal skill/extension',
        platform: PLATFORM_TYPES.UNIVERSAL
      };
    }

    if (detection.platform === PLATFORM_TYPES.UNKNOWN) {
      throw new Error('Unable to detect platform type');
    }

    // Convert to the other platform while keeping the original
    const targetPlatform = detection.platform === PLATFORM_TYPES.CLAUDE ?
      PLATFORM_TYPES.GEMINI : PLATFORM_TYPES.CLAUDE;

    const result = await this.convert(sourcePath, targetPlatform, {
      outputPath,
      validate: true
    });

    if (result.success) {
      result.platform = PLATFORM_TYPES.UNIVERSAL;
      result.message = 'Successfully created universal skill/extension';
    }

    return result;
  }
}

// Export main class and constants
export { PLATFORM_TYPES } from './analyzers/detector.js';
export default SkillPorter;
