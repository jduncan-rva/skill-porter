---
name: skill-porter
description: "Converts Claude Code skills to Gemini CLI extensions and vice versa by translating YAML frontmatter to JSON manifests, mapping allowed-tools whitelists to excludeTools blacklists, transforming MCP server paths, and adapting prompt templates. Use when the user wants to port a skill between platforms, make a skill cross-platform compatible, or create a universal extension that works on both Claude Code and Gemini CLI."
allowed-tools: "Read, Write, Edit, Glob, Grep, Bash"
---

# Skill Porter

The agent converts skills between Claude Code and Gemini CLI formats using the workflow below. All changes are non-destructive by default (new files are created alongside originals).

## Platform Reference

| Aspect | Claude Code | Gemini CLI |
|---|---|---|
| **Skill file** | `SKILL.md` (YAML frontmatter) | `gemini-extension.json` (JSON manifest) |
| **Context doc** | Body of `SKILL.md` | `GEMINI.md` |
| **Marketplace** | `.claude-plugin/marketplace.json` | Fields in `gemini-extension.json` |
| **Tool restrictions** | `allowed-tools` (whitelist) | `excludeTools` (blacklist) |
| **Config** | Environment variables | `settings` schema array |
| **MCP paths** | Relative from skill dir | `${extensionPath}/` prefix |

## Conversion Workflow

### Step 1: Detect Platform

The agent checks the target directory for platform indicators:

```bash
# Claude skill detected if:
ls <dir>/SKILL.md <dir>/.claude-plugin/marketplace.json 2>/dev/null

# Gemini extension detected if:
ls <dir>/gemini-extension.json <dir>/GEMINI.md 2>/dev/null
```

If both exist, the skill is already universal. The agent reports current state and asks which direction to convert.

### Step 2: Extract Metadata

**Claude source** -- the agent parses YAML frontmatter from `SKILL.md`. **Gemini source** -- the agent parses `gemini-extension.json`.

### Step 3: Transform

**Metadata mapping (bidirectional):**

```
SKILL.md frontmatter          <-->  gemini-extension.json
  name: <value>                <-->  "name": "<value>"
  description: "<value>"       <-->  "description": "<value>"
  allowed-tools: "A, B, C"    <-->  "excludeTools": [all tools NOT in A,B,C]
```

**Tool restriction mapping** -- the available tool set is: `Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, TodoWrite, NotebookEdit`. The agent computes the complement set when flipping between whitelist and blacklist.

**Path transformation** -- the agent prepends `${extensionPath}/` to all relative paths (Claude to Gemini) or strips it (Gemini to Claude):

```
Claude  "args": ["mcp-server/index.js"]
Gemini  "args": ["${extensionPath}/mcp-server/index.js"]
```

**Settings inference** -- environment variables in MCP config map to Gemini settings:

```
Claude env:    "DB_HOST": "${DB_HOST}"
Gemini setting: { "name": "DB_HOST", "description": "Database host", "default": "" }
```

### Step 4: Generate Output Files

**Claude to Gemini:** the agent creates `gemini-extension.json`, `GEMINI.md` (from SKILL.md body content), and updates MCP paths.

**Gemini to Claude:** the agent creates `SKILL.md` (with YAML frontmatter + GEMINI.md body), `.claude-plugin/marketplace.json`, and converts paths.

**Universal:** the agent generates both sets of files and moves shared documentation to `shared/reference.md` and `shared/examples.md`.

### Step 5: Validate

The agent runs these checks after generation:

```bash
# Verify required files exist
ls <dir>/SKILL.md <dir>/gemini-extension.json 2>/dev/null

# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('<dir>/gemini-extension.json','utf8'))"

# Validate YAML frontmatter (check for opening/closing ---)
head -1 <dir>/SKILL.md  # must be "---"

# Check MCP paths resolve
ls <dir>/mcp-server/index.js 2>/dev/null
```

The agent reports any validation failures and suggests fixes.

## Limitations

The following may require manual review and are flagged in the conversion report:

- Custom slash commands (platform-specific syntax differences)
- Complex multi-server MCP configurations
- Platform-specific scripts with no direct equivalent
- Edge cases in tool restriction mapping for custom tools

## Further Reference

See `shared/reference.md` for detailed API docs, `shared/examples.md` for full conversion walkthroughs, and the `src/` directory for converter implementation details.