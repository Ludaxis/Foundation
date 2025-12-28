import chalk from 'chalk';
import ora from 'ora';
import { spawn, execSync } from 'child_process';

interface RunOptions {
  service?: string;
  docker?: boolean;
  migrate?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const spinner = ora('Starting Foundation Dev...').start();

  try {
    const useDocker = options.docker !== false;

    if (useDocker) {
      // Start Docker services
      spinner.text = 'Starting Docker services...';
      await startDockerServices();
      spinner.text = 'Docker services started';
    }

    // Run migrations if requested
    if (options.migrate) {
      spinner.text = 'Running database migrations...';
      await runMigrations();
    }

    spinner.succeed(chalk.green('Development environment ready'));
    console.log('');

    // Determine which services to start
    const services = options.service
      ? [options.service]
      : ['web', 'api', 'worker'];

    console.log(chalk.bold('Starting services:'));
    for (const service of services) {
      console.log(chalk.gray(`  - ${service}`));
    }
    console.log('');

    // Start services
    await startServices(services);
  } catch (error) {
    spinner.fail(chalk.red('Failed to start'));
    console.error(error);
    process.exit(1);
  }
}

async function startDockerServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['compose', 'up', '-d'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Try docker-compose (older syntax)
        const fallback = spawn('docker-compose', ['up', '-d'], {
          cwd: process.cwd(),
          stdio: 'pipe',
        });

        fallback.on('close', (fallbackCode) => {
          if (fallbackCode === 0) {
            resolve();
          } else {
            reject(new Error('Failed to start Docker services'));
          }
        });
      }
    });

    proc.on('error', () => {
      reject(new Error('Docker not available'));
    });
  });
}

async function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', ['--filter', '@foundation/core', 'db:migrate'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Migration failed'));
      }
    });
  });
}

async function startServices(services: string[]): Promise<void> {
  const serviceCommands: Record<string, { filter: string; script: string; port: number }> = {
    web: { filter: '@foundation/web', script: 'dev', port: 3000 },
    api: { filter: '@foundation/core', script: 'dev', port: 4000 },
    worker: { filter: '@foundation/worker', script: 'dev', port: 0 },
  };

  console.log(chalk.bold('Services will be available at:'));
  for (const service of services) {
    const config = serviceCommands[service];
    if (config && config.port > 0) {
      console.log(chalk.cyan(`  ${service}: http://localhost:${config.port}`));
    }
  }
  console.log('');

  // Start all services concurrently
  const procs = services.map((service) => {
    const config = serviceCommands[service];
    if (!config) {
      console.log(chalk.yellow(`Unknown service: ${service}`));
      return null;
    }

    const proc = spawn('pnpm', ['--filter', config.filter, config.script], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('error', (err) => {
      console.error(chalk.red(`Failed to start ${service}: ${err.message}`));
    });

    return proc;
  });

  // Wait for interrupt
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nShutting down...'));
    for (const proc of procs) {
      if (proc) proc.kill('SIGINT');
    }
    process.exit(0);
  });

  // Keep the process running
  await new Promise(() => {});
}
