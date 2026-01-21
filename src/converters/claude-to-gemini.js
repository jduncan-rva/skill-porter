/**
 * Claude to Gemini Converter
 * Converts Claude Code skills to Gemini CLI extensions with bundled skills
 *
 * Output Structure (v2.0 - Native Skills):
 * ├── gemini-extension.json  (MCP, settings, excludeTools)
 * ├── skills/
 * │   └── <name>/
 * │       └── SKILL.md       (Native Gemini skill)
 * └── commands/*.toml
 *
 * Legacy Output (--legacy flag):
 * ├── gemini-extension.json
 * ├── GEMINI.md              (Context file)
 * └── commands/*.toml
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ClaudeToGeminiConverter {
  constructor(sourcePath, outputPath, options = {}) {
    this.sourcePath = sourcePath;
    this.outputPath = outputPath || sourcePath;
    this.options = {
      legacy: false,  // Use legacy GEMINI.md format
      ...options
    };
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
      // Ensure output directory exists
      await fs.mkdir(this.outputPath, { recursive: true });

      // Step 1: Extract metadata from Claude skill
      await this._extractClaudeMetadata();

      // Step 2: Generate gemini-extension.json
      const manifestPath = await this._generateGeminiManifest();
      result.files.push(manifestPath);

      // Step 3: Generate skill or context based on mode
      if (this.options.legacy) {
        // Legacy mode: Generate GEMINI.md (context file)
        const contextPath = await this._generateGeminiContext();
        result.files.push(contextPath);
      } else {
        // Modern mode: Generate bundled skill in skills/<name>/SKILL.md
        const skillPaths = await this._generateGeminiSkill();
        // Handle both single path (string) and multi-skill (array) returns
        if (Array.isArray(skillPaths)) {
          result.files.push(...skillPaths);
        } else {
          result.files.push(skillPaths);
        }
      }

      // Step 4: Generate Custom Commands (from Subagents & Slash Commands)
      const commandFiles = await this._generateCommands();
      result.files.push(...commandFiles);

      // Step 5: Transform MCP server configuration
      await this._transformMCPConfiguration();

      // Step 6: Create shared directory structure
      await this._ensureSharedStructure();

      // Step 7: Inject Documentation
      await this._injectDocs();

      result.success = true;
      result.metadata = this.metadata;
      result.format = this.options.legacy ? 'legacy' : 'native-skill';
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Extract metadata from Claude skill files
   * Supports both single-skill and multi-skill (plugin) layouts
   */
  async _extractClaudeMetadata() {
    // Check for multi-skill directory (e.g., superpowers plugin)
    const skillsDir = path.join(this.sourcePath, 'skills');
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      this.metadata.source.multiSkill = true;
      this.metadata.source.skills = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
          try {
            const content = await fs.readFile(skillPath, 'utf8');
            const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
            if (match) {
              const frontmatter = yaml.load(match[1]);
              this.metadata.source.skills.push({
                name: frontmatter.name || entry.name,
                description: frontmatter.description || '',
                content: match[2],
                frontmatter
              });
            }
          } catch { /* Skip invalid skills */ }
        }
      }

      // For multi-skill, use first skill or plugin metadata for main frontmatter
      if (this.metadata.source.skills.length > 0) {
        const firstSkill = this.metadata.source.skills[0];
        this.metadata.source.frontmatter = {
          name: firstSkill.frontmatter?.name || firstSkill.name,
          description: `Multi-skill plugin with ${this.metadata.source.skills.length} skills`
        };
        this.metadata.source.content = '';
      } else {
        // No valid skills found in skills/ directory, fall back to single-skill mode
        this.metadata.source.multiSkill = false;
      }
    } catch {
      this.metadata.source.multiSkill = false;
    }

    // If not multi-skill, try single SKILL.md at root
    if (!this.metadata.source.multiSkill) {
      const skillPath = path.join(this.sourcePath, 'SKILL.md');
      try {
        const content = await fs.readFile(skillPath, 'utf8');
        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
        if (!frontmatterMatch) {
          throw new Error('SKILL.md missing YAML frontmatter');
        }

        const frontmatter = yaml.load(frontmatterMatch[1]);
        this.metadata.source.frontmatter = frontmatter;
        this.metadata.source.content = content.replace(/^---\n[\s\S]+?\n---\n/, '');

        if (frontmatter.subagents) {
          this.metadata.source.subagents = frontmatter.subagents;
        }
      } catch (err) {
        if (!this.metadata.source.multiSkill) {
          throw new Error('No SKILL.md found at root and no skills/ directory');
        }
      }
    }

    // Extract Claude slash commands from either location
    this.metadata.source.commands = [];

    // Check root commands/ directory first (superpowers style)
    let commandsDir = path.join(this.sourcePath, 'commands');
    try {
      await fs.access(commandsDir);
    } catch {
      // Fall back to .claude/commands/
      commandsDir = path.join(this.sourcePath, '.claude', 'commands');
    }

    try {
      const files = await fs.readdir(commandsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const cmdPath = path.join(commandsDir, file);
          const cmdContent = await fs.readFile(cmdPath, 'utf8');
          this.metadata.source.commands.push({
            name: path.basename(file, '.md'),
            content: cmdContent
          });
        }
      }
    } catch {
      // No commands directory
    }

    // Extract agents from agents/ directory
    await this._extractAgents();

    // Extract from plugin.json if it exists
    const pluginJsonPath = path.join(this.sourcePath, '.claude-plugin', 'plugin.json');
    try {
      const pluginContent = await fs.readFile(pluginJsonPath, 'utf8');
      this.metadata.source.plugin = JSON.parse(pluginContent);

      // Use plugin metadata for name/version if available
      if (this.metadata.source.plugin.name) {
        this.metadata.source.frontmatter.name = this.metadata.source.plugin.name;
      }
    } catch { /* Optional */ }

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
   * Extract agents from agents/ directory
   * Agents will be converted to Gemini commands
   */
  async _extractAgents() {
    const agentsDir = path.join(this.sourcePath, 'agents');
    this.metadata.source.agents = [];

    try {
      const files = await fs.readdir(agentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const agentPath = path.join(agentsDir, file);
          const content = await fs.readFile(agentPath, 'utf8');
          const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);

          if (match) {
            const fm = yaml.load(match[1]);
            this.metadata.source.agents.push({
              name: fm.name || path.basename(file, '.md'),
              description: fm.description || '',
              model: fm.model,
              content: match[2].trim()
            });
          }
        }
      }
    } catch { /* No agents directory */ }
  }

  /**
   * Generate gemini-extension.json
   */
  async _generateGeminiManifest() {
    const frontmatter = this.metadata.source.frontmatter;
    const marketplace = this.metadata.source.marketplace;
    const plugin = this.metadata.source.plugin;

    // Build the manifest - prefer plugin metadata, then marketplace, then frontmatter
    const manifest = {
      name: plugin?.name || frontmatter.name,
      version: plugin?.version || marketplace?.metadata?.version || '1.0.0',
      description: this.metadata.source.multiSkill
        ? `${frontmatter.description} Skills: ${this.metadata.source.skills.map(s => s.name).join(', ')}`
        : (frontmatter.description || marketplace?.plugins?.[0]?.description || '')
    };

    // Add repository if available
    if (plugin?.repository) {
      manifest.repository = plugin.repository;
    }

    // Always include contextFileName - Gemini CLI requires it
    manifest.contextFileName = 'GEMINI.md';

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
   * Generate native Gemini skill in skills/<name>/SKILL.md
   * This creates a bundled skill that Gemini CLI will discover
   * Supports both single-skill and multi-skill layouts
   */
  async _generateGeminiSkill() {
    const generatedPaths = [];

    // Multi-skill mode: convert each skill from skills/ directory
    if (this.metadata.source.multiSkill && this.metadata.source.skills?.length > 0) {
      for (const skill of this.metadata.source.skills) {
        const skillDir = path.join(this.outputPath, 'skills', skill.name);
        await fs.mkdir(skillDir, { recursive: true });

        // Clean up description - remove surrounding quotes if present
        let description = skill.description || '';
        if (description.startsWith('"') && description.endsWith('"')) {
          description = description.slice(1, -1);
        }

        const formattedDescription = this._formatYamlDescription(description);
        let skillContent = `---\nname: ${skill.name}\ndescription:\n${formattedDescription}\n---\n\n`;
        skillContent += skill.content;
        skillContent += `\n\n---\n\n*Converted from Claude Code skill using [skill-porter](https://github.com/jduncan-rva/skill-porter)*\n`;

        const outputPath = path.join(skillDir, 'SKILL.md');
        await fs.writeFile(outputPath, skillContent);
        generatedPaths.push(outputPath);
      }

      return generatedPaths;
    }

    // Single-skill mode (original behavior)
    const content = this.metadata.source.content;
    const frontmatter = this.metadata.source.frontmatter;
    const subagents = this.metadata.source.subagents || [];
    const commands = this.metadata.source.commands || [];

    // Create skills/<name>/ directory
    const skillName = frontmatter.name;
    const skillDir = path.join(this.outputPath, 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });

    // Enhance description with activation triggers
    const enhancedDescription = this._enhanceDescription(
      frontmatter.description,
      skillName
    );

    // Build SKILL.md with frontmatter (Gemini only supports name + description)
    // Use multi-line format for description to avoid parsing errors with long strings
    const formattedDescription = this._formatYamlDescription(enhancedDescription);
    let skillContent = `---\nname: ${skillName}\ndescription:\n${formattedDescription}\n---\n\n`;

    // Add the original skill content
    skillContent += content;

    // Add commands reference section if there are subagents or commands
    if (subagents.length > 0 || commands.length > 0) {
      skillContent += `\n\n## Available Commands\n\n`;
      skillContent += `The following custom commands are available with this skill:\n\n`;

      for (const agent of subagents) {
        skillContent += `- \`/${agent.name}\` - ${agent.description || 'Activate ' + agent.name + ' agent'}\n`;
      }

      for (const cmd of commands) {
        skillContent += `- \`/${cmd.name}\` - Custom command\n`;
      }
    }

    // Add footer attribution
    skillContent += `\n\n---\n\n`;
    skillContent += `*This skill was converted from a Claude Code skill using [skill-porter](https://github.com/jduncan-rva/skill-porter)*\n`;

    // Write SKILL.md
    const outputPath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(outputPath, skillContent);

    return outputPath;
  }

  /**
   * Enhance description with trigger phrases for Gemini's discovery system
   * Gemini uses the description to decide when to activate a skill
   */
  _enhanceDescription(description, name) {
    // Don't modify if already has trigger phrase
    if (description.toLowerCase().includes('use when')) {
      return description;
    }

    // Extract action keywords from skill name
    const actions = this._inferActionsFromName(name);

    // Build trigger phrase
    let triggers;
    if (actions.length > 0) {
      triggers = `Use when the user asks to ${actions.join(', ')}.`;
    } else {
      // Generate generic trigger from name
      const readableName = name.replace(/-/g, ' ');
      triggers = `Use when the user needs ${readableName} functionality.`;
    }

    return `${description} ${triggers}`;
  }

  /**
   * Format description for YAML folded block scalar
   * Wraps text at ~70 chars with proper indentation
   */
  _formatYamlDescription(description) {
    const maxLineLength = 70;
    const words = description.split(' ');
    const lines = [];
    let currentLine = '  '; // 2-space indent for YAML block

    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxLineLength) {
        lines.push(currentLine);
        currentLine = '  ' + word;
      } else {
        currentLine += (currentLine === '  ' ? '' : ' ') + word;
      }
    }
    lines.push(currentLine);

    return lines.join('\n');
  }

  /**
   * Convert string to kebab-case for filenames
   * @param {string} str - The string to convert
   * @returns {string} - kebab-case string
   */
  _toKebabCase(str) {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase -> camel-Case
      .replace(/[\s_]+/g, '-')              // spaces/underscores -> hyphens
      .replace(/[^a-zA-Z0-9-]/g, '')        // remove special chars
      .toLowerCase();
  }

  /**
   * Infer action phrases from skill name
   */
  _inferActionsFromName(name) {
    const lowerName = name.toLowerCase();

    // Map common skill name patterns to action phrases
    const patterns = {
      'reviewer': ['review code', 'check for bugs', 'analyze code quality'],
      'review': ['review', 'check', 'analyze'],
      'formatter': ['format code', 'clean up formatting', 'style code'],
      'format': ['format', 'style', 'prettify'],
      'debugger': ['debug issues', 'fix errors', 'troubleshoot problems'],
      'debug': ['debug', 'fix bugs', 'troubleshoot'],
      'auditor': ['audit', 'analyze for issues', 'check compliance'],
      'audit': ['audit', 'check', 'verify'],
      'generator': ['generate', 'create', 'scaffold'],
      'tester': ['test', 'write tests', 'validate'],
      'test': ['test', 'validate', 'verify'],
      'linter': ['lint', 'check style', 'find issues'],
      'lint': ['lint', 'check style'],
      'builder': ['build', 'compile', 'construct'],
      'build': ['build', 'compile'],
      'deployer': ['deploy', 'release', 'publish'],
      'deploy': ['deploy', 'release'],
      'documenter': ['document', 'generate docs', 'write documentation'],
      'doc': ['document', 'create documentation'],
      'migrator': ['migrate', 'upgrade', 'convert'],
      'migrate': ['migrate', 'upgrade'],
      'optimizer': ['optimize', 'improve performance', 'speed up'],
      'optimize': ['optimize', 'improve'],
      'refactor': ['refactor', 'restructure', 'improve code'],
      'security': ['check security', 'find vulnerabilities', 'audit security'],
      'api': ['work with APIs', 'make API calls', 'integrate APIs'],
      'database': ['work with databases', 'query data', 'manage data'],
      'porter': ['port', 'convert', 'transform'],
    };

    for (const [pattern, actions] of Object.entries(patterns)) {
      if (lowerName.includes(pattern)) {
        return actions;
      }
    }

    return [];
  }

  /**
   * Generate Gemini Custom Commands
   * Converts Claude subagents, commands, and standalone agents to TOML
   */
  async _generateCommands() {
    const generatedFiles = [];
    const commandsDir = path.join(this.outputPath, 'commands');

    // Ensure commands directory exists if we have content
    const subagents = this.metadata.source.subagents || [];
    const commands = this.metadata.source.commands || [];
    const agents = this.metadata.source.agents || [];

    if (subagents.length === 0 && commands.length === 0 && agents.length === 0) {
      return generatedFiles;
    }

    await fs.mkdir(commandsDir, { recursive: true });

    // Convert Subagents (from frontmatter) -> Commands
    for (const agent of subagents) {
      const tomlContent = `description = "Activate ${agent.name} agent"

# Agent Persona: ${agent.name}
# Auto-generated from Claude Subagent
prompt = """
You are acting as the '${agent.name}' agent.
${agent.description || ''}

User Query: {{args}}
"""
`;
      const filePath = path.join(commandsDir, `${agent.name}.toml`);
      await fs.writeFile(filePath, tomlContent);
      generatedFiles.push(filePath);
    }

    // Convert standalone agents (from agents/ directory) -> Commands
    for (const agent of agents) {
      // Escape description for TOML
      const escapedDescription = (agent.description || (agent.name ? `${agent.name} agent` : 'Custom agent'))
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .substring(0, 200); // Truncate long descriptions

      const tomlContent = `description = "${escapedDescription}"

# Converted from Claude Code agent: ${agent.name}
# Original model: ${agent.model || 'inherit'}
prompt = """
${agent.content}

User request: {{args}}
"""
`;
      const filePath = path.join(commandsDir, `${agent.name}.toml`);
      await fs.writeFile(filePath, tomlContent);
      generatedFiles.push(filePath);
    }

    // Convert Claude Commands -> Gemini Commands
    for (const cmd of commands) {
      // Extract frontmatter from command if present
      const match = cmd.content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
      let description = `Custom command: ${cmd.name}`;
      let prompt = cmd.content;

      if (match) {
        try {
          const fm = yaml.load(match[1]);
          if (fm.description) {
            // Escape description for TOML
            description = fm.description
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, ' ');
          }
          prompt = match[2] || ''; // Content without frontmatter
        } catch (e) {
          // Fallback if YAML invalid
        }
      }

      // Convert arguments syntax
      // Claude: $ARGUMENTS, $1, etc. -> Gemini: {{args}}
      prompt = prompt.replace(/\$ARGUMENTS/g, '{{args}}')
                     .replace(/\$\d+/g, '{{args}}');

      const tomlContent = `description = "${description}"

prompt = """
${prompt.trim()}
"""
`;
      const filePath = path.join(commandsDir, `${cmd.name}.toml`);
      await fs.writeFile(filePath, tomlContent);
      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  /**
   * Inject Architecture Documentation
   */
  async _injectDocs() {
    const docsDir = path.join(this.outputPath, 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    // Resolve template path relative to this module (works when installed globally)
    const templatePath = path.join(__dirname, '..', 'templates', 'GEMINI_ARCH_GUIDE.md');
    const destPath = path.join(docsDir, 'GEMINI_ARCHITECTURE.md');

    try {
      const content = await fs.readFile(templatePath, 'utf8');
      await fs.writeFile(destPath, content);
    } catch (error) {
      // Fallback if template missing (e.g. in dev environment vs prod)
      await fs.writeFile(destPath, '# Gemini Architecture\n\nSee online documentation.');
    }
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
      const referenceContent = `# Technical Reference

## Architecture
For detailed extension architecture, please refer to \`docs/GEMINI_ARCHITECTURE.md\` (in Gemini extensions) or the \`SKILL.md\` structure (in Claude Skills).

## Platform Differences
- **Commands:**
  - Gemini uses \`commands/*.toml\`
  - Claude uses \`.claude/commands/*.md\`
- **Agents:**
  - Gemini "Agents" are implemented as Custom Commands.
  - Claude "Subagents" are defined in \`SKILL.md\` frontmatter.
`;
      await fs.writeFile(
        path.join(sharedDir, 'reference.md'),
        referenceContent
      );

      await fs.writeFile(
        path.join(sharedDir, 'examples.md'),
        '# Usage Examples\n\nComprehensive usage examples and tutorials.\n'
      );
    }
  }
}

export default ClaudeToGeminiConverter;
