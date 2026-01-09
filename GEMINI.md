# skill-porter - Cross-Platform Skill Converter

Converts Claude Code skills to Gemini CLI native skills and vice versa. Use when the user wants to make a skill cross-platform compatible, port a skill between platforms, or create a universal skill that works on both Claude Code and Gemini CLI.

## What's New in v2.1

**Multi-Skill Plugin Support!** Convert entire Claude Code plugins with multiple skills, commands, and agents to Gemini CLI.

- **Multi-Skill Plugins**: Converts `skills/*/SKILL.md` directories with multiple skills
- **Commands Conversion**: Converts `commands/*.md` to Gemini's `commands/*.toml` format
- **Agents Conversion**: Converts `agents/*.md` to Gemini commands (Gemini has no native agents)
- **Plugin Metadata**: Reads `.claude-plugin/plugin.json` for name, version, repository

### Previous (v2.0)

- **Native Gemini Skills Support**: Generates SKILL.md files for Gemini CLI's Agent Skills feature
- **Bundled Skills**: Creates extension wrappers with bundled skills in `skills/<name>/SKILL.md`
- **Description Enhancement**: Auto-adds activation triggers for Gemini's skill discovery
- **Legacy Support**: Use `--legacy` flag for older Gemini CLI versions (generates GEMINI.md)

## Quick Start

```bash
# Convert Claude skill to Gemini (modern native skill format)
skill-porter convert ./my-claude-skill -t gemini

# Convert with legacy format (for older Gemini CLI)
skill-porter convert ./my-claude-skill -t gemini --legacy

# Convert Gemini extension to Claude
skill-porter convert ./my-gemini-extension -t claude

# Analyze a skill/extension
skill-porter analyze ./my-skill
```

# Skill Porter - Cross-Platform Skill Converter

This skill automates the conversion between Claude Code skills and Gemini CLI skills, enabling true cross-platform AI tool development.

## Core Capabilities

### Bidirectional Conversion

Convert skills and extensions between platforms while preserving functionality:

**Example requests:**
- "Convert this Claude skill to work with Gemini CLI"
- "Make my Gemini extension compatible with Claude Code"
- "Create a universal version of this skill that works on both platforms"
- "Port the database-helper skill to Gemini"

### Smart Platform Detection

Automatically analyzes directory structure to determine source platform:

**Detection criteria:**
- Claude (single skill): `SKILL.md` with YAML frontmatter at root
- Claude (multi-skill plugin): `skills/*/SKILL.md` directories + `.claude-plugin/plugin.json`
- Gemini (modern): `gemini-extension.json` + `skills/<name>/SKILL.md`
- Gemini (legacy): `gemini-extension.json` + `GEMINI.md` context file
- Universal: Has both platform configurations

**Example requests:**
- "What platform is this skill built for?"
- "Analyze this extension and tell me what needs to be converted"
- "Is this a Claude skill or Gemini extension?"

### Metadata Transformation

Intelligently converts between platform-specific formats:

**Conversions handled:**
- YAML frontmatter ↔ JSON manifest
- `allowed-tools` (whitelist) ↔ `excludeTools` (blacklist)
- Environment variables ↔ settings schema
- MCP server configuration paths
- Platform-specific documentation formats

**Example requests:**
- "Convert the metadata from this Claude skill to Gemini format"
- "Transform the allowed-tools list to Gemini's exclude pattern"
- "Generate a settings schema from these environment variables"

### MCP Server Preservation

Maintains Model Context Protocol server configurations across platforms:

**Example requests:**
- "Ensure the MCP server config works on both platforms"
- "Update the MCP server paths for Gemini's ${extensionPath} variable"
- "Validate that the MCP configuration is compatible"

### Validation & Quality Checks

Ensures converted output meets platform requirements:

**Validation checks:**
- Required files present (SKILL.md, gemini-extension.json, etc.)
- Valid YAML/JSON syntax
- Correct frontmatter structure
- MCP server paths resolve correctly
- Tool restrictions are valid
- Settings schema is complete

**Example requests:**
- "Validate this converted skill"
- "Check if this Gemini extension meets all requirements"
- "Is this conversion ready to install?"

## Conversion Process

When you request a conversion, I will:

1. **Analyze** the source directory structure
2. **Detect** which platform it's built for
3. **Extract** metadata, MCP configuration, and documentation
4. **Transform** the data to target platform format
5. **Generate** required files for target platform
6. **Validate** output meets all requirements
7. **Report** what was converted and any manual steps needed

## Platform Differences Handled

### File Structure
- **Claude (single)**: `SKILL.md` + `.claude-plugin/marketplace.json`
- **Claude (plugin)**: `skills/*/SKILL.md` + `commands/*.md` + `agents/*.md` + `.claude-plugin/plugin.json`
- **Gemini (modern)**: `gemini-extension.json` + `skills/<name>/SKILL.md` + `commands/*.toml`
- **Gemini (legacy)**: `gemini-extension.json` + `GEMINI.md`
- **Universal**: Both sets of files + shared documentation

### Metadata Format
- **Claude**: YAML frontmatter in SKILL.md (name, description, allowed-tools, subagents)
- **Gemini Skills**: YAML frontmatter in SKILL.md (name, description only)
- **Gemini Extensions**: JSON manifest for MCP servers, settings, excludeTools
- **Conversion**: Bidirectional transformation with format-appropriate placement

### Commands
- **Claude**: Markdown files in `commands/*.md` with YAML frontmatter
- **Gemini**: TOML files in `commands/*.toml` with `description` and `prompt` fields
- **Conversion**: Extracts frontmatter and content, generates TOML format

### Agents
- **Claude**: Markdown files in `agents/*.md` with name, description, model, and system prompt
- **Gemini**: No native agent system
- **Conversion**: Converts agents to commands that embed the agent's system prompt

### Tool Restrictions
- **Claude**: `allowed-tools` in SKILL.md frontmatter (whitelist)
- **Gemini**: `excludeTools` in gemini-extension.json (blacklist)
- **Conversion**: Logic inversion with intelligent mapping

### Configuration
- **Claude**: Environment variables (user sets before running)
- **Gemini**: Settings schema in extension (prompted during installation)
- **Conversion**: Infer schema from env vars or generate env var docs

### MCP Server Paths
- **Claude**: Relative paths from skill directory
- **Gemini**: Uses `${extensionPath}` variable substitution
- **Conversion**: Automatic path transformation

### Skill Discovery
- **Gemini**: Skills discovered from `.gemini/skills/`, `~/.gemini/skills/`, or bundled in extensions
- **Precedence**: Project > User > Extension skills

## Usage Examples

### Convert Claude Skill to Gemini (Modern Format)

```
User: "I have a Claude skill at ./database-helper. Convert it to Gemini."
Assistant: I'll analyze the skill and convert it to Gemini format...
- Detected Claude skill (found SKILL.md with frontmatter)
- Extracted metadata and MCP configuration
- Generated gemini-extension.json with MCP and settings
- Created skills/database-helper/SKILL.md (native Gemini skill)
- Enhanced description with activation triggers
- Transformed allowed-tools to excludeTools
✓ Conversion complete! Ready to install with: gemini extensions install ./database-helper
  Verify skill is discovered: gemini skills list
```

### Convert Multi-Skill Plugin (v2.1)

```
User: "Convert my Claude plugin to Gemini"
Assistant: I'll analyze and convert the multi-skill plugin...
- Detected Claude Code plugin (found skills/ directory + plugin.json)
- Found multiple skills in skills/*/SKILL.md
- Found commands in commands/*.md
- Found agents in agents/*.md
- Converting all skills to Gemini format
- Converting commands to TOML format
- Converting agents to commands (Gemini has no native agents)
✓ Conversion complete!
  - All skills in skills/*/SKILL.md
  - Commands in commands/*.toml (including converted agents)
  Install with: gemini extensions install ./my-plugin-gemini
```

### Convert Claude Skill to Gemini (Legacy Format)

```
User: "Convert to Gemini using legacy format"
Assistant: Converting with --legacy flag for older Gemini CLI versions...
- Detected Claude skill
- Generated gemini-extension.json and GEMINI.md (context file)
✓ Conversion complete! Works with older Gemini CLI versions
```

### Convert Gemini Extension to Claude

```
User: "Port my Gemini extension to Claude Code"
Assistant: I'll convert this Gemini extension to a Claude skill...
- Detected Gemini extension (found gemini-extension.json)
- Detected bundled skill in skills/ directory (if present)
- Extracted manifest and skill content
- Generated SKILL.md with YAML frontmatter
- Created .claude-plugin/marketplace.json
- Converted excludeTools to allowed-tools
✓ Conversion complete! Install with: cp -r ./extension ~/.claude/skills/
```

### Create Universal Skill

```
User: "Make this skill work on both platforms"
Assistant: I'll create a universal skill structure...
- Analyzing current configuration
- Generating both Claude and Gemini files
- Creating bundled Gemini skill in skills/ directory
- Moving shared content to shared/ directory
- Updating MCP server paths for both platforms
✓ Universal skill created! Works with both Claude Code and Gemini CLI
```

## Advanced Features

### Pull Request Generation

Create a PR to add dual-platform support to the parent repository:

**Example requests:**
- "Convert this skill and create a PR to add Gemini support"
- "Generate a pull request with the universal version"

### Fork and Dual Setup

Create a fork with both platform configurations:

**Example requests:**
- "Fork this repo and set it up for both platforms"
- "Create a dual-platform fork I can use with both CLIs"

### Validation Only

Check compatibility without converting:

**Example requests:**
- "Validate this skill's conversion to Gemini"
- "Check if this extension can be ported to Claude"
- "What needs to change to make this universal?"

## Configuration

This skill operates directly on filesystem directories and doesn't require external configuration. It uses:

- File system access to read and write skill/extension files
- Git operations for PR and fork features
- GitHub CLI (`gh`) for repository operations

## Safety Features

- **Non-destructive**: Creates new files, doesn't modify source unless explicitly requested
- **Validation**: Checks output before completion
- **Reporting**: Clear summary of changes made
- **Rollback friendly**: All changes are standard file operations

## Limitations

Some aspects may require manual review:

- **Session hooks**: Claude's `hooks/hooks.json` (SessionStart, etc.) have no Gemini equivalent
- Custom slash commands (platform-specific syntax)
- Complex MCP server configurations with multiple servers
- Platform-specific scripts that don't translate directly
- Edge cases in tool restriction mapping

These will be flagged in the conversion report.

## Technical Details

### Tool Restriction Conversion

**Claude → Gemini (Whitelist → Blacklist)**:
- Analyze allowed-tools list
- Generate exclude patterns for all other tools
- Special handling for wildcard permissions

**Gemini → Claude (Blacklist → Whitelist)**:
- List all available tools
- Remove excluded tools
- Generate allowed-tools list

### Settings Inference

When converting Claude → Gemini, environment variables in MCP config become settings:

```javascript
// MCP env var
"env": { "DB_HOST": "${DB_HOST}" }

// Becomes Gemini setting
"settings": [{
  "name": "DB_HOST",
  "description": "Database host",
  "default": "localhost"
}]
```

### Path Transformation

Claude uses relative paths, Gemini uses variables:

```javascript
// Claude
"args": ["mcp-server/index.js"]

// Gemini
"args": ["${extensionPath}/mcp-server/index.js"]
```

---

*For implementation details, see the repository at https://github.com/jduncan-rva/skill-porter*

---

*This extension was converted from a Claude Code skill using [skill-porter](https://github.com/jduncan-rva/skill-porter)*
