# Gemini CLI Compatibility Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 bugs preventing converted Claude plugins from working correctly with Gemini CLI.

**Architecture:** All fixes modify `src/converters/claude-to-gemini.js`. We add helper methods for string processing, generate a context file for native-skill mode, and strip Claude-specific namespaces from skill references.

**Tech Stack:** Node.js, ES Modules, js-yaml

---

## Bug Summary

| # | Bug | Root Cause |
|---|-----|------------|
| 1 | TOML strings truncated mid-word | `.substring(200)` after escaping |
| 2 | Missing GEMINI.md in native mode | Only generated in legacy mode |
| 3 | Missing contextFileName in manifest | Conditional only for legacy |
| 4 | Skill namespace breaks CLI | `superpowers:skill` not stripped |
| 5 | Non-kebab-case filenames | No filename normalization |

---

## Task 1: Fix contextFileName (1 line)

**Files:**
- Modify: `src/converters/claude-to-gemini.js:281-284`

**Step 1: Locate the conditional**

Find lines 281-284:
```javascript
// Only include contextFileName for legacy mode
if (this.options.legacy) {
  manifest.contextFileName = 'GEMINI.md';
}
```

**Step 2: Remove conditional, always set contextFileName**

Replace with:
```javascript
// Always include contextFileName - Gemini CLI requires it
manifest.contextFileName = 'GEMINI.md';
```

**Step 3: Run existing tests**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task1-test`
Verify: `grep contextFileName /tmp/task1-test/gemini-extension.json`
Expected: `"contextFileName": "GEMINI.md"`

**Step 4: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: always include contextFileName in Gemini manifest"
```

---

## Task 2: Add _toKebabCase Helper

**Files:**
- Modify: `src/converters/claude-to-gemini.js` (add method around line 630)

**Step 1: Add the helper method**

Add after `_formatYamlDescription` method (around line 630):

```javascript
/**
 * Convert string to kebab-case for filenames
 * @param {string} str - The string to convert
 * @returns {string} - kebab-case string
 */
_toKebabCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase -> camel-Case
    .replace(/[\s_]+/g, '-')              // spaces/underscores -> hyphens
    .replace(/[^a-zA-Z0-9-]/g, '')        // remove special chars
    .toLowerCase();
}
```

**Step 2: Test manually**

Add temporary test at end of file:
```javascript
// const c = new ClaudeToGeminiConverter('.', '/tmp/test');
// console.log(c._toKebabCase('myCommand'));      // my-command
// console.log(c._toKebabCase('some_thing'));     // some-thing
// console.log(c._toKebabCase('Code Reviewer'));  // code-reviewer
```

Run: `node -e "import('./src/converters/claude-to-gemini.js')"`

**Step 3: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "feat: add _toKebabCase helper for filename normalization"
```

---

## Task 3: Apply _toKebabCase to Command Filenames

**Files:**
- Modify: `src/converters/claude-to-gemini.js:740,779`

**Step 1: Update agent command filename (line 740)**

Find:
```javascript
const filePath = path.join(commandsDir, `${agent.name}.toml`);
```

Replace with:
```javascript
const fileName = this._toKebabCase(agent.name);
const filePath = path.join(commandsDir, `${fileName}.toml`);
```

**Step 2: Update regular command filename (line 779)**

Find:
```javascript
const filePath = path.join(commandsDir, `${cmd.name}.toml`);
```

Replace with:
```javascript
const fileName = this._toKebabCase(cmd.name);
const filePath = path.join(commandsDir, `${fileName}.toml`);
```

**Step 3: Test conversion**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task3-test`
Run: `ls /tmp/task3-test/commands/`
Expected: All filenames kebab-case (e.g., `code-reviewer.toml`, `write-plan.toml`)

**Step 4: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: use kebab-case for generated command filenames"
```

---

## Task 4: Add _safeTomlDescription Helper

**Files:**
- Modify: `src/converters/claude-to-gemini.js` (add method after _toKebabCase)

**Step 1: Add the helper method**

```javascript
/**
 * Safely truncate and escape a string for TOML description field
 * Truncates BEFORE escaping to avoid breaking escape sequences
 * @param {string} str - The string to process
 * @param {number} maxLength - Maximum length (default 200)
 * @returns {string} - Safe TOML string
 */
_safeTomlDescription(str, maxLength = 200) {
  if (!str) return '';

  // First, clean the string (remove newlines, normalize whitespace)
  let cleaned = str.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Truncate BEFORE escaping, at word boundary
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    // Find last word boundary (don't cut too much)
    const lastSpace = cleaned.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      cleaned = cleaned.substring(0, lastSpace);
    }
    cleaned += '...';
  }

  // Now escape for TOML (after truncation)
  return cleaned
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}
```

**Step 2: Test manually**

```javascript
// Test cases:
// c._safeTomlDescription('short')                    -> 'short'
// c._safeTomlDescription('a'.repeat(250))            -> 200 chars + '...'
// c._safeTomlDescription('word word word...')        -> truncates at word boundary
// c._safeTomlDescription('has "quotes"')             -> 'has \\"quotes\\"'
```

**Step 3: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "feat: add _safeTomlDescription helper for safe TOML strings"
```

---

## Task 5: Apply _safeTomlDescription to Agent Conversion

**Files:**
- Modify: `src/converters/claude-to-gemini.js:705,724-728`

**Step 1: Fix subagent description (line 705)**

Find:
```javascript
const tomlContent = `description = "Activate ${agent.name} agent"
```

Replace with:
```javascript
const safeAgentName = this._safeTomlDescription(agent.name, 50);
const tomlContent = `description = "Activate ${safeAgentName} agent"
```

**Step 2: Fix standalone agent description (lines 724-728)**

Find:
```javascript
const escapedDescription = (agent.description || (agent.name ? `${agent.name} agent` : 'Custom agent'))
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, ' ')
  .substring(0, 200); // Truncate long descriptions
```

Replace with:
```javascript
const rawDescription = agent.description || (agent.name ? `${agent.name} agent` : 'Custom agent');
const escapedDescription = this._safeTomlDescription(rawDescription, 200);
```

**Step 3: Test conversion**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task5-test`
Run: `head -3 /tmp/task5-test/commands/code-reviewer.toml`
Expected: Description properly escaped, not truncated mid-word

**Step 4: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: use safe TOML description in agent conversion"
```

---

## Task 6: Apply _safeTomlDescription to Command Conversion

**Files:**
- Modify: `src/converters/claude-to-gemini.js:757-760`

**Step 1: Fix command description escaping**

Find (lines 757-760):
```javascript
description = fm.description
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, ' ');
```

Replace with:
```javascript
description = this._safeTomlDescription(fm.description, 200);
```

**Step 2: Test conversion**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task6-test`
Run: `cat /tmp/task6-test/commands/brainstorm.toml | head -3`
Expected: Description properly escaped

**Step 3: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: use safe TOML description in command conversion"
```

---

## Task 7: Store Plugin Name in Metadata

**Files:**
- Modify: `src/converters/claude-to-gemini.js` (in `_extractClaudeMetadata` method)

**Step 1: Find metadata extraction**

Locate `_extractClaudeMetadata` method and find where plugin.json is parsed.

**Step 2: Store plugin name**

After reading plugin.json, add:
```javascript
// Store plugin name for namespace stripping in commands
if (plugin?.name) {
  this.metadata.source.pluginName = plugin.name;
}
```

**Step 3: Verify metadata is stored**

Run: `node -e "
import { ClaudeToGeminiConverter } from './src/converters/claude-to-gemini.js';
const c = new ClaudeToGeminiConverter('examples/superpowers', '/tmp/test');
await c._extractClaudeMetadata();
console.log('pluginName:', c.metadata.source.pluginName);
"`
Expected: `pluginName: superpowers`

**Step 4: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "feat: store plugin name in metadata for namespace stripping"
```

---

## Task 8: Strip Skill Namespace from Command Prompts

**Files:**
- Modify: `src/converters/claude-to-gemini.js:768-771`

**Step 1: Add namespace stripping after argument conversion**

Find (around line 771):
```javascript
prompt = prompt.replace(/\$ARGUMENTS/g, '{{args}}')
               .replace(/\$\d+/g, '{{args}}');
```

Add after:
```javascript
// Strip plugin namespace from skill references
// Claude format: "plugin-name:skill-name" -> Gemini format: "skill-name"
const pluginName = this.metadata.source.pluginName;
if (pluginName) {
  const namespacePattern = new RegExp(`${pluginName}:`, 'g');
  prompt = prompt.replace(namespacePattern, '');
}
```

**Step 2: Test conversion**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task8-test`
Run: `grep -r "superpowers:" /tmp/task8-test/commands/`
Expected: No matches (namespace stripped)

Run: `cat /tmp/task8-test/commands/brainstorm.toml`
Expected: `Invoke the brainstorming skill` (not `superpowers:brainstorming`)

**Step 3: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: strip plugin namespace from skill references in commands"
```

---

## Task 9: Add _generateNativeSkillContext Method

**Files:**
- Modify: `src/converters/claude-to-gemini.js` (add after `_generateGeminiContext`)

**Step 1: Add the new method**

Add after `_generateGeminiContext` method:

```javascript
/**
 * Generate GEMINI.md context file for native-skill format
 * Lists available skills and provides global instructions
 */
async _generateNativeSkillContext() {
  const frontmatter = this.metadata.source.frontmatter || {};
  const skills = this.metadata.source.skills || [];
  const extensionName = frontmatter.name || 'Extension';

  // Build skill list
  let skillList;
  if (skills.length > 0) {
    skillList = skills.map(s => {
      const desc = s.frontmatter?.description || 'No description';
      return `- **${s.name}**: ${desc}`;
    }).join('\n');
  } else {
    skillList = `- **${extensionName}**: ${frontmatter.description || 'No description'}`;
  }

  const content = `# ${extensionName} Context

## Available Skills

${skillList}

## Usage

Check the \`skills/\` directory for detailed skill instructions. Each skill has its own SKILL.md with specific guidance.

## Global Instructions

When working with this extension:
1. Review available skills before starting a task
2. Use the appropriate skill for the task at hand
3. Follow skill-specific instructions in \`skills/<name>/SKILL.md\`

---

*This context file was generated by [skill-porter](https://github.com/jduncan-rva/skill-porter)*
`;

  const outputPath = path.join(this.outputPath, 'GEMINI.md');
  await fs.writeFile(outputPath, content);
  return outputPath;
}
```

**Step 2: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "feat: add _generateNativeSkillContext method"
```

---

## Task 10: Call _generateNativeSkillContext in Convert Flow

**Files:**
- Modify: `src/converters/claude-to-gemini.js:65-78`

**Step 1: Update convert flow**

Find (lines 65-78):
```javascript
if (this.options.legacy) {
  // Legacy mode: Generate GEMINI.md (context file)
  const contextPath = await this._generateGeminiContext();
  result.files.push(contextPath);
} else {
  // Modern mode: Generate bundled skill in skills/<name>/SKILL.md
  const skillPaths = await this._generateGeminiSkill();
  // Handle both single path (string) and multi-skill (array) returns
  if (Array.isArray(skillPaths)) {
    result.files.push(...skillPaths);
  } else {
    result.files.push(skillPaths);
  }
}
```

Replace with:
```javascript
if (this.options.legacy) {
  // Legacy mode: Generate GEMINI.md (context file)
  const contextPath = await this._generateGeminiContext();
  result.files.push(contextPath);
} else {
  // Modern mode: Generate bundled skill in skills/<name>/SKILL.md
  const skillPaths = await this._generateGeminiSkill();
  // Handle both single path (string) and multi-skill (array) returns
  if (Array.isArray(skillPaths)) {
    result.files.push(...skillPaths);
  } else {
    result.files.push(skillPaths);
  }
  // Also generate GEMINI.md with skill index for native-skill format
  const contextPath = await this._generateNativeSkillContext();
  result.files.push(contextPath);
}
```

**Step 2: Test conversion**

Run: `node src/cli.js convert examples/superpowers -t gemini -o /tmp/task10-test`
Run: `cat /tmp/task10-test/GEMINI.md`
Expected: Context file with skill listing

**Step 3: Commit**

```bash
git add src/converters/claude-to-gemini.js
git commit -m "fix: generate GEMINI.md context file in native-skill mode"
```

---

## Task 11: Final Integration Test

**Step 1: Clean test conversion**

```bash
rm -rf /tmp/final-test
node src/cli.js convert examples/superpowers -t gemini -o /tmp/final-test
```

**Step 2: Verify all fixes**

```bash
# Fix 1: contextFileName present
grep contextFileName /tmp/final-test/gemini-extension.json
# Expected: "contextFileName": "GEMINI.md"

# Fix 2: GEMINI.md exists
cat /tmp/final-test/GEMINI.md | head -10
# Expected: Context file with skill listing

# Fix 3-4: TOML descriptions safe
head -3 /tmp/final-test/commands/code-reviewer.toml
# Expected: No truncated strings

# Fix 5: Namespace stripped
grep -r "superpowers:" /tmp/final-test/commands/ || echo "OK: No namespace found"
# Expected: "OK: No namespace found"

# Fix 6: Kebab-case filenames
ls /tmp/final-test/commands/
# Expected: all kebab-case

# Validation passes
node src/cli.js validate /tmp/final-test
# Expected: Validation passed
```

**Step 3: Commit**

```bash
git add -A
git commit -m "test: verify all Gemini CLI compatibility fixes"
```

---

## Task 12: Push to Update PR

**Step 1: Push changes**

```bash
git push
```

**Step 2: Verify PR updated**

Check: https://github.com/jduncan-rva/skill-porter/pull/1

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix contextFileName | `fix: always include contextFileName` |
| 2 | Add _toKebabCase | `feat: add _toKebabCase helper` |
| 3 | Apply kebab-case | `fix: use kebab-case for filenames` |
| 4 | Add _safeTomlDescription | `feat: add _safeTomlDescription helper` |
| 5-6 | Apply safe TOML | `fix: use safe TOML description` |
| 7 | Store plugin name | `feat: store plugin name in metadata` |
| 8 | Strip namespace | `fix: strip plugin namespace` |
| 9 | Add context generator | `feat: add _generateNativeSkillContext` |
| 10 | Generate context | `fix: generate GEMINI.md in native mode` |
| 11-12 | Test & push | Final verification |
