# Technical Reference

## Architecture
For detailed extension architecture, please refer to `docs/GEMINI_ARCHITECTURE.md` (in Gemini extensions) or the `SKILL.md` structure (in Claude Skills).

## Platform Differences
- **Commands:**
  - Gemini uses `commands/*.toml`
  - Claude uses `.claude/commands/*.md`
- **Agents:**
  - Gemini "Agents" are implemented as Custom Commands.
  - Claude "Subagents" are defined in `SKILL.md` frontmatter.
