# Contributing to Skill Porter

Thank you for considering contributing to Skill Porter! This project aims to make cross-platform AI tool development easier for everyone.

## How to Contribute

### Reporting Issues

- Use the GitHub issue tracker
- Describe the issue clearly with examples
- Include version information and platform details
- Provide sample code or skills/extensions that reproduce the issue

### Suggesting Features

- Open an issue with the "enhancement" label
- Describe the feature and its use case
- Explain how it would benefit the community

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (both Claude and Gemini conversions)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/skill-porter
cd skill-porter

# Install dependencies
npm install

# Run tests
npm test

# Test CLI locally
node src/cli.js analyze ../path/to/skill
```

## Testing Guidelines

When adding features or fixing bugs:

1. Test with Claude skills conversion to Gemini
2. Test with Gemini extensions conversion to Claude
3. Test with universal skills/extensions
4. Verify validation passes for generated files
5. Check that MCP server configurations are preserved

## Code Style

- Use ES modules (import/export)
- Follow existing code structure
- Add JSDoc comments for public APIs
- Keep functions focused and single-purpose
- Use meaningful variable names

## Adding Platform Support

If you're adding support for a new platform or feature:

1. Update the detector in `src/analyzers/detector.js`
2. Add conversion logic in `src/converters/`
3. Update validation in `src/analyzers/validator.js`
4. Update documentation and README
5. Add examples to `examples/` directory

## Questions?

Open an issue or start a discussion. We're here to help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
