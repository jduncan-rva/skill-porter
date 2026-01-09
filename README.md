# Skill Porter

Universal tool to convert Claude Code skills to Gemini CLI native skills and vice versa.

## What's New in v2.1

**Multi-Skill Plugin Support!** Convert entire Claude Code plugins with multiple skills, commands, and agents to Gemini CLI.

- **Multi-Skill Plugins**: Convert `skills/*/SKILL.md` directories with multiple skills
- **Commands Conversion**: Converts `commands/*.md` to Gemini's `commands/*.toml` format
- **Agents Conversion**: Converts `agents/*.md` to Gemini commands (Gemini has no native agents)
- **Plugin Metadata**: Reads `.claude-plugin/plugin.json` for name, version, repository

## What's New in v2.0

**Native Gemini Skills Support!** Gemini CLI now supports Agent Skills using `SKILL.md` files - nearly identical to Claude's format. Skill Porter v2.0 generates native Gemini skills instead of legacy context files.

- **Native Skills**: Creates `skills/<name>/SKILL.md` for Gemini's new Agent Skills feature
- **Extension Wrapper**: Bundles skills with MCP servers, settings, and tool restrictions
- **Auto-Enhanced Descriptions**: Adds activation triggers for Gemini's skill discovery
- **Legacy Support**: `--legacy` flag for older Gemini CLI versions

## Overview

Skill Porter automates the conversion between Claude Code skills and Gemini CLI skills, enabling developers to write once and deploy to both platforms with minimal effort.

### Key Features

- **Bidirectional Conversion**: Claude → Gemini and Gemini → Claude
- **Native Gemini Skills**: Creates `SKILL.md` files that Gemini discovers as active agent skills
- **Smart Analysis**: Automatically detects source platform and format (modern vs legacy)
- **Metadata Transformation**: YAML frontmatter ↔ JSON manifest conversion
- **MCP Integration**: Preserves Model Context Protocol server configurations
- **Configuration Mapping**: Converts between environment variables and settings schemas
- **Tool Restriction Conversion**: Transforms allowed-tools (allowlist) ↔ excludeTools (denylist)
- **Validation**: Ensures output meets platform requirements
- **Optional Features**: PR generation, fork setup, migration tools

## Installation

```bash
npm install -g skill-porter
```

Or use directly with npx:

```bash
npx skill-porter convert ./my-skill --to gemini
```

## Quick Start

### Convert Claude Skill to Gemini (Native Skill Format)

```bash
# Creates skills/<name>/SKILL.md + gemini-extension.json
skill-porter convert ./my-claude-skill --to gemini --output ./my-gemini-extension
```

### Convert Claude Skill to Gemini (Legacy Format)

```bash
# Creates GEMINI.md + gemini-extension.json (for older Gemini CLI)
skill-porter convert ./my-claude-skill --to gemini --legacy --output ./my-gemini-extension
```

### Convert Gemini Extension to Claude Skill

```bash
skill-porter convert ./my-gemini-extension --to claude --output ./my-claude-skill
```

### Validate Conversion

```bash
skill-porter validate ./my-converted-skill
```

## Usage

### As a CLI Tool

```bash
# Basic conversion
skill-porter convert <source-path> --to <claude|gemini>

# With output directory
skill-porter convert ./source --to gemini --output ./destination

# Analyze without converting
skill-porter analyze ./skill-or-extension

# Validate existing skill/extension
skill-porter validate ./path

# Make universal (works on both platforms)
skill-porter universal ./my-skill

# Create PR to add dual-platform support
skill-porter create-pr ./my-skill --to gemini

# Fork with dual-platform setup
skill-porter fork ./my-skill --location ~/my-forks/skill-name
```

### As a Universal Skill/Extension

skill-porter itself works on both platforms!

**Claude Code:**
```bash
# Install as skill
git clone https://github.com/jduncan-rva/skill-porter ~/.claude/skills/skill-porter
cd ~/.claude/skills/skill-porter
npm install
```

Then in Claude Code:
```
"Convert my skill at ./my-skill to Gemini extension"
"Make this Claude skill compatible with Gemini CLI"
```

**Gemini CLI:**
```bash
gemini extensions install https://github.com/jduncan-rva/skill-porter
```

Then in Gemini:
```
"Port this skill to work with Claude Code"
"Create a universal version of this extension"
```

## Architecture

Skill Porter leverages the fact that both platforms use the Model Context Protocol (MCP), achieving ~85% code reuse:

```
Shared Components (85%):
├── MCP Server (100% reusable)
├── Documentation (85% reusable)
├── Scripts & Dependencies (100% reusable)

Platform-Specific (15%):
├── Claude: SKILL.md + .claude-plugin/marketplace.json
└── Gemini: skills/<name>/SKILL.md + gemini-extension.json
```

### Output Structures

**Claude Skill (Single):**
```
my-skill/
├── SKILL.md                    # Skill definition with YAML frontmatter
├── .claude-plugin/
│   └── marketplace.json        # MCP servers, metadata
└── .claude/commands/*.md       # Custom commands
```

**Claude Plugin (Multi-Skill):**
```
my-plugin/
├── .claude-plugin/
│   ├── plugin.json             # Plugin metadata (name, version)
│   └── marketplace.json        # MCP servers, metadata
├── skills/
│   ├── skill-one/SKILL.md
│   └── skill-two/SKILL.md
├── commands/*.md               # Custom commands
└── agents/*.md                 # Named agents
```

**Gemini Extension (v2.1 - Multi-Skill):**
```
my-extension/
├── gemini-extension.json       # MCP servers, settings, excludeTools
├── skills/
│   ├── skill-one/SKILL.md
│   └── skill-two/SKILL.md
└── commands/*.toml             # Custom commands (including converted agents)
```

**Gemini Extension (Legacy):**
```
my-extension/
├── gemini-extension.json       # MCP servers, settings, excludeTools
├── GEMINI.md                   # Context file (passive)
└── commands/*.toml             # Custom commands
```

### Conversion Process

1. **Detect**: Analyze source to determine platform
2. **Extract**: Parse metadata, MCP config, documentation
3. **Transform**: Convert between platform formats
4. **Generate**: Create target platform files
5. **Validate**: Ensure output meets requirements

## Platform Mapping

| Claude Code | Gemini CLI (v2.1) | Transformation |
|-------------|-------------------|----------------|
| `SKILL.md` frontmatter | `skills/<name>/SKILL.md` frontmatter | YAML → YAML (simplified) |
| `SKILL.md` content | `skills/<name>/SKILL.md` content | Direct copy + enhancements |
| `skills/*/SKILL.md` | `skills/*/SKILL.md` | Multi-skill conversion |
| `commands/*.md` | `commands/*.toml` | Markdown → TOML |
| `agents/*.md` | `commands/*.toml` | Agent → Command |
| `allowed-tools` (whitelist) | `excludeTools` in extension.json | Logic inversion |
| `.claude-plugin/plugin.json` | `gemini-extension.json` | Name, version, repo |
| `.claude-plugin/marketplace.json` | `gemini-extension.json` | JSON restructure |
| Environment variables | `settings[]` in extension.json | Schema inference |
| Subagents (frontmatter) | `commands/*.toml` | Format conversion |

**Note**: Claude's `allowed-tools` and Gemini's `excludeTools` are placed in different files:
- Claude: In `SKILL.md` YAML frontmatter
- Gemini: In `gemini-extension.json` (not in skill frontmatter)

**Note**: Gemini CLI doesn't have native agents. Claude agents are converted to Gemini commands that embed the agent's system prompt.

## Examples

See the `examples/` directory for complete working examples with before/after comparisons.

### Example 1: Code Formatter (Claude → Gemini)

**Before** (Claude skill):
- `SKILL.md` with YAML frontmatter
- Allowed tools: Read, Write, Bash
- MCP server with environment variables

**After** (Gemini extension):
```bash
skill-porter convert examples/simple-claude-skill --to gemini
```
- `gemini-extension.json` with manifest
- Excluded tools: All except Read, Write, Bash
- Settings schema inferred from env vars
- MCP paths use `${extensionPath}`

### Example 2: API Connector (Gemini → Claude)

**Before** (Gemini extension):
- `gemini-extension.json` with settings
- Excluded tools: Bash, Edit, Write
- Secret settings for API keys

**After** (Claude skill):
```bash
skill-porter convert examples/api-connector-gemini --to claude
```
- `SKILL.md` with YAML frontmatter
- Allowed tools: All except Bash, Edit, Write
- Environment variable documentation generated
- `.claude-plugin/marketplace.json` created

### Example 3: Multi-Skill Plugin (Claude → Gemini)

**Before** (Claude plugin with multiple skills):
- Multiple skills in `skills/*/SKILL.md`
- Commands in `commands/*.md`
- Agents in `agents/*.md`
- Plugin metadata in `.claude-plugin/plugin.json`

**After** (Gemini extension):
```bash
skill-porter convert ./my-plugin --to gemini --output ./my-plugin-gemini
```
- All skills converted to `skills/*/SKILL.md`
- Commands converted to `commands/*.toml`
- Agents converted to commands (Gemini has no native agents)
- Extension manifest with plugin metadata

### Example 4: Universal Conversion

**skill-porter itself** is universal - it converted itself!

```bash
cd skill-porter
skill-porter analyze .
# Result: Platform: universal (high confidence)
```

See `examples/README.md` for detailed before/after comparisons and conversion explanations.

## Optional Features

### Generate Pull Request

Automatically create a PR to add dual-platform support to a repository:

```bash
# Convert and create PR in one step
skill-porter create-pr ./my-skill --to gemini

# Options
skill-porter create-pr ./my-skill \
  --to gemini \
  --base main \
  --remote origin \
  --draft  # Create as draft PR
```

**What it does:**
1. Converts the skill/extension to target platform
2. Creates a new branch (`skill-porter/add-dual-platform-support`)
3. Commits changes with detailed commit message
4. Pushes to remote
5. Creates PR with comprehensive description

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Git repository with remote configured

**PR includes:**
- ✅ Complete description of changes
- ✅ Benefits explanation
- ✅ Testing checklist
- ✅ Installation instructions for both platforms
- ✅ Link to skill-porter documentation

### Fork and Setup

Create a fork with dual-platform configuration ready for development:

```bash
skill-porter fork ./my-skill --location ~/my-forks/skill-name
```

**What it does:**
1. Creates fork directory at specified location
2. Copies or clones the repository
3. Ensures both Claude and Gemini configurations exist
4. Sets up symlinks for Claude Code (if applicable)
5. Provides installation instructions for Gemini CLI

**Use cases:**
- Maintain separate development fork
- Test on both platforms simultaneously
- Contribute dual-platform support to external repos

## Development

```bash
# Clone repository
git clone https://github.com/jduncan-rva/skill-porter
cd skill-porter

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Project Structure

```
skill-porter/
├── src/
│   ├── index.js              # Main entry point
│   ├── cli.js                # CLI interface
│   ├── analyzers/
│   │   ├── detector.js       # Platform detection
│   │   └── validator.js      # Output validation
│   ├── converters/
│   │   ├── claude-to-gemini.js
│   │   ├── gemini-to-claude.js
│   │   └── shared.js         # Shared conversion logic
│   ├── templates/
│   │   ├── skill.template.md
│   │   ├── gemini.template.md
│   │   └── manifests.js      # Manifest templates
│   └── utils/
│       ├── file-utils.js
│       ├── metadata-parser.js
│       └── mcp-transformer.js
├── tests/
├── examples/
├── SKILL.md                  # Claude Code skill interface
├── package.json
└── README.md
```

## License

MIT

## Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io)
- Inspired by the universal extension pattern demonstrated in [database-query-helper](https://github.com/jduncan-rva/database-query-helper)
- Supports [Claude Code](https://code.claude.com) and [Gemini CLI](https://geminicli.com)

## Support

- **Issues**: https://github.com/jduncan-rva/skill-porter/issues
- **Discussions**: https://github.com/jduncan-rva/skill-porter/discussions

---

Made with ❤️ for the Claude Code and Gemini CLI communities
