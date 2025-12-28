import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Spec, ProfileConfig } from '../types/spec.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  schemaPath?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export class SpecValidator {
  private ajv: Ajv;
  private schemasLoaded = false;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(this.ajv);
  }

  async validate(spec: Spec, options: { strict?: boolean; profile?: 'dev' | 'prod' } = {}): Promise<ValidationResult> {
    await this.loadSchemas();

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate product
    this.validateSchema('product', spec.product, errors);

    // Validate entities
    for (const [name, entity] of Object.entries(spec.entities)) {
      this.validateSchema('entity', { entities: { [name]: entity } }, errors, `entities.${name}`);
    }

    // Validate actions
    for (const [name, action] of Object.entries(spec.actions)) {
      this.validateSchema('action', { actions: { [name]: action } }, errors, `actions.${name}`);
    }

    // Validate flows
    for (const [name, flow] of Object.entries(spec.flows)) {
      this.validateSchema('flow', { flows: { [name]: flow } }, errors, `flows.${name}`);
    }

    // Validate policies
    if (spec.policies) {
      this.validateSchema('policies', spec.policies, errors, 'policies');
    }

    // Validate UI
    if (spec.ui) {
      this.validateSchema('ui', spec.ui, errors, 'ui');
    }

    // Validate metrics
    if (spec.metrics) {
      this.validateSchema('metrics', spec.metrics, errors, 'metrics');
    }

    // Validate jobs
    if (spec.jobs) {
      this.validateSchema('jobs', spec.jobs, errors, 'jobs');
    }

    // Profile-specific validation
    const profile = options.profile || spec.product.profile;
    const profileConfig = spec.product.profiles?.[profile];

    if (profile === 'prod' || profileConfig) {
      this.validateProductionRules(spec, profileConfig || {}, errors, warnings);
    }

    // Strict mode additional checks
    if (options.strict) {
      this.validateStrictRules(spec, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async loadSchemas(): Promise<void> {
    if (this.schemasLoaded) return;

    const schemaDir = path.resolve(__dirname, '../../../../spec-schema/schemas');
    const schemaFiles = [
      'product.schema.json',
      'entities.schema.json',
      'actions.schema.json',
      'flows.schema.json',
      'policies.schema.json',
      'ui.schema.json',
      'metrics.schema.json',
      'jobs.schema.json',
    ];

    for (const file of schemaFiles) {
      try {
        const content = await fs.readFile(path.join(schemaDir, file), 'utf-8');
        const schema = JSON.parse(content);
        const name = file.replace('.schema.json', '');
        this.ajv.addSchema(schema, name);
      } catch {
        // Schema file not found, skip
      }
    }

    this.schemasLoaded = true;
  }

  private validateSchema(
    schemaName: string,
    data: unknown,
    errors: ValidationError[],
    prefix = ''
  ): void {
    const validate = this.ajv.getSchema(schemaName);
    if (!validate) return;

    const valid = validate(data);
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push({
          path: prefix ? `${prefix}${error.instancePath}` : error.instancePath.slice(1),
          message: error.message || 'Validation failed',
          schemaPath: error.schemaPath,
        });
      }
    }
  }

  private validateProductionRules(
    spec: Spec,
    profileConfig: ProfileConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check idempotency for commands
    if (profileConfig.require_idempotency !== false) {
      for (const [name, action] of Object.entries(spec.actions)) {
        if (action.type === 'command' && !action.idempotent) {
          errors.push({
            path: `actions.${name}`,
            message: 'Commands must be idempotent in production profile',
          });
        }
      }
    }

    // Check rate limits
    if (profileConfig.require_rate_limits !== false) {
      for (const [name, action] of Object.entries(spec.actions)) {
        if (!action.rate_limit && action.type === 'command') {
          warnings.push({
            path: `actions.${name}`,
            message: 'Command should have rate limit defined for production',
            suggestion: 'Add rate_limit configuration',
          });
        }
      }
    }

    // Check tenant scoping
    if (profileConfig.strict_tenancy !== false && spec.product.tenancy.mode === 'multi') {
      for (const [name, entity] of Object.entries(spec.entities)) {
        if (entity.tenant_scoped === false) {
          warnings.push({
            path: `entities.${name}`,
            message: 'Entity is not tenant-scoped in multi-tenant mode',
            suggestion: 'Set tenant_scoped: true or explicitly document why this is global',
          });
        }
      }
    }

    // Check AI rules for financial entities
    for (const [name, entity] of Object.entries(spec.entities)) {
      const isFinancial = name.toLowerCase().includes('journal') ||
                          name.toLowerCase().includes('ledger') ||
                          name.toLowerCase().includes('entry') ||
                          name.toLowerCase().includes('posting');

      if (isFinancial && !entity.ai_suggest_only) {
        warnings.push({
          path: `entities.${name}`,
          message: 'Financial entity should be ai_suggest_only for safety',
          suggestion: 'Set ai_suggest_only: true',
        });
      }
    }
  }

  private validateStrictRules(
    spec: Spec,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // All entities should have descriptions
    for (const [name, entity] of Object.entries(spec.entities)) {
      if (!entity.description) {
        warnings.push({
          path: `entities.${name}`,
          message: 'Entity should have a description',
        });
      }
    }

    // All actions should have descriptions
    for (const [name, action] of Object.entries(spec.actions)) {
      if (!action.description) {
        warnings.push({
          path: `actions.${name}`,
          message: 'Action should have a description',
        });
      }
    }

    // Check for orphaned screens
    const referencedScreens = new Set<string>();
    for (const flow of Object.values(spec.flows)) {
      for (const step of Object.values(flow.steps)) {
        referencedScreens.add(step.screen);
      }
    }

    for (const screenName of Object.keys(spec.ui.screens || {})) {
      if (!referencedScreens.has(screenName)) {
        warnings.push({
          path: `ui.screens.${screenName}`,
          message: 'Screen is not referenced by any flow',
        });
      }
    }
  }
}
