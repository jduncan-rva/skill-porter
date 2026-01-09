# Gemini CLI Skills Format Reference

## Overview

Gemini CLI supports native **Agent Skills** using `SKILL.md` files with YAML frontmatter - nearly identical to Claude Code's format. This document explains how skill-porter handles the conversion between platforms.

## Format Comparison

| Feature | Claude Skills | Gemini Skills | Notes |
|---------|--------------|---------------|-------|
| Entry file | `SKILL.md` | `SKILL.md` | Identical |
| Frontmatter | YAML | YAML | Identical |
| `name` field | Required | Required | Identical |
| `description` field | Required | Required | Identical |
| Body format | Markdown | Markdown | Identical |
| `allowed-tools` | Supported | Not in skill | Moved to extension manifest |
| `subagents` | Supported | Not supported | Converted to commands |
| MCP servers | In marketplace.json | Not in skills | Moved to extension manifest |
| Settings | Env vars | Not in skills | Moved to extension manifest |

## Architecture: Extension with Bundled Skills

Since Claude skills often include features not supported in Gemini skill frontmatter (MCP servers, tool restrictions, etc.), skill-porter creates an **extension wrapper** that bundles skills with their configuration.

### Output Structure

```
<extension-name>/
├── gemini-extension.json           # Extension configuration
│   {
│     "name": "extension-name",
│     "description": "Brief description",
│     "mcpServers": { ... },        # MCP server config
│     "excludeTools": [ ... ],      # Tool restrictions
│     "settings": [ ... ]           # User settings
│   }
├── skills/
│   └── skill-name/
│       └── SKILL.md                # Agent skill instructions
│           ---
│           name: skill-name
│           description: Full description for agent activation
│           ---
│           [Agent instructions markdown]
├── commands/
│   └── *.toml                      # Custom commands
└── mcp-server/                     # MCP server code (preserved)
```

### Multi-Skill Plugins

For Claude plugins with multiple skills (`skills/*/SKILL.md`), skill-porter preserves the structure:

```
<extension-name>/
├── gemini-extension.json
├── skills/
│   ├── skill-one/SKILL.md
│   ├── skill-two/SKILL.md
│   └── skill-three/SKILL.md
└── commands/
    └── *.toml
```

## Gemini Skills Discovery

Skills are discovered from three locations (in precedence order):

1. **Project Skills**: `.gemini/skills/` - Project-specific, version controlled
2. **User Skills**: `~/.gemini/skills/` - Personal, global
3. **Extension Skills**: Bundled within extensions - Distributed with extensions

**Precedence**: Project > User > Extension

## Conversion Examples

### SKILL.md Transformation

**Claude Input:**
```yaml
---
name: code-reviewer
description: Expert code reviewer that checks for bugs and security issues
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Code Reviewer

You are an expert code reviewer...
```

**Gemini Output (skills/code-reviewer/SKILL.md):**
```yaml
---
name: code-reviewer
description: Expert code reviewer that checks for bugs and security issues.
  Use when the user asks to review code, find bugs, or check for security issues.
---

# Code Reviewer

You are an expert code reviewer...
```

Note: `allowed-tools` is converted to `excludeTools` in `gemini-extension.json`.

### Tool Restriction Conversion

**Claude** uses allowlist (`allowed-tools` in SKILL.md):
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

**Gemini** uses denylist (`excludeTools` in gemini-extension.json):
```json
{
  "excludeTools": [
    "Write", "Edit", "Bash", "WebFetch", "WebSearch", "TodoWrite"
  ]
}
```

### Command Conversion

**Claude command (commands/review.md):**
```yaml
---
description: Run a code review
---

Review the code in the current directory...
```

**Gemini command (commands/review.toml):**
```toml
description = "Run a code review"

prompt = """
Review the code in the current directory...
"""
```

### Agent to Command Conversion

Since Gemini CLI doesn't have native agents, Claude agents are converted to commands:

**Claude agent (agents/security-auditor.md):**
```yaml
---
name: security-auditor
description: Focuses on security vulnerabilities
---

You are a security auditor. Focus on identifying vulnerabilities...
```

**Gemini command (commands/security-auditor.toml):**
```toml
description = "Focuses on security vulnerabilities"

prompt = """
You are a security auditor. Focus on identifying vulnerabilities...

User request: {{args}}
"""
```

### MCP Server Path Transformation

**Claude (relative paths):**
```json
"args": ["mcp-server/index.js"]
```

**Gemini (extension path variable):**
```json
"args": ["${extensionPath}/mcp-server/index.js"]
```

## Backward Compatibility

skill-porter supports both modern and legacy Gemini formats:

- **Modern format** (default): Creates `skills/<name>/SKILL.md` for native skill discovery
- **Legacy format** (`--legacy` flag): Creates `GEMINI.md` context file for older Gemini CLI versions

## References

- [Gemini CLI Documentation](https://github.com/google-gemini/gemini-cli)
- [Model Context Protocol](https://modelcontextprotocol.io)
