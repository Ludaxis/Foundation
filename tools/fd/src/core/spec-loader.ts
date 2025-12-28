import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import fg from 'fast-glob';
import type { Spec, ProductSpec, EntitySpec, ActionSpec, FlowSpec, PoliciesSpec, UiSpec, MetricsSpec, JobsSpec } from '../types/spec.js';

export class SpecLoader {
  private specDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.specDir = path.join(rootDir, 'spec');
  }

  async load(): Promise<Spec> {
    await this.ensureSpecDir();

    const [product, entities, actions, flows, policies, ui, metrics, jobs] = await Promise.all([
      this.loadProduct(),
      this.loadEntities(),
      this.loadActions(),
      this.loadFlows(),
      this.loadPolicies(),
      this.loadUi(),
      this.loadMetrics(),
      this.loadJobs(),
    ]);

    return {
      product,
      entities,
      actions,
      flows,
      policies,
      ui,
      metrics,
      jobs,
    };
  }

  private async ensureSpecDir(): Promise<void> {
    try {
      await fs.access(this.specDir);
    } catch {
      throw new Error(`Spec directory not found: ${this.specDir}`);
    }
  }

  private async loadYaml<T>(filename: string, required = true): Promise<T | null> {
    const filepath = path.join(this.specDir, filename);
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return yaml.load(content) as T;
    } catch (error) {
      if (required) {
        throw new Error(`Failed to load ${filename}: ${(error as Error).message}`);
      }
      return null;
    }
  }

  private async loadYamlGlob<T>(pattern: string): Promise<Record<string, T>> {
    const files = await fg(pattern, { cwd: this.specDir });
    const result: Record<string, T> = {};

    for (const file of files) {
      const content = await this.loadYaml<T>(file, false);
      if (content) {
        const name = path.basename(file, path.extname(file));
        result[name] = content;
      }
    }

    return result;
  }

  private async loadProduct(): Promise<ProductSpec> {
    const product = await this.loadYaml<ProductSpec>('product.yml');
    if (!product) {
      throw new Error('product.yml is required');
    }
    return product;
  }

  private async loadEntities(): Promise<Record<string, EntitySpec>> {
    // Try single entities.yml first
    const single = await this.loadYaml<{ entities: Record<string, EntitySpec> }>('entities.yml', false);
    if (single?.entities) {
      return single.entities;
    }

    // Fall back to entities/*.yml
    const files = await fg('entities/*.yml', { cwd: this.specDir });
    const result: Record<string, EntitySpec> = {};

    for (const file of files) {
      const content = await this.loadYaml<EntitySpec | { entities: Record<string, EntitySpec> }>(file, false);
      if (content) {
        if ('entities' in content) {
          Object.assign(result, content.entities);
        } else {
          const name = path.basename(file, '.yml');
          result[name] = content;
        }
      }
    }

    return result;
  }

  private async loadActions(): Promise<Record<string, ActionSpec>> {
    const single = await this.loadYaml<{ actions: Record<string, ActionSpec> }>('actions.yml', false);
    if (single?.actions) {
      return single.actions;
    }

    const files = await fg('actions/*.yml', { cwd: this.specDir });
    const result: Record<string, ActionSpec> = {};

    for (const file of files) {
      const content = await this.loadYaml<ActionSpec | { actions: Record<string, ActionSpec> }>(file, false);
      if (content) {
        if ('actions' in content) {
          Object.assign(result, content.actions);
        } else {
          const name = path.basename(file, '.yml');
          result[name] = content;
        }
      }
    }

    return result;
  }

  private async loadFlows(): Promise<Record<string, FlowSpec>> {
    const single = await this.loadYaml<{ flows: Record<string, FlowSpec> }>('flows.yml', false);
    if (single?.flows) {
      return single.flows;
    }

    const files = await fg('flows/*.yml', { cwd: this.specDir });
    const result: Record<string, FlowSpec> = {};

    for (const file of files) {
      const content = await this.loadYaml<FlowSpec | { flows: Record<string, FlowSpec> }>(file, false);
      if (content) {
        if ('flows' in content) {
          Object.assign(result, content.flows);
        } else {
          const name = path.basename(file, '.yml');
          result[name] = content;
        }
      }
    }

    return result;
  }

  private async loadPolicies(): Promise<PoliciesSpec> {
    const policies = await this.loadYaml<PoliciesSpec>('policies.yml', false);
    return policies || { roles: {}, permissions: {}, policies: {}, rate_limits: {} };
  }

  private async loadUi(): Promise<UiSpec> {
    const ui = await this.loadYaml<UiSpec>('ui.yml', false);
    return ui || { screens: {}, layouts: {} };
  }

  private async loadMetrics(): Promise<MetricsSpec> {
    const metrics = await this.loadYaml<MetricsSpec>('metrics.yml', false);
    return metrics || { events: {}, kpis: {} };
  }

  private async loadJobs(): Promise<JobsSpec> {
    const jobs = await this.loadYaml<JobsSpec>('jobs.yml', false);
    return jobs || { jobs: {}, queues: {} };
  }
}
