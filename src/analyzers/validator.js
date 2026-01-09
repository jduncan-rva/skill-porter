/**
 * Validation Utilities
 * Validates that converted skills/extensions meet platform requirements
 *
 * Supports validation of:
 * - Claude skills (SKILL.md with frontmatter)
 * - Gemini extensions (gemini-extension.json)
 * - Gemini bundled skills (skills/<name>/SKILL.md)
 */

import fs from 'fs/promises';
import path from 'path';
import { PLATFORM_TYPES } from './detector.js';

export class Validator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate a skill/extension for a specific platform
   * @param {string} dirPath - Path to the directory to validate
   * @param {string} platform - Target platform (claude, gemini, gemini-skill, gemini-legacy, or universal)
   * @returns {Promise<{valid: boolean, errors: array, warnings: array}>}
   */
  async validate(dirPath, platform) {
    this.errors = [];
    this.warnings = [];

    try {
      if (platform === PLATFORM_TYPES.CLAUDE || platform === PLATFORM_TYPES.UNIVERSAL) {
        await this._validateClaude(dirPath);
      }

      // Handle all Gemini variants
      const isGemini = platform === PLATFORM_TYPES.GEMINI ||
                       platform === PLATFORM_TYPES.GEMINI_SKILL ||
                       platform === PLATFORM_TYPES.GEMINI_LEGACY ||
                       platform === PLATFORM_TYPES.UNIVERSAL;

      if (isGemini) {
        await this._validateGemini(dirPath);

        // Also validate bundled skills if present
        const skillsDir = path.join(dirPath, 'skills');
        if (await this._fileExists(skillsDir)) {
          await this._validateGeminiBundledSkills(dirPath);
        }
      }

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings
      };
    } catch (error) {
      this.errors.push(`Validation failed: ${error.message}`);
      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Validate Claude skill requirements
   */
  async _validateClaude(dirPath) {
    // Check for SKILL.md
    const skillPath = path.join(dirPath, 'SKILL.md');
    if (!await this._fileExists(skillPath)) {
      this.errors.push('Missing required file: SKILL.md');
      return;
    }

    // Validate SKILL.md frontmatter
    const content = await fs.readFile(skillPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      this.errors.push('SKILL.md must have YAML frontmatter');
      return;
    }

    const frontmatter = this._parseYAML(frontmatterMatch[1]);

    // Check required frontmatter fields
    if (!frontmatter.name) {
      this.errors.push('SKILL.md frontmatter missing required field: name');
    } else {
      // Validate name format
      if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
        this.errors.push('Skill name must be lowercase letters, numbers, and hyphens only');
      }
      if (frontmatter.name.length > 64) {
        this.errors.push('Skill name must be 64 characters or less');
      }
    }

    if (!frontmatter.description) {
      this.errors.push('SKILL.md frontmatter missing required field: description');
    } else {
      if (frontmatter.description.length > 1024) {
        this.errors.push('Description must be 1024 characters or less');
      }
      if (frontmatter.description.length < 50) {
        this.warnings.push('Description should be descriptive (at least 50 characters recommended)');
      }
    }

    // Check for marketplace.json (optional but recommended)
    const marketplacePath = path.join(dirPath, '.claude-plugin', 'marketplace.json');
    if (!await this._fileExists(marketplacePath)) {
      this.warnings.push('Missing .claude-plugin/marketplace.json (recommended for MCP server integration)');
    } else {
      await this._validateMarketplaceJSON(marketplacePath);
    }

    // Validate file paths use forward slashes
    if (content.includes('\\')) {
      this.warnings.push('Use forward slashes (/) for file paths, not backslashes (\\)');
    }
  }

  /**
   * Validate Gemini extension requirements
   */
  async _validateGemini(dirPath) {
    // Check for gemini-extension.json
    const manifestPath = path.join(dirPath, 'gemini-extension.json');
    if (!await this._fileExists(manifestPath)) {
      this.errors.push('Missing required file: gemini-extension.json');
      return;
    }

    // Validate manifest JSON
    const content = await fs.readFile(manifestPath, 'utf8');
    let manifest;

    try {
      manifest = JSON.parse(content);
    } catch (error) {
      this.errors.push(`Invalid JSON in gemini-extension.json: ${error.message}`);
      return;
    }

    // Check required fields
    if (!manifest.name) {
      this.errors.push('gemini-extension.json missing required field: name');
    } else {
      // Validate name matches directory
      const dirName = path.basename(dirPath);
      if (manifest.name !== dirName) {
        this.warnings.push(`Extension name "${manifest.name}" should match directory name "${dirName}"`);
      }
    }

    if (!manifest.version) {
      this.errors.push('gemini-extension.json missing required field: version');
    }

    // Validate MCP servers configuration
    if (manifest.mcpServers) {
      for (const [serverName, config] of Object.entries(manifest.mcpServers)) {
        if (!config.command) {
          this.errors.push(`MCP server "${serverName}" missing required field: command`);
        }

        if (config.args) {
          // Check for proper variable substitution
          const argsStr = JSON.stringify(config.args);
          if (argsStr.includes('mcp-server') && !argsStr.includes('${extensionPath}')) {
            this.warnings.push(`MCP server "${serverName}" should use \${extensionPath} variable for paths`);
          }
        }
      }
    }

    // Validate settings if present
    if (manifest.settings) {
      if (!Array.isArray(manifest.settings)) {
        this.errors.push('settings must be an array');
      } else {
        manifest.settings.forEach((setting, index) => {
          if (!setting.name) {
            this.errors.push(`Setting at index ${index} missing required field: name`);
          }
          if (!setting.description) {
            this.warnings.push(`Setting "${setting.name}" should have a description`);
          }
        });
      }
    }

    // Check for context file
    const contextFileName = manifest.contextFileName || 'GEMINI.md';
    const contextPath = path.join(dirPath, contextFileName);
    if (!await this._fileExists(contextPath)) {
      this.warnings.push(`Missing context file: ${contextFileName} (recommended for providing context to Gemini)`);
    }

    // Validate excludeTools if present
    if (manifest.excludeTools) {
      if (!Array.isArray(manifest.excludeTools)) {
        this.errors.push('excludeTools must be an array');
      }
    }
  }

  /**
   * Validate Gemini bundled skills in skills/ directory
   */
  async _validateGeminiBundledSkills(dirPath) {
    const skillsDir = path.join(dirPath, 'skills');

    try {
      const skillDirs = await fs.readdir(skillsDir);

      if (skillDirs.length === 0) {
        this.warnings.push('skills/ directory exists but is empty');
        return;
      }

      for (const skillName of skillDirs) {
        const skillPath = path.join(skillsDir, skillName);

        // Check if it's a directory
        const stats = await fs.stat(skillPath);
        if (!stats.isDirectory()) {
          continue;
        }

        // Check for SKILL.md
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        if (!await this._fileExists(skillMdPath)) {
          this.errors.push(`Bundled skill "${skillName}" missing SKILL.md`);
          continue;
        }

        // Validate SKILL.md content
        await this._validateGeminiSkillMd(skillMdPath, skillName);
      }
    } catch (error) {
      this.errors.push(`Error reading skills directory: ${error.message}`);
    }
  }

  /**
   * Validate a Gemini SKILL.md file
   */
  async _validateGeminiSkillMd(skillMdPath, skillName) {
    const content = await fs.readFile(skillMdPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      this.errors.push(`Skill "${skillName}": SKILL.md must have YAML frontmatter`);
      return;
    }

    const frontmatter = this._parseYAML(frontmatterMatch[1]);

    // Check required fields for Gemini skills
    if (!frontmatter.name) {
      this.errors.push(`Skill "${skillName}": Missing required field "name" in frontmatter`);
    } else {
      // Validate name format
      if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
        this.errors.push(`Skill "${skillName}": Name must be lowercase letters, numbers, and hyphens only`);
      }

      // Check name matches directory
      if (frontmatter.name !== skillName) {
        this.warnings.push(`Skill "${skillName}": Skill name "${frontmatter.name}" should match directory name`);
      }
    }

    if (!frontmatter.description) {
      this.errors.push(`Skill "${skillName}": Missing required field "description" in frontmatter`);
    } else {
      // Gemini uses description for skill activation, should be descriptive
      if (frontmatter.description.length < 20) {
        this.warnings.push(`Skill "${skillName}": Description is very short - Gemini uses this to decide when to activate the skill`);
      }
    }

    // Check for unsupported frontmatter fields (Gemini only supports name + description)
    const supportedFields = ['name', 'description'];
    for (const key of Object.keys(frontmatter)) {
      if (!supportedFields.includes(key)) {
        this.warnings.push(`Skill "${skillName}": Frontmatter field "${key}" is not supported by Gemini CLI skills (only name and description)`);
      }
    }
  }

  /**
   * Validate marketplace.json structure
   */
  async _validateMarketplaceJSON(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    let marketplace;

    try {
      marketplace = JSON.parse(content);
    } catch (error) {
      this.errors.push(`Invalid JSON in marketplace.json: ${error.message}`);
      return;
    }

    // Check required fields
    if (!marketplace.name) {
      this.errors.push('marketplace.json missing required field: name');
    }

    if (!marketplace.metadata) {
      this.errors.push('marketplace.json missing required field: metadata');
    } else {
      if (!marketplace.metadata.description) {
        this.warnings.push('marketplace.json metadata should include description');
      }
      if (!marketplace.metadata.version) {
        this.warnings.push('marketplace.json metadata should include version');
      }
    }

    if (!marketplace.plugins || !Array.isArray(marketplace.plugins)) {
      this.errors.push('marketplace.json missing required field: plugins (array)');
    } else {
      marketplace.plugins.forEach((plugin, index) => {
        if (!plugin.name) {
          this.errors.push(`Plugin at index ${index} missing required field: name`);
        }
        if (!plugin.description) {
          this.errors.push(`Plugin at index ${index} missing required field: description`);
        }
      });
    }
  }

  /**
   * Simple YAML parser for validation
   */
  _parseYAML(yaml) {
    const parsed = {};
    const lines = yaml.split('\n');
    let currentKey = null;

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
}

export default Validator;
