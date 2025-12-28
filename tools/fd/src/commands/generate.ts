import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import type { SpecBundle } from '../types/spec.js';
import type { GeneratorTarget } from '../types/generator.js';
import { Generator } from '../core/generator.js';
import { SpecLoader } from '../core/spec-loader.js';
import { SpecLinker } from '../core/spec-linker.js';

interface GenerateOptions {
  only?: string;
  dryRun?: boolean;
  force?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const spinner = ora('Generating code from spec...').start();

  try {
    // Try to load cached bundle first
    let bundle: SpecBundle | null = null;

    try {
      const cached = await fs.readFile(
        path.join(process.cwd(), '.fd/cache/spec.bundle.json'),
        'utf-8'
      );
      bundle = JSON.parse(cached);
    } catch {
      // No cache, need to load and link
      spinner.text = 'Loading and linking spec files...';
      const loader = new SpecLoader();
      const spec = await loader.load();
      const linker = new SpecLinker();
      const linkResult = linker.link(spec);

      if (!linkResult.valid || !linkResult.bundle) {
        spinner.fail(chalk.red('Spec validation failed'));
        console.log(chalk.yellow('Run `fd spec validate` to see errors'));
        process.exit(1);
      }

      bundle = linkResult.bundle;
    }

    // Parse targets
    let targets: GeneratorTarget[] = ['all'];
    if (options.only) {
      targets = options.only.split(',').map((t) => t.trim() as GeneratorTarget);
    }

    // Run generator
    spinner.text = 'Running generators...';
    const generator = new Generator({
      spec: bundle,
      rootDir: process.cwd(),
      profile: bundle.product.profile,
      targets,
      dryRun: options.dryRun || false,
      force: options.force || false,
    });

    const results = await generator.generate();

    // Summary
    let totalFiles = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const result of results) {
      totalFiles += result.files.length;
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    if (totalErrors > 0) {
      spinner.fail(chalk.red(`Generation failed with ${totalErrors} error(s)`));

      for (const result of results) {
        for (const error of result.errors) {
          console.log(chalk.red(`  [${result.target}] ${error.message}`));
        }
      }

      process.exit(1);
    }

    if (options.dryRun) {
      spinner.succeed(chalk.green(`Dry run complete: ${totalFiles} files would be generated`));
    } else {
      spinner.succeed(chalk.green(`Generated ${totalFiles} files`));
    }

    // Print summary
    console.log('');
    console.log(chalk.bold('Generated files by target:'));
    for (const result of results) {
      console.log(chalk.gray(`  ${result.target}: ${result.files.length} files`));
    }

    if (totalWarnings > 0) {
      console.log('');
      console.log(chalk.yellow.bold(`${totalWarnings} warning(s):`));
      for (const result of results) {
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  [${result.target}] ${warning.message}`));
        }
      }
    }

    if (!options.dryRun) {
      console.log('');
      console.log(chalk.gray('Generated code is in __generated__ directories.'));
      console.log(chalk.gray('Custom code goes in extensions/ directories.'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Generation failed'));
    console.error(error);
    process.exit(1);
  }
}
