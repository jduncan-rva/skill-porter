---
name: context7-auto
description:
  Automatically use Context7 for code generation, library documentation,
  setup instructions, and API references. Use when writing code that uses
  external libraries, setting up tools or frameworks, or needing current
  API documentation.
---

# Context7 Automatic Usage

Always use Context7 MCP tools when you need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the `resolve-library-id` and `query-docs` tools without requiring explicit user requests.

## When to Use Context7 Automatically

- **Code Generation**: When writing code that uses external libraries or frameworks
- **Setup & Configuration**: When setting up tools, libraries, or frameworks
- **API Documentation**: When you need current API documentation for any library
- **Best Practices**: When you need up-to-date examples and patterns
- **Troubleshooting**: When debugging issues related to library usage

## How to Use

1. **Resolve the library ID first**: Use `resolve-library-id` to find the correct Context7 library identifier
2. **Query documentation**: Use `query-docs` with the resolved ID to fetch current documentation
3. **Apply context**: Use the documentation to provide accurate, up-to-date code and guidance

## Examples of Automatic Activation

| User Request | Action |
|-------------|--------|
| "Create a React component with useState" | Resolve react library, query useState docs |
| "Set up a Next.js app with app router" | Resolve nextjs library, query app router setup |
| "How do I use Prisma with PostgreSQL?" | Resolve prisma library, query PostgreSQL setup |
| "Write a Python script using pandas" | Resolve pandas library, query relevant APIs |
| "Configure Tailwind CSS" | Resolve tailwindcss library, query configuration |

## Important Guidelines

- **Proactive usage**: Don't wait for explicit "use context7" requests - automatically use it when relevant
- **Fresh documentation**: Always prefer Context7 docs over training data for current API details
- **Error prevention**: Use docs to avoid deprecated APIs and outdated patterns
- **Multiple libraries**: If the task involves multiple libraries, query each one as needed
- **Limit calls**: Maximum 3 calls per question to avoid excessive lookups

---

*This skill enables automatic Context7 integration for Gemini CLI. Install the [Context7 extension](https://github.com/upstash/context7) to access the MCP tools.*
