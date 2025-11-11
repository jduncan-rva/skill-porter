#!/usr/bin/env node

/**
 * Skill Porter CLI
 * Command-line interface for converting between Claude and Gemini formats
 */

import { program } from 'commander';
import chalk from 'chalk';
import { SkillPorter, PLATFORM_TYPES } from './index.js';
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

program.parse();
