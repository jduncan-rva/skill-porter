/**
 * Platform Detection
 * Analyzes a directory to determine if it's a Claude skill, Gemini extension, or universal
 *
 * Detection includes:
 * - Claude: SKILL.md with YAML frontmatter, .claude-plugin/marketplace.json
 * - Gemini (modern): gemini-extension.json with bundled skill in skills/<name>/SKILL.md
 * - Gemini (legacy): gemini-extension.json with GEMINI.md context file
 * - Universal: Both Claude and Gemini files present
 */

import fs from 'fs/promises';
import path from 'path';

export const PLATFORM_TYPES = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  GEMINI_LEGACY: 'gemini-legacy',  // Legacy format with GEMINI.md
  GEMINI_SKILL: 'gemini-skill',    // Modern format with bundled skill
  UNIVERSAL: 'universal',
  UNKNOWN: 'unknown'
};

export class PlatformDetector {
  /**
   * Detect the platform type of a skill/extension directory
   * @param {string} dirPath - Path to the directory to analyze
   * @returns {Promise<{platform: string, files: object, confidence: string}>}
   */
  async detect(dirPath) {
    const detection = {
      platform: PLATFORM_TYPES.UNKNOWN,
      files: {
        claude: [],
        gemini: [],
        shared: []
      },
      confidence: 'low',
      metadata: {}
    };

    try {
      const exists = await this._checkDirectoryExists(dirPath);
      if (!exists) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      // Check for Claude-specific files
      const claudeFiles = await this._detectClaudeFiles(dirPath);
      detection.files.claude = claudeFiles;

      // Check for Gemini-specific files
      const geminiFiles = await this._detectGeminiFiles(dirPath);
      detection.files.gemini = geminiFiles;

      // Check for shared files
      const sharedFiles = await this._detectSharedFiles(dirPath);
      detection.files.shared = sharedFiles;

      // Determine platform type
      const hasClaude = claudeFiles.length > 0;
      const hasGemini = geminiFiles.length > 0;
      const hasBundledSkill = geminiFiles.some(f => f.type === 'bundled-skill');
      const hasGeminiContext = geminiFiles.some(f => f.type === 'context');

      if (hasClaude && hasGemini) {
        detection.platform = PLATFORM_TYPES.UNIVERSAL;
        detection.confidence = 'high';
      } else if (hasClaude) {
        detection.platform = PLATFORM_TYPES.CLAUDE;
        detection.confidence = 'high';
      } else if (hasGemini) {
        // Differentiate between modern (bundled skill) and legacy (GEMINI.md) formats
        if (hasBundledSkill) {
          detection.platform = PLATFORM_TYPES.GEMINI_SKILL;
          detection.geminiFormat = 'native-skill';
        } else if (hasGeminiContext) {
          detection.platform = PLATFORM_TYPES.GEMINI_LEGACY;
          detection.geminiFormat = 'legacy';
        } else {
          detection.platform = PLATFORM_TYPES.GEMINI;
          detection.geminiFormat = 'unknown';
        }
        detection.confidence = 'high';
      } else {
        detection.platform = PLATFORM_TYPES.UNKNOWN;
        detection.confidence = 'low';
      }

      // Extract metadata
      detection.metadata = await this._extractMetadata(dirPath, detection.platform);

      return detection;
    } catch (error) {
      throw new Error(`Detection failed: ${error.message}`);
    }
  }

  /**
   * Check if directory exists
   */
  async _checkDirectoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Detect Claude-specific files
   * Recognizes both single-skill and multi-skill (plugin) layouts
   */
  async _detectClaudeFiles(dirPath) {
    const claudeFiles = [];

    // Check for SKILL.md at root (single-skill)
    const skillPath = path.join(dirPath, 'SKILL.md');
    if (await this._fileExists(skillPath)) {
      const hasValidFrontmatter = await this._hasYAMLFrontmatter(skillPath);
      if (hasValidFrontmatter) {
        claudeFiles.push({ file: 'SKILL.md', type: 'entry', valid: true });
      } else {
        claudeFiles.push({ file: 'SKILL.md', type: 'entry', valid: false, issue: 'Missing or invalid YAML frontmatter' });
      }
    }

    // Check for .claude-plugin/plugin.json (Claude Code plugin)
    const pluginJsonPath = path.join(dirPath, '.claude-plugin', 'plugin.json');
    if (await this._fileExists(pluginJsonPath)) {
      const isValidJSON = await this._isValidJSON(pluginJsonPath);
      if (isValidJSON) {
        claudeFiles.push({ file: '.claude-plugin/plugin.json', type: 'plugin-manifest', valid: true });
      } else {
        claudeFiles.push({ file: '.claude-plugin/plugin.json', type: 'plugin-manifest', valid: false, issue: 'Invalid JSON' });
      }
    }

    // Check for .claude-plugin/marketplace.json
    const marketplacePath = path.join(dirPath, '.claude-plugin', 'marketplace.json');
    if (await this._fileExists(marketplacePath)) {
      const isValidJSON = await this._isValidJSON(marketplacePath);
      if (isValidJSON) {
        claudeFiles.push({ file: '.claude-plugin/marketplace.json', type: 'manifest', valid: true });
      } else {
        claudeFiles.push({ file: '.claude-plugin/marketplace.json', type: 'manifest', valid: false, issue: 'Invalid JSON' });
      }
    }

    // Check for skills/ directory with SKILL.md files (multi-skill plugin)
    // Only counts as Claude if there's NO gemini-extension.json
    const geminiManifestPath = path.join(dirPath, 'gemini-extension.json');
    const hasGeminiManifest = await this._fileExists(geminiManifestPath);

    if (!hasGeminiManifest) {
      const skillsDir = path.join(dirPath, 'skills');
      if (await this._checkDirectoryExists(skillsDir)) {
        try {
          const skillDirs = await fs.readdir(skillsDir);
          for (const skillName of skillDirs) {
            const skillDirPath = path.join(skillsDir, skillName);
            if (await this._checkDirectoryExists(skillDirPath)) {
              const skillMdPath = path.join(skillDirPath, 'SKILL.md');
              if (await this._fileExists(skillMdPath)) {
                const hasValidFrontmatter = await this._hasYAMLFrontmatter(skillMdPath);
                claudeFiles.push({
                  file: `skills/${skillName}/SKILL.md`,
                  type: 'bundled-skill',
                  valid: hasValidFrontmatter,
                  issue: hasValidFrontmatter ? null : 'Missing or invalid YAML frontmatter'
                });
              }
            }
          }
        } catch {
          // Error reading skills directory
        }
      }
    }

    return claudeFiles;
  }

  /**
   * Detect Gemini-specific files
   * Checks for both modern (bundled skill) and legacy (GEMINI.md) formats
   *
   * IMPORTANT: skills subdirectory SKILL.md files are only considered Gemini format
   * if gemini-extension.json exists. Claude Code plugins can also have skills
   * directories, so we need gemini-extension.json to differentiate between the two.
   */
  async _detectGeminiFiles(dirPath) {
    const geminiFiles = [];

    // Check for gemini-extension.json FIRST - this is the primary indicator
    const manifestPath = path.join(dirPath, 'gemini-extension.json');
    const hasGeminiManifest = await this._fileExists(manifestPath);

    if (hasGeminiManifest) {
      const isValidJSON = await this._isValidJSON(manifestPath);
      if (isValidJSON) {
        geminiFiles.push({ file: 'gemini-extension.json', type: 'manifest', valid: true });
      } else {
        geminiFiles.push({ file: 'gemini-extension.json', type: 'manifest', valid: false, issue: 'Invalid JSON' });
      }
    }

    // Only check for bundled skills if gemini-extension.json exists
    // Claude Code plugins can also have skills/ directories
    if (hasGeminiManifest) {
      const skillsDir = path.join(dirPath, 'skills');
      if (await this._checkDirectoryExists(skillsDir)) {
        try {
          const skillDirs = await fs.readdir(skillsDir);
          for (const skillName of skillDirs) {
            const skillPath = path.join(skillsDir, skillName);
            if (await this._checkDirectoryExists(skillPath)) {
              const skillMdPath = path.join(skillPath, 'SKILL.md');
              if (await this._fileExists(skillMdPath)) {
                const hasValidFrontmatter = await this._hasYAMLFrontmatter(skillMdPath);
                geminiFiles.push({
                  file: `skills/${skillName}/SKILL.md`,
                  type: 'bundled-skill',
                  valid: hasValidFrontmatter,
                  issue: hasValidFrontmatter ? null : 'Missing or invalid YAML frontmatter'
                });
              }
            }
          }
        } catch {
          // Error reading skills directory
        }
      }
    }

    // Check for GEMINI.md (legacy format)
    const geminiMdPath = path.join(dirPath, 'GEMINI.md');
    if (await this._fileExists(geminiMdPath)) {
      geminiFiles.push({ file: 'GEMINI.md', type: 'context', valid: true });
    }

    return geminiFiles;
  }

  /**
   * Detect shared files (common to both platforms)
   */
  async _detectSharedFiles(dirPath) {
    const sharedFiles = [];

    // Check for package.json
    const packagePath = path.join(dirPath, 'package.json');
    if (await this._fileExists(packagePath)) {
      sharedFiles.push({ file: 'package.json', type: 'dependency' });
    }

    // Check for shared directory
    const sharedDirPath = path.join(dirPath, 'shared');
    if (await this._checkDirectoryExists(sharedDirPath)) {
      sharedFiles.push({ file: 'shared/', type: 'directory' });
    }

    // Check for MCP server directory
    const mcpServerPath = path.join(dirPath, 'mcp-server');
    if (await this._checkDirectoryExists(mcpServerPath)) {
      sharedFiles.push({ file: 'mcp-server/', type: 'directory' });
    }

    // Check for skills directory (Gemini bundled skills)
    const skillsPath = path.join(dirPath, 'skills');
    if (await this._checkDirectoryExists(skillsPath)) {
      sharedFiles.push({ file: 'skills/', type: 'directory' });
    }

    // Check for commands directory
    const commandsPath = path.join(dirPath, 'commands');
    if (await this._checkDirectoryExists(commandsPath)) {
      sharedFiles.push({ file: 'commands/', type: 'directory' });
    }

    return sharedFiles;
  }

  /**
   * Extract metadata from files
   */
  async _extractMetadata(dirPath, platform) {
    const metadata = {};

    if (platform === PLATFORM_TYPES.CLAUDE || platform === PLATFORM_TYPES.UNIVERSAL) {
      // Try to extract from SKILL.md
      const skillPath = path.join(dirPath, 'SKILL.md');
      if (await this._fileExists(skillPath)) {
        const frontmatter = await this._extractYAMLFrontmatter(skillPath);
        if (frontmatter) {
          metadata.claude = frontmatter;
        }
      }

      // Try to extract from marketplace.json
      const marketplacePath = path.join(dirPath, '.claude-plugin', 'marketplace.json');
      if (await this._fileExists(marketplacePath)) {
        const content = await fs.readFile(marketplacePath, 'utf8');
        try {
          const json = JSON.parse(content);
          metadata.claudeMarketplace = json;
        } catch {}
      }
    }

    // Check for all Gemini platform variants
    const isGeminiPlatform = [
      PLATFORM_TYPES.GEMINI,
      PLATFORM_TYPES.GEMINI_SKILL,
      PLATFORM_TYPES.GEMINI_LEGACY,
      PLATFORM_TYPES.UNIVERSAL
    ].includes(platform);

    if (isGeminiPlatform) {
      // Try to extract from gemini-extension.json
      const manifestPath = path.join(dirPath, 'gemini-extension.json');
      if (await this._fileExists(manifestPath)) {
        const content = await fs.readFile(manifestPath, 'utf8');
        try {
          const json = JSON.parse(content);
          metadata.gemini = json;
        } catch {}
      }
    }

    return metadata;
  }

  /**
   * Check if file exists
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file is valid JSON
   */
  async _isValidJSON(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file has YAML frontmatter
   */
  async _hasYAMLFrontmatter(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return /^---\n[\s\S]+?\n---/.test(content);
    } catch {
      return false;
    }
  }

  /**
   * Extract YAML frontmatter from file
   */
  async _extractYAMLFrontmatter(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const match = content.match(/^---\n([\s\S]+?)\n---/);
      if (match) {
        // Simple YAML parser for basic key-value pairs
        const yaml = match[1];
        const parsed = {};

        const lines = yaml.split('\n');
        let currentKey = null;
        let currentValue = null;

        for (const line of lines) {
          if (line.trim().startsWith('-')) {
            // Array item
            if (currentKey && Array.isArray(parsed[currentKey])) {
              parsed[currentKey].push(line.trim().substring(1).trim());
            }
          } else if (line.includes(':')) {
            // Key-value pair
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            currentKey = key.trim();

            if (value === '') {
              // Array or multi-line value
              parsed[currentKey] = [];
            } else {
              parsed[currentKey] = value;
            }
          }
        }

        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export default PlatformDetector;
