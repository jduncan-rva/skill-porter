/**
 * Claude to Gemini Converter
 * Converts Claude Code skills to Gemini CLI extensions
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export class ClaudeToGeminiConverter {
  constructor(sourcePath, outputPath) {
    this.sourcePath = sourcePath;
    this.outputPath = outputPath || sourcePath;
    this.metadata = {
      source: {},
      generated: []
    };
  }

  /**
   * Perform the conversion
   * @returns {Promise<{success: boolean, files: array, warnings: array}>}
   */
  async convert() {
    const result = {
      success: false,
      files: [],
      warnings: [],
      errors: []
    };

    try {
      // Step 1: Extract metadata from Claude skill
      await this._extractClaudeMetadata();

      // Step 2: Generate gemini-extension.json
      const manifestPath = await this._generateGeminiManifest();
      result.files.push(manifestPath);

      // Step 3: Generate GEMINI.md from SKILL.md
      const contextPath = await this._generateGeminiContext();
      result.files.push(contextPath);

      // Step 4: Transform MCP server configuration
      await this._transformMCPConfiguration();

      // Step 5: Create shared directory structure if it doesn't exist
      await this._ensureSharedStructure();

      result.success = true;
      result.metadata = this.metadata;
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Extract metadata from Claude skill files
   */
  async _extractClaudeMetadata() {
    // Extract from SKILL.md
    const skillPath = path.join(this.sourcePath, 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('SKILL.md missing YAML frontmatter');
    }

    const frontmatter = yaml.load(frontmatterMatch[1]);
    this.metadata.source.frontmatter = frontmatter;

    // Extract content (without frontmatter)
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]+?\n---\n/, '');
    this.metadata.source.content = contentWithoutFrontmatter;

    // Extract from marketplace.json if it exists
    const marketplacePath = path.join(this.sourcePath, '.claude-plugin', 'marketplace.json');
    try {
      const marketplaceContent = await fs.readFile(marketplacePath, 'utf8');
      this.metadata.source.marketplace = JSON.parse(marketplaceContent);
    } catch {
      // marketplace.json is optional
      this.metadata.source.marketplace = null;
    }
  }

  /**
   * Generate gemini-extension.json
   */
  async _generateGeminiManifest() {
    const frontmatter = this.metadata.source.frontmatter;
    const marketplace = this.metadata.source.marketplace;

    // Build the manifest
    const manifest = {
      name: frontmatter.name,
      version: marketplace?.metadata?.version || '1.0.0',
      description: frontmatter.description || marketplace?.plugins?.[0]?.description || '',
      contextFileName: 'GEMINI.md'
    };

    // Transform MCP servers configuration
    if (marketplace?.plugins?.[0]?.mcpServers) {
      manifest.mcpServers = this._transformMCPServers(marketplace.plugins[0].mcpServers);
    }

    // Convert allowed-tools to excludeTools
    if (frontmatter['allowed-tools']) {
      manifest.excludeTools = this._convertAllowedToolsToExclude(frontmatter['allowed-tools']);
    }

    // Generate settings from MCP server environment variables
    if (manifest.mcpServers) {
      const settings = this._inferSettingsFromMCPConfig(manifest.mcpServers);
      if (settings.length > 0) {
        manifest.settings = settings;
      }
    }

    // Write to file
    const outputPath = path.join(this.outputPath, 'gemini-extension.json');
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));

    return outputPath;
  }

  /**
   * Transform MCP servers configuration for Gemini
   */
  _transformMCPServers(mcpServers) {
    const transformed = {};

    for (const [serverName, config] of Object.entries(mcpServers)) {
      transformed[serverName] = {
        ...config
      };

      // Transform args to use ${extensionPath}
      if (config.args) {
        transformed[serverName].args = config.args.map(arg => {
          // If it's a relative path, prepend ${extensionPath}
          if (arg.match(/^[a-z]/i) && !arg.startsWith('${')) {
            return `\${extensionPath}/${arg}`;
          }
          return arg;
        });
      }

      // Transform env variables to use settings
      if (config.env) {
        const newEnv = {};
        for (const [key, value] of Object.entries(config.env)) {
          // If it references an env var (${VAR}), keep it as is for settings
          if (typeof value === 'string' && value.match(/\$\{.+\}/)) {
            const varName = value.match(/\$\{(.+)\}/)[1];
            newEnv[key] = `\${${varName}}`;
          } else {
            newEnv[key] = value;
          }
        }
        transformed[serverName].env = newEnv;
      }
    }

    return transformed;
  }

  /**
   * Convert Claude's allowed-tools (whitelist) to Gemini's excludeTools (blacklist)
   */
  _convertAllowedToolsToExclude(allowedTools) {
    // List of all available tools
    const allTools = [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Task',
      'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion',
      'SlashCommand', 'Skill', 'NotebookEdit', 'BashOutput', 'KillShell'
    ];

    // Normalize allowed tools to array
    let allowed = [];
    if (Array.isArray(allowedTools)) {
      allowed = allowedTools;
    } else if (typeof allowedTools === 'string') {
      allowed = allowedTools.split(',').map(t => t.trim());
    }

    // Calculate excluded tools
    const excluded = allTools.filter(tool => !allowed.includes(tool));

    // Generate exclude patterns
    // For Gemini, we can use simpler exclusions or keep it empty if minimal restrictions
    // Return empty array if most tools are allowed (simpler approach)
    if (excluded.length > allowed.length) {
      // If more tools are excluded than allowed, return exclude list
      return excluded;
    } else {
      // If more tools are allowed, we can't easily express this in Gemini
      // Return empty and add a warning
      this.metadata.warnings = this.metadata.warnings || [];
      this.metadata.warnings.push('Tool restrictions may not translate exactly - review excludeTools in gemini-extension.json');
      return [];
    }
  }

  /**
   * Infer settings schema from MCP server environment variables
   */
  _inferSettingsFromMCPConfig(mcpServers) {
    const settings = [];
    const seenVars = new Set();

    for (const [, config] of Object.entries(mcpServers)) {
      if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
          // Extract variable name from ${VAR} pattern
          if (typeof value === 'string' && value.match(/\$\{(.+)\}/)) {
            const varName = value.match(/\$\{(.+)\}/)[1];

            // Skip if already seen
            if (seenVars.has(varName)) continue;
            seenVars.add(varName);

            // Infer setting properties
            const setting = {
              name: varName,
              description: this._inferDescription(varName)
            };

            // Detect if it's a secret/password
            if (varName.toLowerCase().includes('password') ||
                varName.toLowerCase().includes('secret') ||
                varName.toLowerCase().includes('token') ||
                varName.toLowerCase().includes('key')) {
              setting.secret = true;
              setting.required = true;
            }

            // Add default values for common settings
            const defaults = this._inferDefaults(varName);
            if (defaults) {
              Object.assign(setting, defaults);
            }

            settings.push(setting);
          }
        }
      }
    }

    return settings;
  }

  /**
   * Infer description from variable name
   */
  _inferDescription(varName) {
    const descriptions = {
      'DB_HOST': 'Database server hostname',
      'DB_PORT': 'Database server port',
      'DB_NAME': 'Database name',
      'DB_USER': 'Database username',
      'DB_PASSWORD': 'Database password',
      'API_KEY': 'API authentication key',
      'API_SECRET': 'API secret',
      'API_URL': 'API endpoint URL',
      'HOST': 'Server hostname',
      'PORT': 'Server port'
    };

    if (descriptions[varName]) {
      return descriptions[varName];
    }

    // Generate description from variable name
    return varName.split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Infer default values for common variables
   */
  _inferDefaults(varName) {
    const defaults = {
      'DB_HOST': { default: 'localhost' },
      'DB_PORT': { default: '5432' },
      'HOST': { default: 'localhost' },
      'PORT': { default: '8080' },
      'API_URL': { default: 'https://api.example.com' }
    };

    return defaults[varName] || null;
  }

  /**
   * Generate GEMINI.md from SKILL.md content
   */
  async _generateGeminiContext() {
    const content = this.metadata.source.content;
    const frontmatter = this.metadata.source.frontmatter;

    // Build Gemini context with platform-specific introduction
    let geminiContent = `# ${frontmatter.name} - Gemini CLI Extension\n\n`;
    geminiContent += `${frontmatter.description}\n\n`;
    geminiContent += `## Quick Start\n\nAfter installation, you can use this extension by asking questions or giving commands naturally.\n\n`;

    // Add original content
    geminiContent += content;

    // Add footer
    geminiContent += `\n\n---\n\n`;
    geminiContent += `*This extension was converted from a Claude Code skill using [skill-porter](https://github.com/jduncan-rva/skill-porter)*\n`;

    // Write to file
    const outputPath = path.join(this.outputPath, 'GEMINI.md');
    await fs.writeFile(outputPath, geminiContent);

    return outputPath;
  }

  /**
   * Transform MCP configuration files
   */
  async _transformMCPConfiguration() {
    // Check if mcp-server directory exists
    const mcpDir = path.join(this.sourcePath, 'mcp-server');
    try {
      await fs.access(mcpDir);
      // MCP server exists and is already shared - no changes needed
    } catch {
      // No MCP server directory - this is okay
    }
  }

  /**
   * Ensure shared directory structure exists
   */
  async _ensureSharedStructure() {
    const sharedDir = path.join(this.outputPath, 'shared');

    try {
      await fs.access(sharedDir);
      // Directory exists
    } catch {
      // Create shared directory
      await fs.mkdir(sharedDir, { recursive: true });

      // Create placeholder files
      await fs.writeFile(
        path.join(sharedDir, 'reference.md'),
        '# Technical Reference\n\nDetailed API documentation and technical reference.\n'
      );
      await fs.writeFile(
        path.join(sharedDir, 'examples.md'),
        '# Usage Examples\n\nComprehensive usage examples and tutorials.\n'
      );
    }
  }
}

export default ClaudeToGeminiConverter;
