import { BaseGenerator, type GeneratorConfig } from './base-generator.js';
import type { GeneratedFile } from '../types/generator.js';
import type { JobSpec } from '../types/spec.js';

export class JobsGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    super(config);
  }

  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate job handlers
    for (const [name, job] of Object.entries(this.spec.jobs.jobs || {})) {
      files.push(this.generateJobHandler(name, job));
    }

    // Generate jobs index
    files.push(this.generateJobsIndex());

    // Generate queue configuration
    files.push(this.generateQueueConfig());

    // Generate worker setup
    files.push(this.generateWorkerSetup());

    return files;
  }

  private generateJobHandler(name: string, job: JobSpec): GeneratedFile {
    const pascalName = this.helpers.toPascalCase(name);
    const camelName = this.helpers.toCamelCase(name);
    const kebabName = this.helpers.toKebabCase(name);

    const inputType = job.input
      ? `{${Object.entries(job.input)
          .map(([k, v]) => ` ${k}${v.required ? '' : '?'}: ${this.getTsType(v.type)}`)
          .join(';')} }`
      : 'void';

    const content = `${this.generateHeader(`Job Handler: ${name}`)}
import type { Job } from 'bullmq';
import { logger } from '../lib/logger.js';

export interface ${pascalName}Input ${inputType === 'void' ? '{}' : inputType}

export interface ${pascalName}Output {
  success: boolean;
  message?: string;
  data?: unknown;
}

export const ${camelName}JobName = '${name}' as const;

export async function ${camelName}Handler(
  job: Job<${pascalName}Input>
): Promise<${pascalName}Output> {
  const { data } = job;

  logger.info({ jobId: job.id, jobName: '${name}' }, 'Processing job');

  try {
    // TODO: Implement job logic
    ${job.description ? `// ${job.description}` : ''}

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info({ jobId: job.id }, 'Job completed successfully');

    return {
      success: true,
      message: 'Job completed',
    };
  } catch (error) {
    logger.error({ jobId: job.id, error }, 'Job failed');
    throw error;
  }
}

// Job configuration
export const ${camelName}Config = {
  name: '${name}',
  queue: '${job.queue || 'default'}',
  options: {
    attempts: ${job.retry?.attempts || 3},
    backoff: {
      type: '${job.retry?.backoff || 'exponential'}',
      delay: ${job.retry?.delay || 1000},
    },
    ${job.timeout ? `timeout: ${job.timeout},` : ''}
  },
  ${job.cron ? `cron: '${job.cron}',` : ''}
};
`;

    return this.createFile(`services/worker/src/__generated__/jobs/${kebabName}.job.ts`, content);
  }

  private generateJobsIndex(): GeneratedFile {
    const jobs = Object.keys(this.spec.jobs.jobs || {});
    const imports = jobs.map((name) => {
      const camelName = this.helpers.toCamelCase(name);
      const kebabName = this.helpers.toKebabCase(name);
      return `import { ${camelName}Handler, ${camelName}Config } from './jobs/${kebabName}.job.js';`;
    });

    const handlers = jobs.map((name) => {
      const camelName = this.helpers.toCamelCase(name);
      return `  '${name}': ${camelName}Handler,`;
    });

    const configs = jobs.map((name) => {
      const camelName = this.helpers.toCamelCase(name);
      return `  '${name}': ${camelName}Config,`;
    });

    const content = `${this.generateHeader('Jobs Index')}
${imports.join('\n')}

export const jobHandlers = {
${handlers.join('\n')}
} as const;

export const jobConfigs = {
${configs.join('\n')}
} as const;

export type JobName = keyof typeof jobHandlers;
`;

    return this.createFile('services/worker/src/__generated__/index.ts', content);
  }

  private generateQueueConfig(): GeneratedFile {
    const queues = Object.entries(this.spec.jobs.queues || {});

    const queueDefs = queues.map(([name, queue]) => `
  '${name}': {
    name: '${name}',
    concurrency: ${queue.concurrency || 5},
    priority: ${queue.priority || 0},
    ${queue.rate_limit ? `rateLimit: { max: ${queue.rate_limit.max}, duration: ${queue.rate_limit.duration} },` : ''}
  },`);

    const content = `${this.generateHeader('Queue Configuration')}
export interface QueueConfig {
  name: string;
  concurrency: number;
  priority: number;
  rateLimit?: {
    max: number;
    duration: number;
  };
}

export const queueConfigs: Record<string, QueueConfig> = {
  default: {
    name: 'default',
    concurrency: 5,
    priority: 0,
  },${queueDefs.join('')}
};

export const getQueueConfig = (name: string): QueueConfig => {
  return queueConfigs[name] || queueConfigs.default;
};
`;

    return this.createFile('services/worker/src/__generated__/queues.ts', content);
  }

  private generateWorkerSetup(): GeneratedFile {
    const content = `${this.generateHeader('Worker Setup')}
import { Worker, Queue } from 'bullmq';
import type { Job, Processor } from 'bullmq';
import { jobHandlers, jobConfigs, type JobName } from './index.js';
import { queueConfigs, getQueueConfig } from './queues.js';
import { logger } from '../lib/logger.js';

export interface WorkerSetupOptions {
  connection: {
    host: string;
    port: number;
    password?: string;
  };
}

export function setupWorkers(options: WorkerSetupOptions): Map<string, Worker> {
  const workers = new Map<string, Worker>();

  // Group jobs by queue
  const jobsByQueue = new Map<string, JobName[]>();

  for (const [jobName, config] of Object.entries(jobConfigs)) {
    const queueName = config.queue;
    if (!jobsByQueue.has(queueName)) {
      jobsByQueue.set(queueName, []);
    }
    jobsByQueue.get(queueName)!.push(jobName as JobName);
  }

  // Create worker for each queue
  for (const [queueName, jobNames] of jobsByQueue) {
    const queueConfig = getQueueConfig(queueName);

    const processor: Processor = async (job: Job) => {
      const handler = jobHandlers[job.name as JobName];
      if (!handler) {
        throw new Error(\`Unknown job: \${job.name}\`);
      }
      return handler(job);
    };

    const worker = new Worker(queueName, processor, {
      connection: options.connection,
      concurrency: queueConfig.concurrency,
      limiter: queueConfig.rateLimit,
    });

    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
    });

    worker.on('failed', (job, error) => {
      logger.error({ jobId: job?.id, jobName: job?.name, error }, 'Job failed');
    });

    worker.on('error', (error) => {
      logger.error({ queue: queueName, error }, 'Worker error');
    });

    workers.set(queueName, worker);
    logger.info({ queue: queueName, jobs: jobNames }, 'Worker started');
  }

  return workers;
}

export function setupQueues(options: WorkerSetupOptions): Map<string, Queue> {
  const queues = new Map<string, Queue>();

  for (const queueName of Object.keys(queueConfigs)) {
    const queue = new Queue(queueName, {
      connection: options.connection,
    });
    queues.set(queueName, queue);
  }

  return queues;
}

export async function scheduleJob<T extends JobName>(
  queues: Map<string, Queue>,
  jobName: T,
  data: Parameters<typeof jobHandlers[T]>[0] extends Job<infer D> ? D : never,
  options?: { delay?: number; priority?: number }
): Promise<string> {
  const config = jobConfigs[jobName];
  const queue = queues.get(config.queue);

  if (!queue) {
    throw new Error(\`Queue not found: \${config.queue}\`);
  }

  const job = await queue.add(jobName, data, {
    ...config.options,
    delay: options?.delay,
    priority: options?.priority,
  });

  return job.id!;
}
`;

    return this.createFile('services/worker/src/__generated__/setup.ts', content);
  }

  private getTsType(type: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      uuid: 'string',
      date: 'string',
    };
    return map[type] || 'unknown';
  }
}
