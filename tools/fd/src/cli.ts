#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { validateCommand } from './commands/validate.js';
import { planCommand } from './commands/plan.js';
import { generateCommand } from './commands/generate.js';
import { runCommand } from './commands/run.js';
import { testCommand } from './commands/test.js';

const program = new Command();

program
  .name('fd')
  .description('Foundation Dev CLI - Compile specs into working MVPs')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Foundation Dev project')
  .option('--preset <preset>', 'Use a preset (ledgerflow, clipflow)', 'ledgerflow')
  .option('--name <name>', 'Project name')
  .option('--skip-install', 'Skip dependency installation')
  .action(initCommand);

program
  .command('spec')
  .description('Spec management commands')
  .command('validate')
  .description('Validate spec files against schemas')
  .option('--strict', 'Enable strict validation')
  .option('--profile <profile>', 'Validate for specific profile (dev, prod)')
  .action(validateCommand);

program
  .command('validate')
  .description('Validate spec files (alias for spec validate)')
  .option('--strict', 'Enable strict validation')
  .option('--profile <profile>', 'Validate for specific profile (dev, prod)')
  .action(validateCommand);

program
  .command('plan')
  .description('Generate implementation plan from specs')
  .option('--output <path>', 'Output path for plan', 'docs/plan.md')
  .action(planCommand);

program
  .command('generate')
  .description('Generate code from specs')
  .option('--only <targets>', 'Generate only specific targets (db,api,sdk,ui,jobs)')
  .option('--dry-run', 'Show what would be generated without writing')
  .option('--force', 'Overwrite existing generated files')
  .action(generateCommand);

program
  .command('run')
  .description('Run the full stack locally')
  .option('--service <service>', 'Run only specific service (web, api, worker)')
  .option('--no-docker', 'Skip Docker services (db, redis)')
  .option('--migrate', 'Run database migrations before starting')
  .action(runCommand);

program
  .command('test')
  .description('Run tests')
  .option('--unit', 'Run unit tests only')
  .option('--e2e', 'Run e2e tests only')
  .option('--coverage', 'Generate coverage report')
  .action(testCommand);

program.on('command:*', () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.gray('Run fd --help for available commands'));
  process.exit(1);
});

program.parse();
