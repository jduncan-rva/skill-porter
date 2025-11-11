/**
 * Fork Setup Feature
 * Creates a fork with dual-platform configuration for simultaneous use
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class ForkSetup {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
  }

  /**
   * Create a fork and set up for dual-platform use
   * @param {object} options - Fork setup options
   * @returns {Promise<{success: boolean, forkPath: string, errors: array}>}
   */
  async setup(options = {}) {
    const {
      forkLocation,
      repoUrl,
      branchName = 'dual-platform-setup'
    } = options;

    const result = {
      success: false,
      forkPath: null,
      errors: [],
      installations: {
        claude: null,
        gemini: null
      }
    };

    try {
      // Step 1: Validate inputs
      if (!forkLocation) {
        throw new Error('Fork location is required (use --fork-location)');
      }

      // Step 2: Create fork directory
      const forkPath = await this._createForkDirectory(forkLocation);
      result.forkPath = forkPath;

      // Step 3: Clone or copy repository
      if (repoUrl) {
        await this._cloneRepository(repoUrl, forkPath);
      } else {
        await this._copyDirectory(this.sourcePath, forkPath);
      }

      // Step 4: Ensure both platform configurations exist
      await this._ensureDualPlatform(forkPath);

      // Step 5: Set up installations
      const installations = await this._setupInstallations(forkPath);
      result.installations = installations;

      result.success = true;
    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Create fork directory
   */
  async _createForkDirectory(forkLocation) {
    try {
      const resolvedPath = path.resolve(forkLocation);
      await fs.mkdir(resolvedPath, { recursive: true });
      return resolvedPath;
    } catch (error) {
      throw new Error(`Failed to create fork directory: ${error.message}`);
    }
  }

  /**
   * Clone repository from URL
   */
  async _cloneRepository(repoUrl, forkPath) {
    try {
      execSync(`git clone ${repoUrl} ${forkPath}`, {
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Copy directory recursively
   */
  async _copyDirectory(source, destination) {
    try {
      // Use cp command for efficient copying
      execSync(`cp -r "${source}" "${destination}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to copy directory: ${error.message}`);
    }
  }

  /**
   * Ensure both platform configurations exist
   */
  async _ensureDualPlatform(forkPath) {
    const hasClaudeConfig = await this._checkFileExists(path.join(forkPath, 'SKILL.md'));
    const hasGeminiConfig = await this._checkFileExists(path.join(forkPath, 'gemini-extension.json'));

    if (hasClaudeConfig && hasGeminiConfig) {
      // Already universal
      return;
    }

    // Need to convert
    const SkillPorter = (await import('../index.js')).default;
    const porter = new SkillPorter();

    if (!hasGeminiConfig) {
      // Convert to Gemini
      await porter.convert(forkPath, 'gemini', { validate: true });
    }

    if (!hasClaudeConfig) {
      // Convert to Claude
      await porter.convert(forkPath, 'claude', { validate: true });
    }
  }

  /**
   * Set up installations for both platforms
   */
  async _setupInstallations(forkPath) {
    const installations = {
      claude: null,
      gemini: null
    };

    // Get skill/extension name
    const skillName = path.basename(forkPath);

    // Set up Claude installation (symlink to personal skills directory)
    const claudeSkillPath = path.join(process.env.HOME, '.claude', 'skills', skillName);
    try {
      // Check if Claude skills directory exists
      await fs.mkdir(path.join(process.env.HOME, '.claude', 'skills'), { recursive: true });

      // Create symlink
      try {
        await fs.symlink(forkPath, claudeSkillPath, 'dir');
        installations.claude = claudeSkillPath;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Symlink already exists
          installations.claude = `${claudeSkillPath} (already exists)`;
        } else {
          throw error;
        }
      }
    } catch (error) {
      installations.claude = `Failed: ${error.message}`;
    }

    // For Gemini, we can't auto-install, but provide instructions
    installations.gemini = 'Run: gemini extensions install ' + forkPath;

    return installations;
  }

  /**
   * Check if file exists
   */
  async _checkFileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default ForkSetup;
