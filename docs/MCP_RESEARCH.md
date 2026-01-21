# MCP Server Conversion Research

**Date:** January 2026
**Status:** Research complete, awaiting decision on external MCP support

## Background

Research conducted to understand how skill-porter handles MCP server conversion between Claude Code and Gemini CLI, and whether support for external MCP servers is needed.

---

## Key Findings

### Two Types of MCP Configuration

| Type | Description | skill-porter handles? |
|------|-------------|----------------------|
| **Bundled MCP** | MCP server code packaged WITH the skill | Yes |
| **External MCP** | Remote services added via `claude mcp add` | No |

---

## Bundled MCP (What skill-porter converts)

MCP servers that are part of the skill package:
- Code lives in `mcp-server/` directory within the skill
- Config in `marketplace.json` (Claude) or `gemini-extension.json` (Gemini)
- Path transformation: relative <-> `${extensionPath}`

### Claude Format

**Location:** `.claude-plugin/marketplace.json`

```json
{
  "plugins": [{
    "mcpServers": {
      "my-server": {
        "command": "node",
        "args": ["mcp-server/index.js"],
        "env": { "API_KEY": "${API_KEY}" }
      }
    }
  }]
}
```

**Characteristics:**
- Relative paths (e.g., `mcp-server/index.js`)
- Environment variables in `${VAR}` format
- Users set env vars before running
- No explicit settings schema

### Gemini Format

**Location:** `gemini-extension.json`

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${extensionPath}/mcp-server/index.js"],
      "env": { "API_KEY": "${API_KEY}" }
    }
  },
  "settings": [
    {
      "name": "API_KEY",
      "description": "API authentication key",
      "secret": true,
      "required": true
    }
  ]
}
```

**Characteristics:**
- Uses `${extensionPath}` variable for paths
- Explicit `settings[]` array for user configuration
- Users prompted during extension install
- Secret fields marked with `secret: true`

---

## External MCP (`claude mcp add` command)

User-configured MCP servers connecting to external services:

```bash
# HTTP transport (cloud-hosted MCP)
claude mcp add --transport http hugging-face https://huggingface.co/mcp

# SSE transport
claude mcp add --transport sse asana https://mcp.asana.com/sse

# STDIO (local server)
claude mcp add --transport stdio myserver -- python server.py
```

### Storage Locations

| Scope Flag | Storage Location | Description |
|------------|-----------------|-------------|
| `--scope local` | `.claude/settings.json` | User-level, current project |
| `--scope project` | `.mcp.json` | Project-level, shared with team |
| `--scope user` | Global user config | Available across all projects |

### Why NOT handled by skill-porter

- These are user-configured, not skill-packaged
- No equivalent standard format on Gemini side
- Different concern: connecting to external services vs bundling tools with skills
- External services require user authentication/setup regardless of platform

---

## Current MCP Conversion Coverage

### Claude to Gemini (Well-implemented)

| Feature | Implementation | Location |
|---------|---------------|----------|
| Path transformation | `relative` -> `${extensionPath}/` | `claude-to-gemini.js:314-350` |
| Settings inference | env vars -> settings schema | `claude-to-gemini.js:392-435` |
| Secret detection | Keyword matching (password, key, token) | Automatic |
| Default inference | Common vars get defaults | Automatic |

**How it works:**
1. Reads MCP config from `marketplace.json`
2. Transforms paths to use `${extensionPath}` variable
3. Extracts environment variables
4. Generates settings schema with intelligent defaults
5. Detects secrets based on variable name patterns

### Gemini to Claude (Gaps identified)

| Feature | Status | Notes |
|---------|--------|-------|
| Path transformation | Works | Strips `${extensionPath}/` prefix |
| Settings -> env vars | **Missing** | Settings schema not converted back to env documentation |
| Marketplace.json MCP validation | **Missing** | Only Gemini mcpServers are validated |

---

## Identified Gaps

| Gap | Severity | Effort | Description |
|-----|----------|--------|-------------|
| Settings -> env vars bidirectional | HIGH | Medium | Gemini settings not converted back to Claude env var documentation |
| Claude MCP validation | MEDIUM | Low | No validation of marketplace.json mcpServers structure |
| Tool restrictions lossy | MEDIUM | High | Whitelist->blacklist doesn't work well when allowing most tools |
| MCP server file existence | LOW | Low | Don't validate that referenced files actually exist |

---

## Open Question: External MCP Support

**Should skill-porter support external MCP server dependencies?**

### Options

1. **Add full support** - Convert external MCP configs between platforms
   - Requires defining new standards on both sides
   - Complex due to transport differences

2. **Bundled only** (current approach) - Keep focus on skill-packaged MCP
   - External MCP is user responsibility
   - Simpler, more focused tool

3. **Generate instructions** - Document required external MCP without converting configs
   - Skills declare dependencies
   - Tool generates setup instructions for each platform

### Proposed Enhancement Format

If we go with option 3 (generate instructions):

```json
{
  "externalMcpDependencies": [
    {
      "name": "hugging-face",
      "transport": "http",
      "url": "https://huggingface.co/mcp",
      "description": "Required for model inference",
      "setupCommand": "claude mcp add --transport http hugging-face https://huggingface.co/mcp"
    }
  ]
}
```

This could:
- Generate setup instructions in README or SKILL.md
- Document requirements without trying to convert configs
- Let users know what external services are needed

---

## Architecture Summary

```
skill-porter MCP handling:

BUNDLED MCP (handled):
+-------------------+                    +----------------------+
| Claude Skill      |                    | Gemini Extension     |
| marketplace.json  |  <-- converts -->  | gemini-extension.json|
|                   |                    |                      |
| mcpServers: {     |                    | mcpServers: {        |
|   "server": {     |                    |   "server": {        |
|     command,      |    Path transform  |     command,         |
|     args: [       |  <--------------> |     args: [          |
|       "mcp/x.js"  |                    |       "${ext}/mcp/x" |
|     ],            |                    |     ],               |
|     env: {...}    |   Settings infer   |     env: {...}       |
|   }               |  --------------->  |   }                  |
| }                 |                    | },                   |
|                   |                    | settings: [...]      |
+-------------------+                    +----------------------+

EXTERNAL MCP (NOT handled):
+-------------------+
| claude mcp add    |  User responsibility
| --transport http  |  No platform equivalent
| service URL       |  Different per service
+-------------------+
```

---

## References

- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [FastMCP Claude Code Integration](https://gofastmcp.com/integrations/claude-code)
- [GitHub MCP Server Install Guide](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-claude.md)
- [Configuring MCP Tools in Claude Code](https://scottspence.com/posts/configuring-mcp-tools-in-claude-code)

---

## Related Code Locations

| File | Purpose | Key Methods |
|------|---------|-------------|
| `src/converters/claude-to-gemini.js` | Claude->Gemini conversion | `_transformMCPServers()`, `_inferSettingsFromMCPConfig()` |
| `src/converters/gemini-to-claude.js` | Gemini->Claude conversion | `_transformMCPServersForClaude()` |
| `src/analyzers/validator.js` | Validation | MCP validation (Gemini only) |
| `src/analyzers/detector.js` | Detection | Detects `mcp-server/` directory |
