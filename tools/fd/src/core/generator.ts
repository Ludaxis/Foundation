import fs from 'fs/promises';
import path from 'path';
import type {
  GeneratorContext,
  GeneratorResult,
  GeneratorTarget,
  GeneratedFile,
  TemplateHelpers,
} from '../types/generator.js';
import { DbGenerator } from '../generators/db-generator.js';
import { ApiGenerator } from '../generators/api-generator.js';
import { SdkGenerator } from '../generators/sdk-generator.js';
import { UiGenerator } from '../generators/ui-generator.js';
import { JobsGenerator } from '../generators/jobs-generator.js';

export class Generator {
  private context: GeneratorContext;
  private helpers: TemplateHelpers;

  constructor(context: GeneratorContext) {
    this.context = context;
    this.helpers = this.createHelpers();
  }

  async generate(): Promise<GeneratorResult[]> {
    const results: GeneratorResult[] = [];
    const targets = this.context.targets.includes('all' as GeneratorTarget)
      ? ['db', 'api', 'sdk', 'ui', 'jobs'] as GeneratorTarget[]
      : this.context.targets;

    for (const target of targets) {
      const result = await this.generateTarget(target);
      results.push(result);
    }

    return results;
  }

  private async generateTarget(target: GeneratorTarget): Promise<GeneratorResult> {
    const generator = this.getGenerator(target);
    const files = await generator.generate();

    if (!this.context.dryRun) {
      await this.writeFiles(files);
    }

    return {
      target,
      files,
      errors: [],
      warnings: [],
    };
  }

  private getGenerator(target: GeneratorTarget) {
    const ctx = { spec: this.context.spec, helpers: this.helpers, rootDir: this.context.rootDir };

    switch (target) {
      case 'db':
        return new DbGenerator(ctx);
      case 'api':
        return new ApiGenerator(ctx);
      case 'sdk':
        return new SdkGenerator(ctx);
      case 'ui':
        return new UiGenerator(ctx);
      case 'jobs':
        return new JobsGenerator(ctx);
      default:
        throw new Error(`Unknown generator target: ${target}`);
    }
  }

  private async writeFiles(files: GeneratedFile[]): Promise<void> {
    for (const file of files) {
      const filePath = path.join(this.context.rootDir, file.path);
      const dir = path.dirname(filePath);

      await fs.mkdir(dir, { recursive: true });

      // Check if file exists and force flag
      try {
        await fs.access(filePath);
        if (!this.context.force && !file.path.includes('__generated__')) {
          // Skip non-generated files that already exist
          continue;
        }
        file.overwritten = true;
      } catch {
        file.overwritten = false;
      }

      await fs.writeFile(filePath, file.content, 'utf-8');
    }
  }

  private createHelpers(): TemplateHelpers {
    return {
      toPascalCase: (str: string) =>
        str
          .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
          .replace(/^(.)/, (_, c) => c.toUpperCase()),

      toCamelCase: (str: string) =>
        str
          .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
          .replace(/^(.)/, (_, c) => c.toLowerCase()),

      toSnakeCase: (str: string) =>
        str
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '')
          .replace(/-/g, '_'),

      toKebabCase: (str: string) =>
        str
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, '')
          .replace(/_/g, '-'),

      toUpperSnakeCase: (str: string) =>
        str
          .replace(/([A-Z])/g, '_$1')
          .toUpperCase()
          .replace(/^_/, '')
          .replace(/-/g, '_'),

      pluralize: (str: string) => {
        if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
        if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh'))
          return str + 'es';
        return str + 's';
      },

      singularize: (str: string) => {
        if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
        if (str.endsWith('es')) return str.slice(0, -2);
        if (str.endsWith('s')) return str.slice(0, -1);
        return str;
      },
    };
  }
}
