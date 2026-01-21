# Gemini CLI Skills Migration Analysis

## Executive Summary

Gemini CLI has introduced native **Agent Skills** that use `SKILL.md` files with YAML frontmatter - nearly identical to Claude Code's format. This represents a significant opportunity to simplify cross-platform skill development and requires updates to skill-porter.

## Current vs New Architecture

### Before: skill-porter v1.x (Extension-Based)

```
Claude Skill                    →    Gemini Extension
├── SKILL.md                         ├── gemini-extension.json
├── .claude-plugin/                  ├── GEMINI.md
│   └── marketplace.json             ├── commands/
├── .claude/commands/*.md            │   └── *.toml
└── mcp-server/                      └── mcp-server/
```

**Issues:**
- Creates a Gemini *extension*, not a *skill*
- Uses `GEMINI.md` as context file (not interactive skill)
- Skill instructions become passive context, not active agent behavior

### After: skill-porter v2.0 (Skills-Based)

```
Claude Skill                    →    Gemini Extension with Bundled Skill
├── SKILL.md                         ├── gemini-extension.json (MCP, settings, tools)
├── .claude-plugin/                  ├── skills/
│   └── marketplace.json             │   └── <name>/
├── .claude/commands/*.md            │       └── SKILL.md (agent instructions)
└── mcp-server/                      ├── commands/
                                     │   └── *.toml
                                     └── mcp-server/
```

**Benefits:**
- Preserves skill as an active agent capability
- Maintains MCP server configuration
- Keeps tool restrictions and settings
- Uses native Gemini skills discovery system

## Key Discovery: Format Alignment

| Feature | Claude Skills | Gemini Skills | Notes |
|---------|--------------|---------------|-------|
| Entry file | `SKILL.md` | `SKILL.md` | **IDENTICAL** |
| Frontmatter | YAML | YAML | **IDENTICAL** |
| `name` field | Required | Required | **IDENTICAL** |
| `description` field | Required | Required | **IDENTICAL** |
| Body format | Markdown | Markdown | **IDENTICAL** |
| `allowed-tools` | Supported | **Not supported** | Needs extension wrapper |
| `subagents` | Supported | **Not supported** | Convert to commands |
| MCP servers | In marketplace.json | **Not in skills** | Needs extension wrapper |
| Settings | Env vars | **Not in skills** | Needs extension wrapper |

## Gemini Skills Discovery Tiers

Skills are discovered from three locations (in precedence order):

1. **Project Skills**: `.gemini/skills/` - Project-specific, version controlled
2. **User Skills**: `~/.gemini/skills/` - Personal, global
3. **Extension Skills**: Bundled within extensions - Distributed with extensions

**Precedence**: Project > User > Extension

## New Architecture: Extension with Bundled Skill

Since Claude skills often include:
- MCP server configurations
- Tool restrictions (`allowed-tools`)
- Subagents (persona-based behavior)
- Environment variables/settings

And Gemini skills only support `name` and `description`, we need to create an **extension wrapper** that:
1. Bundles the skill in `skills/<name>/SKILL.md`
2. Configures MCP servers in `gemini-extension.json`
3. Converts `allowed-tools` to `excludeTools`
4. Generates settings from environment variables
5. Converts subagents to commands

### Output Structure

```
<skill-name>/
├── gemini-extension.json           # Extension configuration
│   {
│     "name": "skill-name",
│     "version": "1.0.0",
│     "description": "Brief description",
│     "mcpServers": { ... },        # MCP server config
│     "excludeTools": [ ... ],      # Tool restrictions
│     "settings": [ ... ]           # User settings
│   }
├── skills/
│   └── skill-name/
│       └── SKILL.md                # Agent skill (instructions)
│           ---
│           name: skill-name
│           description: Full description for agent activation
│           ---
│           [Agent instructions markdown]
├── commands/
│   └── *.toml                      # Custom commands (from subagents)
└── mcp-server/                     # MCP server code (preserved)
```

## Conversion Logic Changes

### 1. SKILL.md Transformation

**Claude Input:**
```yaml
---
name: code-reviewer
description: Expert code reviewer that checks for bugs and security issues
subagents:
  - name: security-auditor
    description: Focuses on security vulnerabilities
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
description: Expert code reviewer that checks for bugs and security issues. Use when the user asks to review code, find bugs, or check for security issues.
---

# Code Reviewer

You are an expert code reviewer...

## Related Commands

- `/security-auditor` - Focuses on security vulnerabilities
```

### 2. Tool Restriction Transformation

**Claude** uses whitelist (`allowed-tools`):
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

**Gemini** uses blacklist (`excludeTools` in extension manifest):
```json
{
  "excludeTools": [
    "Write", "Edit", "Bash", "run_shell_command",
    "WebFetch", "WebSearch", "TodoWrite", ...
  ]
}
```

### 3. Subagent to Command Conversion

**Claude subagent:**
```yaml
subagents:
  - name: security-auditor
    description: Focuses on security vulnerabilities
```

**Gemini command (commands/security-auditor.toml):**
```toml
description = "Activate security-auditor persona"

prompt = """
You are now acting as the 'security-auditor' agent.
Focus: Identifies and analyzes security vulnerabilities.

User request: {{args}}
"""
```

### 4. MCP Server Path Transformation

**Claude (relative paths):**
```json
"args": ["mcp-server/index.js"]
```

**Gemini (extension path variable):**
```json
"args": ["${extensionPath}/mcp-server/index.js"]
```

## Implementation Checklist

### Phase 1: Core Converter Updates

- [ ] **claude-to-gemini.js**
  - [ ] Create `skills/<name>/SKILL.md` with converted frontmatter
  - [ ] Keep `gemini-extension.json` for MCP/tools/settings
  - [ ] Update description to include activation triggers
  - [ ] Remove `allowed-tools` from skill frontmatter
  - [ ] Add reference to commands in skill body
  - [ ] Update footer attribution

- [ ] **gemini-to-claude.js**
  - [ ] Detect skills in `skills/` subdirectory
  - [ ] Extract skill instructions from bundled skills
  - [ ] Handle both legacy (GEMINI.md only) and new (bundled skill) formats

### Phase 2: Detection & Validation

- [ ] **detector.js**
  - [ ] Add detection for `skills/` directory
  - [ ] Detect `.gemini/skills/` project skills
  - [ ] Handle extension-bundled skills vs standalone skills
  - [ ] Update confidence scoring for new format

- [ ] **validator.js**
  - [ ] Add Gemini skill validation rules
  - [ ] Validate skill frontmatter (name, description)
  - [ ] Validate skill-extension relationship
  - [ ] Check for proper directory structure

### Phase 3: Documentation & Examples

- [ ] Update CLAUDE.md with new conversion flow
- [ ] Update SKILL.md (this project's skill definition)
- [ ] Create before/after examples for new format
- [ ] Update CLI help text

## Backward Compatibility

The new converter should:
1. **Detect existing format**: Check if target already has `skills/` directory
2. **Support both outputs**: Flag to generate legacy format if needed
3. **Migrate existing**: Offer to migrate `GEMINI.md` → `skills/*/SKILL.md`

## Testing Strategy

1. **Unit tests**: Frontmatter parsing, tool conversion, path transformation
2. **Integration tests**: Full conversion cycle (Claude → Gemini → Claude)
3. **Real-world tests**: Convert actual skills and test in both CLIs

## References

- [Gemini CLI Skills Documentation](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI Extensions Documentation](https://geminicli.com/docs/extensions/)
- [MCP Server Configuration](https://geminicli.com/docs/tools/mcp-server/)
- [Custom Commands](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
