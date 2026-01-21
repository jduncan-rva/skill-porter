# Context7 Auto-Use Skill for Gemini CLI

A Gemini CLI skill that enables automatic Context7 usage for code generation and library documentation lookups.

## What This Does

This skill instructs Gemini to automatically use Context7 MCP tools when:
- Writing code that uses external libraries
- Setting up tools or frameworks
- Needing current API documentation
- Looking for best practices and examples

Instead of asking "use context7 to look up React docs", Gemini will proactively fetch relevant documentation.

## Prerequisites

You must have the Context7 extension installed:

```bash
gemini extensions install github:upstash/context7
```

## Installation Options

### Option 1: User-Level Skill (Recommended)

The simplest approach - works alongside the official extension without modification.

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.gemini/skills/context7-auto

# Copy the skill
cp skills/context7-auto/SKILL.md ~/.gemini/skills/context7-auto/
```

Verify it's detected:
```bash
gemini skills list
```

### Option 2: Project-Level Skill

Add to a specific project:

```bash
# In your project root
mkdir -p .gemini/skills/context7-auto
cp path/to/skills/context7-auto/SKILL.md .gemini/skills/context7-auto/
```

### Option 3: Fork and Bundle

Fork the official Context7 extension and add the skill:

1. Fork https://github.com/upstash/context7
2. Add `skills/context7-auto/SKILL.md` to the fork
3. Install your fork: `gemini extensions install github:yourusername/context7`

## Skill Discovery Precedence

Gemini discovers skills in this order:
1. **Project skills** (`.gemini/skills/`)
2. **User skills** (`~/.gemini/skills/`)
3. **Extension-bundled skills** (`skills/` in extension)

## Usage

Once installed, Gemini will automatically use Context7 when relevant. Examples:

```
User: Create a React component that fetches data with TanStack Query

Gemini: [Automatically queries Context7 for React and TanStack Query docs]
Here's a component using the current TanStack Query v5 API...
```

```
User: Set up authentication in my Next.js app

Gemini: [Automatically queries Context7 for Next.js auth patterns]
Based on the current Next.js 15 documentation...
```

## Comparison with Claude Code Setup

This skill mirrors the functionality of a Claude Code hook setup:

| Claude Code | Gemini CLI |
|------------|------------|
| `~/.claude/hooks/context7.sh` | Not needed |
| `~/.claude/hooks/CONTEXT7.md` | `~/.gemini/skills/context7-auto/SKILL.md` |
| Loaded at session start via hook | Loaded automatically via skill discovery |

## Customization

Edit the skill to adjust behavior:

- **Add more trigger scenarios** in the "When to Use" section
- **Adjust the examples table** for your common use cases
- **Modify guidelines** for proactivity level

## License

MIT - Feel free to modify and redistribute.
