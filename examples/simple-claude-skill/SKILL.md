---
name: code-formatter
description: "Formats JavaScript, TypeScript, JSON, YAML, and Markdown files using Prettier and ESLint. Use when the user wants to auto-format code, fix linting errors, or enforce consistent code style across a project."
allowed-tools: "Read, Write"
---

# Code Formatter Skill

The agent formats code files using Prettier and ESLint, applying consistent style rules and fixing linting issues automatically.

## Workflow

1. **Check tool availability** — verify Prettier and ESLint are accessible:
   ```bash
   ls node_modules/.bin/prettier node_modules/.bin/eslint 2>/dev/null || npx prettier --version
   ```

2. **Run formatting check** — identify files that need changes before modifying anything:
   ```bash
   npx prettier --check src/
   ```

3. **Apply formatting and lint fixes** — format files and auto-fix linting errors:
   ```bash
   npx prettier --write src/index.js
   npx eslint --fix src/
   ```

4. **Verify changes** — re-run the check to confirm all files pass:
   ```bash
   npx prettier --check src/
   npx eslint src/
   ```

## Configuration

Set these environment variables for custom configuration:
- `PRETTIER_CONFIG`: Path to Prettier config (default: `.prettierrc`)
- `ESLINT_CONFIG`: Path to ESLint config (default: `.eslintrc.js`)
