import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';

interface TestOptions {
  unit?: boolean;
  e2e?: boolean;
  coverage?: boolean;
}

export async function testCommand(options: TestOptions): Promise<void> {
  const spinner = ora('Running tests...').start();

  try {
    const testTypes: string[] = [];

    if (options.unit || (!options.unit && !options.e2e)) {
      testTypes.push('unit');
    }
    if (options.e2e) {
      testTypes.push('e2e');
    }

    spinner.succeed(chalk.green('Starting test runner'));
    console.log('');

    for (const type of testTypes) {
      console.log(chalk.bold(`Running ${type} tests...`));
      console.log('');

      await runTests(type, options.coverage);
    }
  } catch (error) {
    spinner.fail(chalk.red('Tests failed'));
    console.error(error);
    process.exit(1);
  }
}

async function runTests(type: string, coverage?: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['vitest', 'run'];

    if (type === 'e2e') {
      args.push('--config', 'vitest.e2e.config.ts');
    }

    if (coverage) {
      args.push('--coverage');
    }

    const proc = spawn('pnpm', ['-r', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${type} tests failed`));
      }
    });
  });
}
