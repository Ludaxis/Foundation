import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { SpecLoader } from '../core/spec-loader.js';
import { SpecValidator } from '../core/spec-validator.js';
import { SpecLinker } from '../core/spec-linker.js';

interface ValidateOptions {
  strict?: boolean;
  profile?: 'dev' | 'prod';
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const spinner = ora('Validating spec files...').start();

  try {
    // Load specs
    spinner.text = 'Loading spec files...';
    const loader = new SpecLoader();
    const spec = await loader.load();

    // Validate against schema
    spinner.text = 'Validating schema...';
    const validator = new SpecValidator();
    const validationResult = await validator.validate(spec, {
      strict: options.strict,
      profile: options.profile,
    });

    // Cross-reference linking
    spinner.text = 'Linking cross-references...';
    const linker = new SpecLinker();
    const linkResult = linker.link(spec);

    // Collect all errors and warnings
    const allErrors = [...validationResult.errors, ...linkResult.errors];
    const allWarnings = [...validationResult.warnings, ...linkResult.warnings];

    if (allErrors.length > 0) {
      spinner.fail(chalk.red('Validation failed'));
      console.log('');

      console.log(chalk.red.bold(`${allErrors.length} error(s) found:`));
      for (const error of allErrors) {
        console.log(chalk.red(`  - ${error.path || error.source}: ${error.message}`));
      }
      console.log('');

      if (allWarnings.length > 0) {
        console.log(chalk.yellow.bold(`${allWarnings.length} warning(s):`));
        for (const warning of allWarnings) {
          console.log(chalk.yellow(`  - ${warning.path}: ${warning.message}`));
        }
      }

      process.exit(1);
    }

    // Write bundle to cache
    if (linkResult.bundle) {
      const cacheDir = path.join(process.cwd(), '.fd/cache');
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, 'spec.bundle.json'),
        JSON.stringify(linkResult.bundle, null, 2)
      );
    }

    spinner.succeed(chalk.green('Validation passed'));

    if (allWarnings.length > 0) {
      console.log('');
      console.log(chalk.yellow.bold(`${allWarnings.length} warning(s):`));
      for (const warning of allWarnings) {
        console.log(chalk.yellow(`  - ${warning.path}: ${warning.message}`));
        if (warning.suggestion) {
          console.log(chalk.gray(`    Suggestion: ${warning.suggestion}`));
        }
      }
    }

    console.log('');
    console.log(chalk.gray(`Spec bundle cached at .fd/cache/spec.bundle.json`));
    console.log(chalk.gray(`Spec hash: ${linkResult.bundle?._meta.hash}`));
  } catch (error) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(error);
    process.exit(1);
  }
}
