/**
 * PR Generation Feature
 * Creates pull requests to add dual-platform support to repositories
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class PRGenerator {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
    this.branchName = `skill-porter/add-dual-platform-support`;
  }

  /**
   * Generate a pull request for dual-platform support
   * @param {object} options - PR generation options
   * @returns {Promise<{success: boolean, prUrl: string, errors: array}>}
   */
  async generate(options = {}) {
    const {
      targetPlatform,
      remote = 'origin',
      baseBranch = 'main',
      draft = false
    } = options;

    const result = {
      success: false,
      prUrl: null,
      errors: [],
      branch: this.branchName
    };

    try {
      // Step 1: Check if gh CLI is available
      await this._checkGHCLI();

      // Step 2: Check if we're in a git repository
      await this._checkGitRepo();

      // Step 3: Check for uncommitted changes
      const hasChanges = await this._hasUncommittedChanges();
      if (!hasChanges) {
        throw new Error('No uncommitted changes found. Run conversion first.');
      }

      // Step 4: Create new branch
      await this._createBranch();

      // Step 5: Commit changes
      await this._commitChanges(targetPlatform);

      // Step 6: Push branch
      await this._pushBranch(remote);

      // Step 7: Create PR
      const prUrl = await this._createPR(targetPlatform, baseBranch, draft);
      result.prUrl = prUrl;

      result.success = true;
    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Check if gh CLI is installed
   */
  async _checkGHCLI() {
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch {
      throw new Error('GitHub CLI (gh) not found. Install from https://cli.github.com');
    }

    // Check if authenticated
    try {
      execSync('gh auth status', { stdio: 'ignore' });
    } catch {
      throw new Error('GitHub CLI not authenticated. Run: gh auth login');
    }
  }

  /**
   * Check if directory is a git repository
   */
  async _checkGitRepo() {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.sourcePath,
        stdio: 'ignore'
      });
    } catch {
      throw new Error('Not a git repository. Initialize with: git init');
    }
  }

  /**
   * Check for uncommitted changes
   */
  async _hasUncommittedChanges() {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.sourcePath,
        encoding: 'utf8'
      });
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Create a new branch
   */
  async _createBranch() {
    try {
      // Check if branch already exists
      try {
        execSync(`git rev-parse --verify ${this.branchName}`, {
          cwd: this.sourcePath,
          stdio: 'ignore'
        });
        // Branch exists, check it out
        execSync(`git checkout ${this.branchName}`, {
          cwd: this.sourcePath,
          stdio: 'ignore'
        });
      } catch {
        // Branch doesn't exist, create it
        execSync(`git checkout -b ${this.branchName}`, {
          cwd: this.sourcePath,
          stdio: 'ignore'
        });
      }
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Commit changes
   */
  async _commitChanges(targetPlatform) {
    const platformName = targetPlatform === 'gemini' ? 'Gemini CLI' : 'Claude Code';
    const otherPlatform = targetPlatform === 'gemini' ? 'Claude Code' : 'Gemini CLI';

    const commitMessage = `Add ${platformName} support for cross-platform compatibility

This PR adds ${platformName} support while maintaining existing ${otherPlatform} functionality, making this skill/extension work on both platforms.

## Changes

${targetPlatform === 'gemini' ? `
- Added \`gemini-extension.json\` - Gemini CLI manifest
- Added \`GEMINI.md\` - Gemini context file
- Created \`shared/\` directory for shared documentation
- Transformed MCP server paths for Gemini compatibility
- Converted tool restrictions (allowed-tools → excludeTools)
- Inferred settings schema from environment variables
` : `
- Added \`SKILL.md\` - Claude Code skill definition
- Added \`.claude-plugin/marketplace.json\` - Claude plugin config
- Created \`shared/\` directory for shared documentation
- Transformed MCP server paths for Claude compatibility
- Converted tool restrictions (excludeTools → allowed-tools)
- Documented environment variables from settings
`}

## Benefits

- ✅ Single codebase works on both AI platforms
- ✅ 85%+ code reuse (shared MCP server and docs)
- ✅ Easier maintenance (fix once, works everywhere)
- ✅ Broader user base (Claude + Gemini communities)

## Testing

- [x] Conversion validated with skill-porter
- [x] Files meet ${platformName} requirements
- [ ] Tested installation on ${platformName}
- [ ] Verified functionality on both platforms

## Installation

### ${otherPlatform} (existing)
\`\`\`bash
${otherPlatform === 'Claude Code' ?
  'cp -r . ~/.claude/skills/$(basename $PWD)' :
  'gemini extensions install .'}
\`\`\`

### ${platformName} (new)
\`\`\`bash
${platformName === 'Gemini CLI' ?
  'gemini extensions install .' :
  'cp -r . ~/.claude/skills/$(basename $PWD)'}
\`\`\`

---

*Generated with [skill-porter](https://github.com/jduncan-rva/skill-porter) - Universal tool for cross-platform AI skills*`;

    try {
      // Stage all new/modified files
      execSync('git add .', { cwd: this.sourcePath });

      // Create commit
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: this.sourcePath,
        stdio: 'ignore'
      });
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  /**
   * Push branch to remote
   */
  async _pushBranch(remote) {
    try {
      execSync(`git push -u ${remote} ${this.branchName}`, {
        cwd: this.sourcePath,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to push branch: ${error.message}`);
    }
  }

  /**
   * Create pull request
   */
  async _createPR(targetPlatform, baseBranch, draft) {
    const platformName = targetPlatform === 'gemini' ? 'Gemini CLI' : 'Claude Code';

    const title = `Add ${platformName} support for cross-platform compatibility`;
    const body = `This PR adds ${platformName} support, making this skill/extension work on both Claude Code and Gemini CLI.

## Overview

Converted using [skill-porter](https://github.com/jduncan-rva/skill-porter) to enable dual-platform deployment with minimal code duplication.

## What Changed

${targetPlatform === 'gemini' ? '✅ Added Gemini CLI support' : '✅ Added Claude Code support'}
- Platform-specific configuration files
- Shared documentation structure
- Converted tool restrictions and settings

## Benefits

- 🌐 Works on both AI platforms
- 🔄 85%+ code reuse
- 📦 Single repository
- 🚀 Easier maintenance

## Testing Checklist

- [x] Conversion validated
- [ ] Tested on ${platformName}
- [ ] Documentation updated

## Questions?

See the [skill-porter documentation](https://github.com/jduncan-rva/skill-porter) for details on universal skills.`;

    try {
      const draftFlag = draft ? '--draft' : '';
      const output = execSync(
        `gh pr create --base ${baseBranch} --title "${title}" --body "${body.replace(/"/g, '\\"')}" ${draftFlag}`,
        {
          cwd: this.sourcePath,
          encoding: 'utf8'
        }
      );

      // Extract PR URL from output
      const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
      if (urlMatch) {
        return urlMatch[0];
      }

      return 'PR created successfully';
    } catch (error) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }
}

export default PRGenerator;
