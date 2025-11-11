# Skill Porter - Examples

This directory contains example skills and extensions showing conversion between Claude Code and Gemini CLI formats.

## Examples Included

### 1. Simple Claude Skill: `code-formatter`

**Source**: `simple-claude-skill/`
**Type**: Claude Code Skill
**Features**: File formatting using Prettier and ESLint

**Files**:
- `SKILL.md` - Skill definition with YAML frontmatter
- `.claude-plugin/marketplace.json` - Claude marketplace configuration

**Conversion**:
```bash
skill-porter convert simple-claude-skill --to gemini
```

**Result**: See `before-after/code-formatter-converted/`
- Generates `gemini-extension.json`
- Creates `GEMINI.md` context file
- Transforms MCP server config with `${extensionPath}`
- Converts `allowed-tools` to `excludeTools`
- Infers settings from environment variables

---

### 2. Gemini Extension: `api-connector`

**Source**: `api-connector-gemini/`
**Type**: Gemini CLI Extension
**Features**: REST API client with authentication

**Files**:
- `gemini-extension.json` - Gemini manifest with settings
- `GEMINI.md` - Context file with documentation

**Conversion**:
```bash
skill-porter convert api-connector-gemini --to claude
```

**Result**: See `before-after/api-connector-converted/`
- Generates `SKILL.md` with YAML frontmatter
- Creates `.claude-plugin/marketplace.json`
- Converts settings to environment variable docs
- Transforms `excludeTools` to `allowed-tools`
- Removes `${extensionPath}` variables

---

## Before/After Comparisons

### Code Formatter (Claude → Gemini)

**Before** (Claude):
```yaml
---
name: code-formatter
description: Formats code files using prettier and eslint
allowed-tools:
  - Read
  - Write
  - Bash
---
```

**After** (Gemini):
```json
{
  "name": "code-formatter",
  "version": "1.0.0",
  "description": "Formats code files using prettier and eslint",
  "excludeTools": ["Edit", "Glob", "Grep", "Task", ...]
}
```

**Key Transformations**:
- ✅ YAML frontmatter → JSON manifest
- ✅ Whitelist (allowed-tools) → Blacklist (excludeTools)
- ✅ MCP paths: `mcp-server/index.js` → `${extensionPath}/mcp-server/index.js`
- ✅ Environment variables → Settings schema

---

### API Connector (Gemini → Claude)

**Before** (Gemini):
```json
{
  "name": "api-connector",
  "version": "2.1.0",
  "settings": [
    {
      "name": "API_KEY",
      "secret": true,
      "required": true
    }
  ],
  "excludeTools": ["Bash", "Edit", "Write"]
}
```

**After** (Claude):
```yaml
---
name: api-connector
description: Connect to REST APIs...
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
  - WebFetch
  - WebSearch
  # (all tools except Bash, Edit, Write)
---

## Configuration
- `API_KEY`: API authentication key **(required)**
```

**Key Transformations**:
- ✅ JSON manifest → YAML frontmatter
- ✅ Blacklist (excludeTools) → Whitelist (allowed-tools)
- ✅ Settings schema → Environment variable documentation
- ✅ MCP paths: `${extensionPath}/...` → relative paths

---

## Running the Examples

### Test Conversion

```bash
# Analyze an example
skill-porter analyze examples/simple-claude-skill

# Convert Claude → Gemini
skill-porter convert examples/simple-claude-skill --to gemini

# Convert Gemini → Claude
skill-porter convert examples/api-connector-gemini --to claude

# Validate converted output
skill-porter validate examples/before-after/code-formatter-converted --platform gemini
```

### Install Examples

**Claude Code**:
```bash
cp -r examples/simple-claude-skill ~/.claude/skills/code-formatter
```

**Gemini CLI**:
```bash
gemini extensions install examples/api-connector-gemini
```

---

## Understanding the Conversions

### Tool Restrictions

**Claude** uses a **whitelist** approach:
- Only listed tools are allowed
- Explicit permission model
- Field: `allowed-tools` (array)

**Gemini** uses a **blacklist** approach:
- All tools allowed except listed ones
- Exclusion model
- Field: `excludeTools` (array)

**Conversion Logic**:
- Claude → Gemini: Calculate excluded tools (all tools - allowed)
- Gemini → Claude: Calculate allowed tools (all tools - excluded)

### Configuration Patterns

**Claude**: Environment variables
```json
{
  "env": {
    "API_KEY": "${API_KEY}",
    "API_URL": "${API_URL}"
  }
}
```

**Gemini**: Settings schema
```json
{
  "settings": [
    {
      "name": "API_KEY",
      "description": "API key",
      "secret": true,
      "required": true
    },
    {
      "name": "API_URL",
      "description": "API endpoint",
      "default": "https://api.example.com"
    }
  ]
}
```

### MCP Server Paths

**Claude**: Relative paths
```json
{
  "args": ["mcp-server/index.js"]
}
```

**Gemini**: Variable substitution
```json
{
  "args": ["${extensionPath}/mcp-server/index.js"]
}
```

---

## Tips for Creating Universal Skills

1. **Start with shared functionality**: Put logic in MCP server
2. **Use environment variables**: Both platforms support them
3. **Document thoroughly**: Both platforms load context files
4. **Test on both platforms**: Use skill-porter to validate
5. **Keep it simple**: Complex restrictions may need manual review

---

## Additional Resources

- [Claude Code Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Gemini CLI Extensions](https://geminicli.com/docs/extensions/)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [skill-porter Repository](https://github.com/jduncan-rva/skill-porter)
