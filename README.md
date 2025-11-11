# Skill Porter

Universal tool to convert Claude Code skills to Gemini CLI extensions and vice versa.

## Overview

Skill Porter automates the conversion between Claude Code skills and Gemini CLI extensions, enabling developers to write once and deploy to both platforms with minimal effort.

### Key Features

- **Bidirectional Conversion**: Claude → Gemini and Gemini → Claude
- **Smart Analysis**: Automatically detects source platform and structure
- **Metadata Transformation**: YAML frontmatter ↔ JSON manifest conversion
- **MCP Integration**: Preserves Model Context Protocol server configurations
- **Configuration Mapping**: Converts between environment variables and settings schemas
- **Tool Restriction Conversion**: Transforms allowed-tools (whitelist) ↔ excludeTools (blacklist)
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

### Convert Claude Skill to Gemini Extension

```bash
skill-porter convert ./my-claude-skill --to gemini --output ./my-gemini-extension
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
```

### As a Claude Code Skill

This tool itself is available as a Claude Code skill:

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

## Architecture

Skill Porter leverages the fact that both platforms use the Model Context Protocol (MCP), achieving ~85% code reuse:

```
Shared Components (85%):
├── MCP Server (100% reusable)
├── Documentation (85% reusable)
├── Scripts & Dependencies (100% reusable)

Platform-Specific (15%):
├── Claude: SKILL.md + .claude-plugin/marketplace.json
└── Gemini: GEMINI.md + gemini-extension.json
```

### Conversion Process

1. **Detect**: Analyze source to determine platform
2. **Extract**: Parse metadata, MCP config, documentation
3. **Transform**: Convert between platform formats
4. **Generate**: Create target platform files
5. **Validate**: Ensure output meets requirements

## Platform Mapping

| Claude Code | Gemini CLI | Transformation |
|-------------|------------|----------------|
| `SKILL.md` frontmatter | `gemini-extension.json` | YAML → JSON |
| `allowed-tools` (whitelist) | `excludeTools` (blacklist) | Logic inversion |
| `.claude-plugin/marketplace.json` | `gemini-extension.json` | JSON merge |
| Environment variables | `settings[]` schema | Inference |
| `SKILL.md` content | `GEMINI.md` | Content adaptation |

## Examples

### Example 1: Database Query Helper

```bash
# Convert existing Claude skill to Gemini
skill-porter convert ~/claude-skills/database-helper --to gemini

# Result: Creates gemini-extension.json, GEMINI.md, and updates MCP config
```

### Example 2: Reverse Conversion

```bash
# Convert Gemini extension back to Claude
skill-porter convert ~/gemini-extensions/my-tool --to claude

# Result: Creates SKILL.md, .claude-plugin/marketplace.json
```

## Optional Features

### Generate Pull Request

```bash
skill-porter convert ./my-skill --to gemini --create-pr
```

Creates a PR to the parent repository with dual-platform support.

### Fork and Setup

```bash
skill-porter convert ./my-skill --to gemini --fork --fork-location ~/my-forks
```

Creates a fork with both platform configurations for simultaneous use.

### Migration Tool

```bash
skill-porter migrate ./my-skill --from claude --to gemini --create-repo
```

Creates a new repository with only the target platform configuration.

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
