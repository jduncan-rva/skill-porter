---
name: code-formatter
description: "Formats code files using prettier and eslint. Use when the user wants to format code, fix linting issues, or clean up code style."
allowed-tools: "Read, Write, Bash"
---

# Code Formatter Skill

The agent formats code files using Prettier and ESLint, applying project-specific configuration when available.

## Workflow

### 1. Detect project setup

Before formatting, the agent checks for existing configuration:

```bash
ls package.json .prettierrc .prettierrc.* .eslintrc.* eslint.config.* 2>/dev/null
```

If `prettier` or `eslint` are not found in `node_modules`, install them:

```bash
npm install --save-dev prettier eslint
```

### 2. Check formatting (non-destructive)

Run a dry-run check first to see what would change:

```bash
npx prettier --check "src/**/*.{js,ts,jsx,tsx,json,md,yaml}"
npx eslint "src/**/*.{js,ts,jsx,tsx}" --max-warnings=0
```

### 3. Apply formatting

Format files only after confirming the scope with the user:

```bash
npx prettier --write <path>
npx eslint --fix <path>
```

### 4. Verify results

Re-run the check to confirm all issues are resolved:

```bash
npx prettier --check <path>
npx eslint <path> --max-warnings=0
```

## Error handling

- **Missing tools**: If `npx prettier` or `npx eslint` fails with "command not found", install via `npm install --save-dev prettier eslint` and retry.
- **Conflicting configs**: If Prettier and ESLint disagree on style, prefer the project's `.prettierrc` and add `eslint-config-prettier` to disable conflicting ESLint rules.
- **No config found**: Fall back to Prettier defaults. Do not create config files unless the user requests it.

## Configuration

Set these environment variables for custom configuration:
- `PRETTIER_CONFIG`: Path to prettier config (default: `.prettierrc`)
- `ESLINT_CONFIG`: Path to eslint config (default: `.eslintrc.js`)
