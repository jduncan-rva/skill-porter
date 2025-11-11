/**
 * Gemini to Claude Converter
 * Converts Gemini CLI extensions to Claude Code skills
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export class GeminiToClaudeConverter {
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
      // Step 1: Extract metadata from Gemini extension
      await this._extractGeminiMetadata();

      // Step 2: Generate SKILL.md
      const skillPath = await this._generateClaudeSkill();
      result.files.push(skillPath);

      // Step 3: Generate .claude-plugin/marketplace.json
      const marketplacePath = await this._generateMarketplaceJSON();
      result.files.push(marketplacePath);

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
   * Extract metadata from Gemini extension files
   */
  async _extractGeminiMetadata() {
    // Extract from gemini-extension.json
    const manifestPath = path.join(this.sourcePath, 'gemini-extension.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    this.metadata.source.manifest = JSON.parse(manifestContent);

    // Extract from GEMINI.md or custom context file
    const contextFileName = this.metadata.source.manifest.contextFileName || 'GEMINI.md';
    const contextPath = path.join(this.sourcePath, contextFileName);

    try {
      const content = await fs.readFile(contextPath, 'utf8');
      this.metadata.source.content = content;
    } catch {
      // Context file is optional
      this.metadata.source.content = '';
    }
  }

  /**
   * Generate SKILL.md with YAML frontmatter
   */
  async _generateClaudeSkill() {
    const manifest = this.metadata.source.manifest;
    const content = this.metadata.source.content;

    // Build frontmatter
    const frontmatter = {
      name: manifest.name,
      description: manifest.description
    };

    // Convert excludeTools to allowed-tools
    if (manifest.excludeTools && manifest.excludeTools.length > 0) {
      frontmatter['allowed-tools'] = this._convertExcludeToAllowedTools(manifest.excludeTools);
    }

    // Convert frontmatter to YAML
    const yamlFrontmatter = yaml.dump(frontmatter, {
      lineWidth: -1, // Disable line wrapping
      noArrayIndent: false
    });

    // Build SKILL.md content
    let skillContent = `---\n${yamlFrontmatter}---\n\n`;

    // Add title and description
    skillContent += `# ${manifest.name} - Claude Code Skill\n\n`;
    skillContent += `${manifest.description}\n\n`;

    // Add original content (without Gemini-specific header if present)
    let cleanContent = content;

    // Remove Gemini-specific headers
    cleanContent = cleanContent.replace(/^#\s+.+?\s+-\s+Gemini CLI Extension\n\n/m, '');
    cleanContent = cleanContent.replace(/##\s+Quick Start[\s\S]+?After installation.+?\n\n/m, '');

    // Remove conversion footer if present
    cleanContent = cleanContent.replace(/\n---\n\n\*This extension was converted.+?\*\n$/s, '');

    // Add environment variable configuration section if there are settings
    if (manifest.settings && manifest.settings.length > 0) {
      skillContent += `## Configuration\n\nThis skill requires the following environment variables:\n\n`;

      for (const setting of manifest.settings) {
        skillContent += `- \`${setting.name}\`: ${setting.description}`;
        if (setting.default) {
          skillContent += ` (default: ${setting.default})`;
        }
        if (setting.required) {
          skillContent += ` **(required)**`;
        }
        skillContent += `\n`;
      }

      skillContent += `\nSet these in your environment or Claude Code configuration.\n\n`;
    }

    // Add cleaned content
    if (cleanContent.trim()) {
      skillContent += cleanContent.trim() + '\n\n';
    } else {
      // Generate basic usage section if no content
      skillContent += `## Usage\n\nUse this skill when you need ${manifest.description.toLowerCase()}.\n\n`;
    }

    // Add footer
    skillContent += `---\n\n`;
    skillContent += `*This skill was converted from a Gemini CLI extension using [skill-porter](https://github.com/jduncan-rva/skill-porter)*\n`;

    // Write to file
    const outputPath = path.join(this.outputPath, 'SKILL.md');
    await fs.writeFile(outputPath, skillContent);

    return outputPath;
  }

  /**
   * Convert Gemini's excludeTools (blacklist) to Claude's allowed-tools (whitelist)
   */
  _convertExcludeToAllowedTools(excludeTools) {
    // List of all available tools
    const allTools = [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Task',
      'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion',
      'SlashCommand', 'Skill', 'NotebookEdit', 'BashOutput', 'KillShell'
    ];

    // Calculate allowed tools (all tools minus excluded)
    const allowed = allTools.filter(tool => !excludeTools.includes(tool));

    return allowed;
  }

  /**
   * Generate .claude-plugin/marketplace.json
   */
  async _generateMarketplaceJSON() {
    const manifest = this.metadata.source.manifest;

    // Build marketplace.json
    const marketplace = {
      name: `${manifest.name}-marketplace`,
      owner: {
        name: 'Skill Porter User',
        email: 'user@example.com'
      },
      metadata: {
        description: manifest.description,
        version: manifest.version || '1.0.0'
      },
      plugins: [
        {
          name: manifest.name,
          description: manifest.description,
          source: '.',
          strict: false,
          author: 'Converted from Gemini',
          repository: {
            type: 'git',
            url: `https://github.com/user/${manifest.name}`
          },
          license: 'MIT',
          keywords: this._extractKeywords(manifest.description),
          category: 'general',
          tags: [],
          skills: ['.']
        }
      ]
    };

    // Add MCP servers configuration if present
    if (manifest.mcpServers) {
      marketplace.plugins[0].mcpServers = this._transformMCPServersForClaude(manifest.mcpServers, manifest.settings);
    }

    // Create .claude-plugin directory
    const claudePluginDir = path.join(this.outputPath, '.claude-plugin');
    await fs.mkdir(claudePluginDir, { recursive: true });

    // Write to file
    const outputPath = path.join(claudePluginDir, 'marketplace.json');
    await fs.writeFile(outputPath, JSON.stringify(marketplace, null, 2));

    return outputPath;
  }

  /**
   * Transform MCP servers configuration for Claude
   */
  _transformMCPServersForClaude(mcpServers, settings) {
    const transformed = {};

    for (const [serverName, config] of Object.entries(mcpServers)) {
      transformed[serverName] = {
        ...config
      };

      // Transform args to remove ${extensionPath}
      if (config.args) {
        transformed[serverName].args = config.args.map(arg => {
          // Remove ${extensionPath}/ prefix
          return arg.replace(/\$\{extensionPath\}\//g, '');
        });
      }

      // Transform env to use ${VAR} pattern
      if (config.env) {
        const newEnv = {};
        for (const [key, value] of Object.entries(config.env)) {
          // If it uses a settings variable, convert to ${VAR}
          if (typeof value === 'string' && value.match(/\$\{.+\}/)) {
            newEnv[key] = value; // Keep as is
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
   * Extract keywords from description
   */
  _extractKeywords(description) {
    // Simple keyword extraction
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'to', 'from', 'in', 'on'];
    const words = description.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 5);

    return words;
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

export default GeminiToClaudeConverter;
