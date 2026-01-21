# Gemini CLI Extension Architecture Guide

This document serves as the "Source of Truth" for understanding, maintaining, and extending this Gemini CLI Extension.

## 1. Extension Structure

A valid Gemini CLI extension consists of the following core components:

```text
.
├── gemini-extension.json  # Manifest file (Required)
├── GEMINI.md              # Context & Instructions (Required)
├── commands/              # Custom Slash Commands (Optional)
│   └── command.toml       # Command definition
├── docs/                  # Documentation (Recommended)
│   └── GEMINI_ARCHITECTURE.md # This file
└── mcp-server/            # (Optional) Model Context Protocol server
```

## 2. Manifest Schema (`gemini-extension.json`)

The `gemini-extension.json` file defines the extension's metadata, configuration, and tools.

```json
{
  "name": "extension-name",
  "version": "1.0.0",
  "description": "Description of what the extension does.",
  "contextFileName": "GEMINI.md",
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["${extensionPath}/mcp-server/index.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  },
  "settings": [
    {
      "name": "API_KEY",
      "description": "API Key for the service",
      "secret": true,
      "required": true
    }
  ],
  "excludeTools": ["Bash"] // Tools to blacklist (optional)
}
```

## 3. Custom Commands (`commands/*.toml`)

Custom commands provide interactive shortcuts (e.g., `/deploy`, `/review`) for users. They are defined in TOML files within the `commands/` directory.

### File Structure
Filename determines the command name:
*   `commands/review.toml` -> `/review`
*   `commands/git/commit.toml` -> `/git:commit` (Namespaced)

### TOML Format

```toml
description = "Description of what this command does"

# The prompt sent to the model.
# {{args}} is replaced by the user's input text.
prompt = """
You are an expert code reviewer.
Review the following code focusing on security and performance:

{{args}}
"""
```

### Best Practices
*   **Use `{{args}}`**: Always include this placeholder to capture user input.
*   **Clear Description**: Helps the user understand what the command does when listing commands.
*   **Prompt Engineering**: Provide clear persona instructions and constraints within the `prompt` string.

## 4. Context Management (`GEMINI.md`)

The `GEMINI.md` file is injected into the LLM's context window for *every* interaction (not just specific commands).
*   **Keep it Concise**: Token usage matters.
*   **Global Instructions**: Use this for broad behavior rules (e.g., "Always speak like a pirate").
*   **Safety First**: Explicitly state what the extension *cannot* do.

## 5. Maintenance

When modifying this extension:
1.  **Add Commands**: Create new `.toml` files in `commands/` for distinct tasks or agents.
2.  **Update Manifest**: Edit `gemini-extension.json` if you change settings or MCP servers.
3.  **Update Context**: Edit `GEMINI.md` for global behavioral changes.
