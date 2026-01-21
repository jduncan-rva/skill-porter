# Superpowers for Gemini CLI

A comprehensive software development workflow system with 14 skills for TDD, debugging, planning, and collaboration.

Converted from the [Claude Code Superpowers plugin](https://github.com/obra/superpowers) using [skill-porter](https://github.com/jduncan-rva/skill-porter).

## Installation

```bash
gemini extensions install ./superpowers-gemini
```

Or install from a remote location:
```bash
gemini extensions install github:yourusername/superpowers-gemini
```

Verify skills are discovered:
```bash
gemini skills list
```

## Skills (14)

| Skill | Description |
|-------|-------------|
| `brainstorming` | Use before any creative work to explore requirements and design |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior |
| `test-driven-development` | Use when implementing any feature or bugfix |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task |
| `executing-plans` | Use when you have a written implementation plan to execute |
| `verification-before-completion` | Use before claiming work is complete or creating PRs |
| `dispatching-parallel-agents` | Use when facing 2+ independent tasks |
| `subagent-driven-development` | Use when executing implementation plans with independent tasks |
| `using-git-worktrees` | Use when starting feature work that needs isolation |
| `finishing-a-development-branch` | Use when implementation is complete and ready to integrate |
| `requesting-code-review` | Use when completing tasks or implementing major features |
| `receiving-code-review` | Use when receiving code review feedback |
| `writing-skills` | Use when creating or editing skills |
| `using-superpowers` | Use when starting any conversation |

## Commands (4)

| Command | Description |
|---------|-------------|
| `/brainstorm` | Invoke brainstorming skill for creative work |
| `/write-plan` | Create detailed implementation plan |
| `/execute-plan` | Execute plan with review checkpoints |
| `/code-reviewer` | Review code against plans and standards |

## Usage Examples

```
# Start with brainstorming before any feature work
/brainstorm Add user authentication to the app

# Create a detailed plan
/write-plan

# Execute with review checkpoints
/execute-plan

# Review the implementation
/code-reviewer
```

## Non-Portable Features

The following features from the original Claude Code plugin were not converted:

- **Session hooks** (`hooks/hooks.json`): Gemini CLI doesn't have an equivalent hook system. You can manually add context using GEMINI.md files or custom commands.

## License

MIT - Same license as the original superpowers plugin.

---

*Converted using [skill-porter](https://github.com/jduncan-rva/skill-porter)*
