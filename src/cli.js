#!/usr/bin/env node

/**
 * Skill Porter CLI
 * Command-line interface for converting between Claude and Gemini formats
 */

import { program } from 'commander';
import chalk from 'chalk';
import { SkillPorter, PLATFORM_TYPES } from './index.js';
import { PRGenerator } from './optional-features/pr-generator.js';
import { ForkSetup } from './optional-features/fork-setup.js';
import fs from 'fs/promises';
import path from 'path';

const porter = new SkillPorter();

// Version from package.json
const packagePath = new URL('../package.json', import.meta.url);
const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));

program
  .name('skill-porter')
  .description('Universal tool to convert Claude Code skills to Gemini CLI extensions and vice versa')
  .version(packageData.version);

// Convert command
program
  .command('convert <source-path>')
  .description('Convert a skill or extension between platforms')
  .option('-t, --to <platform>', 'Target platform (claude or gemini)', 'gemini')
  .option('-o, --output <path>', 'Output directory path')
  .option('--no-validate', 'Skip validation after conversion')
  .action(async (sourcePath, options) => {
    try {
      console.log(chalk.blue('\n🔄 Converting skill/extension...\n'));

      const result = await porter.convert(
        path.resolve(sourcePath),
        options.to,
        {
          outputPath: options.output ? path.resolve(options.output) : undefined,
          validate: options.validate !== false
        }
      );

      if (result.success) {
        console.log(chalk.green('✓ Conversion successful!\n'));

        if (result.files && result.files.length > 0) {
          console.log(chalk.bold('Generated files:'));
          result.files.forEach(file => {
            console.log(chalk.gray(`  - ${file}`));
          });
          console.log();
        }

        if (result.validation) {
          if (result.validation.valid) {
            console.log(chalk.green('✓ Validation passed\n'));
          } else {
            console.log(chalk.yellow('⚠ Validation warnings:\n'));
            result.validation.errors.forEach(error => {
              console.log(chalk.yellow(`  - ${error}`));
            });
            console.log();
          }

          if (result.validation.warnings && result.validation.warnings.length > 0) {
            console.log(chalk.yellow('Warnings:'));
            result.validation.warnings.forEach(warning => {
              console.log(chalk.yellow(`  - ${warning}`));
            });
            console.log();
          }
        }

        // Installation instructions
        const targetPlatform = options.to;
        console.log(chalk.bold('Next steps:'));
        if (targetPlatform === PLATFORM_TYPES.GEMINI) {
          console.log(chalk.gray(`  gemini extensions install ${options.output || sourcePath}`));
        } else {
          console.log(chalk.gray(`  cp -r ${options.output || sourcePath} ~/.claude/skills/`));
        }
        console.log();
      } else {
        console.log(chalk.red('✗ Conversion failed\n'));
        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red('Errors:'));
          result.errors.forEach(error => {
            console.log(chalk.red(`  - ${error}`));
          });
          console.log();
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <path>')
  .description('Analyze a directory to detect platform type')
  .action(async (dirPath) => {
    try {
      console.log(chalk.blue('\n🔍 Analyzing directory...\n'));

      const detection = await porter.analyze(path.resolve(dirPath));

      console.log(chalk.bold('Detection Results:'));
      console.log(chalk.gray(`  Platform: ${chalk.white(detection.platform)}`));
      console.log(chalk.gray(`  Confidence: ${chalk.white(detection.confidence)}\n`));

      if (detection.files.claude.length > 0) {
        console.log(chalk.bold('Claude files found:'));
        detection.files.claude.forEach(file => {
          const status = file.valid ? chalk.green('✓') : chalk.red('✗');
          const issue = file.issue ? chalk.gray(` (${file.issue})`) : '';
          console.log(`  ${status} ${file.file}${issue}`);
        });
        console.log();
      }

      if (detection.files.gemini.length > 0) {
        console.log(chalk.bold('Gemini files found:'));
        detection.files.gemini.forEach(file => {
          const status = file.valid ? chalk.green('✓') : chalk.red('✗');
          const issue = file.issue ? chalk.gray(` (${file.issue})`) : '';
          console.log(`  ${status} ${file.file}${issue}`);
        });
        console.log();
      }

      if (detection.files.shared.length > 0) {
        console.log(chalk.bold('Shared files found:'));
        detection.files.shared.forEach(file => {
          console.log(chalk.gray(`  - ${file.file}`));
        });
        console.log();
      }

      if (detection.metadata.claude || detection.metadata.gemini) {
        console.log(chalk.bold('Metadata:'));
        if (detection.metadata.claude) {
          console.log(chalk.gray(`  Name: ${detection.metadata.claude.name || 'N/A'}`));
          console.log(chalk.gray(`  Description: ${detection.metadata.claude.description || 'N/A'}`));
        }
        if (detection.metadata.gemini) {
          console.log(chalk.gray(`  Name: ${detection.metadata.gemini.name || 'N/A'}`));
          console.log(chalk.gray(`  Version: ${detection.metadata.gemini.version || 'N/A'}`));
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate <path>')
  .description('Validate a skill or extension')
  .option('-p, --platform <type>', 'Platform type (claude, gemini, or universal)')
  .action(async (dirPath, options) => {
    try {
      console.log(chalk.blue('\n✓ Validating...\n'));

      const validation = await porter.validate(
        path.resolve(dirPath),
        options.platform
      );

      if (validation.valid) {
        console.log(chalk.green('✓ Validation passed!\n'));
      } else {
        console.log(chalk.red('✗ Validation failed\n'));
      }

      if (validation.errors && validation.errors.length > 0) {
        console.log(chalk.red('Errors:'));
        validation.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
        console.log();
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.log(chalk.yellow('Warnings:'));
        validation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  - ${warning}`));
        });
        console.log();
      }

      if (!validation.valid) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Make universal command
program
  .command('universal <source-path>')
  .description('Make a skill/extension work on both platforms')
  .option('-o, --output <path>', 'Output directory path')
  .action(async (sourcePath, options) => {
    try {
      console.log(chalk.blue('\n🌐 Creating universal skill/extension...\n'));

      const result = await porter.makeUniversal(
        path.resolve(sourcePath),
        {
          outputPath: options.output ? path.resolve(options.output) : undefined
        }
      );

      if (result.success) {
        console.log(chalk.green('✓ Successfully created universal skill/extension!\n'));
        console.log(chalk.gray('Your skill/extension now works with both Claude Code and Gemini CLI.\n'));
      } else {
        console.log(chalk.red('✗ Failed to create universal skill/extension\n'));
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => {
            console.log(chalk.red(`  - ${error}`));
          });
          console.log();
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Create PR command
program
  .command('create-pr <source-path>')
  .description('Create a pull request to add dual-platform support')
  .option('-t, --to <platform>', 'Target platform to add (claude or gemini)', 'gemini')
  .option('-b, --base <branch>', 'Base branch for PR', 'main')
  .option('-r, --remote <name>', 'Git remote name', 'origin')
  .option('--draft', 'Create as draft PR')
  .action(async (sourcePath, options) => {
    try {
      console.log(chalk.blue('\n📝 Creating pull request...\n'));

      // First, convert if not already done
      const result = await porter.convert(
        path.resolve(sourcePath),
        options.to,
        { validate: true }
      );

      if (!result.success) {
        console.log(chalk.red('✗ Conversion failed\n'));
        result.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
        process.exit(1);
      }

      console.log(chalk.green('✓ Conversion completed\n'));

      // Generate PR
      const prGen = new PRGenerator(path.resolve(sourcePath));
      const prResult = await prGen.generate({
        targetPlatform: options.to,
        remote: options.remote,
        baseBranch: options.base,
        draft: options.draft
      });

      if (prResult.success) {
        console.log(chalk.green('✓ Pull request created!\n'));
        console.log(chalk.bold('PR URL:'));
        console.log(chalk.cyan(`  ${prResult.prUrl}\n`));
        console.log(chalk.gray(`Branch: ${prResult.branch}\n`));
      } else {
        console.log(chalk.red('✗ Failed to create pull request\n'));
        prResult.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Fork setup command
program
  .command('fork <source-path>')
  .description('Create a fork with dual-platform setup')
  .option('-l, --location <path>', 'Fork location directory', '.')
  .option('-u, --url <url>', 'Repository URL to clone (optional)')
  .action(async (sourcePath, options) => {
    try {
      console.log(chalk.blue('\n🍴 Setting up fork with dual-platform support...\n'));

      const forkSetup = new ForkSetup(path.resolve(sourcePath));
      const result = await forkSetup.setup({
        forkLocation: path.resolve(options.location),
        repoUrl: options.url
      });

      if (result.success) {
        console.log(chalk.green('✓ Fork created successfully!\n'));
        console.log(chalk.bold('Fork location:'));
        console.log(chalk.cyan(`  ${result.forkPath}\n`));

        console.log(chalk.bold('Installations:'));
        console.log(chalk.gray(`  Claude Code: ${result.installations.claude || 'N/A'}`));
        console.log(chalk.gray(`  Gemini CLI:  ${result.installations.gemini || 'N/A'}\n`));

        console.log(chalk.bold('Next steps:'));
        console.log(chalk.gray('  1. Navigate to fork: cd ' + result.forkPath));
        console.log(chalk.gray('  2. For Gemini: ' + result.installations.gemini));
        console.log(chalk.gray('  3. Test on both platforms\n'));
      } else {
        console.log(chalk.red('✗ Fork setup failed\n'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();
