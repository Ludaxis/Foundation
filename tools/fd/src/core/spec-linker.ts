import type { Spec, SpecBundle } from '../types/spec.js';
import crypto from 'crypto';

export interface LinkResult {
  valid: boolean;
  errors: LinkError[];
  warnings: LinkWarning[];
  bundle: SpecBundle | null;
}

export interface LinkError {
  type: 'missing_reference' | 'circular_reference' | 'invalid_relation' | 'invariant_violation';
  message: string;
  source: string;
  target?: string;
}

export interface LinkWarning {
  type: 'unused' | 'shadowed' | 'deprecated';
  message: string;
  path: string;
}

export class SpecLinker {
  link(spec: Spec): LinkResult {
    const errors: LinkError[] = [];
    const warnings: LinkWarning[] = [];

    // Cross-reference validation
    this.validateEntityReferences(spec, errors);
    this.validateActionReferences(spec, errors);
    this.validateFlowReferences(spec, errors);
    this.validatePolicyReferences(spec, errors);
    this.validateUiReferences(spec, errors);
    this.validateJobReferences(spec, errors);

    // Check for unused definitions
    this.checkUnused(spec, warnings);

    // Check invariants
    this.checkInvariants(spec, errors);

    if (errors.length > 0) {
      return { valid: false, errors, warnings, bundle: null };
    }

    // Create bundle with metadata
    const bundle: SpecBundle = {
      ...spec,
      _meta: {
        version: spec.product.version,
        generated_at: new Date().toISOString(),
        hash: this.computeHash(spec),
      },
    };

    return { valid: true, errors, warnings, bundle };
  }

  private validateEntityReferences(spec: Spec, errors: LinkError[]): void {
    for (const [entityName, entity] of Object.entries(spec.entities)) {
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.reference) {
          const targetEntity = spec.entities[field.reference.entity];
          if (!targetEntity) {
            errors.push({
              type: 'missing_reference',
              message: `Entity "${field.reference.entity}" referenced by field "${fieldName}" does not exist`,
              source: `entities.${entityName}.fields.${fieldName}`,
              target: `entities.${field.reference.entity}`,
            });
          } else {
            const targetField = field.reference.field || 'id';
            if (!targetEntity.fields[targetField]) {
              errors.push({
                type: 'missing_reference',
                message: `Field "${targetField}" in entity "${field.reference.entity}" does not exist`,
                source: `entities.${entityName}.fields.${fieldName}`,
                target: `entities.${field.reference.entity}.fields.${targetField}`,
              });
            }
          }
        }
      }

      // Check relations
      if (entity.relations) {
        for (const [relName, relation] of Object.entries(entity.relations)) {
          if (!spec.entities[relation.target]) {
            errors.push({
              type: 'missing_reference',
              message: `Relation target "${relation.target}" does not exist`,
              source: `entities.${entityName}.relations.${relName}`,
              target: `entities.${relation.target}`,
            });
          }

          if (relation.through && !spec.entities[relation.through]) {
            errors.push({
              type: 'missing_reference',
              message: `Through table "${relation.through}" does not exist`,
              source: `entities.${entityName}.relations.${relName}`,
              target: `entities.${relation.through}`,
            });
          }
        }
      }
    }
  }

  private validateActionReferences(spec: Spec, errors: LinkError[]): void {
    for (const [actionName, action] of Object.entries(spec.actions)) {
      // Check entity reference
      if (action.entity && !spec.entities[action.entity]) {
        errors.push({
          type: 'missing_reference',
          message: `Entity "${action.entity}" referenced by action does not exist`,
          source: `actions.${actionName}`,
          target: `entities.${action.entity}`,
        });
      }

      // Check job trigger reference
      if (action.triggers_job && !spec.jobs.jobs?.[action.triggers_job]) {
        errors.push({
          type: 'missing_reference',
          message: `Job "${action.triggers_job}" triggered by action does not exist`,
          source: `actions.${actionName}`,
          target: `jobs.${action.triggers_job}`,
        });
      }

      // Check role references
      if (action.auth?.roles) {
        for (const role of action.auth.roles) {
          if (!spec.policies.roles?.[role]) {
            errors.push({
              type: 'missing_reference',
              message: `Role "${role}" required by action does not exist`,
              source: `actions.${actionName}`,
              target: `policies.roles.${role}`,
            });
          }
        }
      }
    }
  }

  private validateFlowReferences(spec: Spec, errors: LinkError[]): void {
    for (const [flowName, flow] of Object.entries(spec.flows)) {
      for (const [stepName, step] of Object.entries(flow.steps)) {
        // Check screen reference
        if (!spec.ui.screens?.[step.screen]) {
          errors.push({
            type: 'missing_reference',
            message: `Screen "${step.screen}" referenced by flow step does not exist`,
            source: `flows.${flowName}.steps.${stepName}`,
            target: `ui.screens.${step.screen}`,
          });
        }

        // Check transition targets
        if (step.transitions) {
          for (const [transName, transition] of Object.entries(step.transitions)) {
            if (!flow.steps[transition.target]) {
              errors.push({
                type: 'missing_reference',
                message: `Step "${transition.target}" referenced by transition does not exist`,
                source: `flows.${flowName}.steps.${stepName}.transitions.${transName}`,
                target: `flows.${flowName}.steps.${transition.target}`,
              });
            }

            if (transition.action && !spec.actions[transition.action]) {
              errors.push({
                type: 'missing_reference',
                message: `Action "${transition.action}" referenced by transition does not exist`,
                source: `flows.${flowName}.steps.${stepName}.transitions.${transName}`,
                target: `actions.${transition.action}`,
              });
            }
          }
        }

        // Check on_enter action
        if (step.on_enter?.action && !spec.actions[step.on_enter.action]) {
          errors.push({
            type: 'missing_reference',
            message: `Action "${step.on_enter.action}" referenced by on_enter does not exist`,
            source: `flows.${flowName}.steps.${stepName}.on_enter`,
            target: `actions.${step.on_enter.action}`,
          });
        }
      }

      // Check initial step
      if (flow.initial_step && !flow.steps[flow.initial_step]) {
        errors.push({
          type: 'missing_reference',
          message: `Initial step "${flow.initial_step}" does not exist`,
          source: `flows.${flowName}`,
          target: `flows.${flowName}.steps.${flow.initial_step}`,
        });
      }
    }
  }

  private validatePolicyReferences(spec: Spec, errors: LinkError[]): void {
    if (!spec.policies) return;

    // Check role inheritance
    if (spec.policies.roles) {
      for (const [roleName, role] of Object.entries(spec.policies.roles)) {
        if (role.inherits) {
          for (const parent of role.inherits) {
            if (!spec.policies.roles[parent]) {
              errors.push({
                type: 'missing_reference',
                message: `Parent role "${parent}" does not exist`,
                source: `policies.roles.${roleName}`,
                target: `policies.roles.${parent}`,
              });
            }
          }
        }

        // Check action references in can
        if (role.can) {
          for (const actionName of role.can) {
            if (!spec.actions[actionName]) {
              errors.push({
                type: 'missing_reference',
                message: `Action "${actionName}" referenced in role.can does not exist`,
                source: `policies.roles.${roleName}`,
                target: `actions.${actionName}`,
              });
            }
          }
        }
      }
    }

    // Check policy resource references
    if (spec.policies.policies) {
      for (const [policyName, policy] of Object.entries(spec.policies.policies)) {
        if (!spec.entities[policy.resource]) {
          errors.push({
            type: 'missing_reference',
            message: `Entity "${policy.resource}" referenced by policy does not exist`,
            source: `policies.policies.${policyName}`,
            target: `entities.${policy.resource}`,
          });
        }
      }
    }

    // Check AI rules entity references
    if (spec.policies.ai_rules?.entities) {
      for (const entityName of Object.keys(spec.policies.ai_rules.entities)) {
        if (!spec.entities[entityName]) {
          errors.push({
            type: 'missing_reference',
            message: `Entity "${entityName}" in AI rules does not exist`,
            source: `policies.ai_rules.entities.${entityName}`,
            target: `entities.${entityName}`,
          });
        }
      }
    }

    // Check AI rules action references
    if (spec.policies.ai_rules?.actions) {
      for (const actionName of Object.keys(spec.policies.ai_rules.actions)) {
        if (!spec.actions[actionName]) {
          errors.push({
            type: 'missing_reference',
            message: `Action "${actionName}" in AI rules does not exist`,
            source: `policies.ai_rules.actions.${actionName}`,
            target: `actions.${actionName}`,
          });
        }
      }
    }
  }

  private validateUiReferences(spec: Spec, errors: LinkError[]): void {
    if (!spec.ui.screens) return;

    for (const [screenName, screen] of Object.entries(spec.ui.screens)) {
      // Check entity reference
      if (screen.entity && !spec.entities[screen.entity]) {
        errors.push({
          type: 'missing_reference',
          message: `Entity "${screen.entity}" referenced by screen does not exist`,
          source: `ui.screens.${screenName}`,
          target: `entities.${screen.entity}`,
        });
      }

      // Check load_action reference
      if (screen.load_action && !spec.actions[screen.load_action]) {
        errors.push({
          type: 'missing_reference',
          message: `Action "${screen.load_action}" referenced by screen does not exist`,
          source: `ui.screens.${screenName}`,
          target: `actions.${screen.load_action}`,
        });
      }

      // Check submit_action reference
      if (screen.submit_action && !spec.actions[screen.submit_action]) {
        errors.push({
          type: 'missing_reference',
          message: `Action "${screen.submit_action}" referenced by screen does not exist`,
          source: `ui.screens.${screenName}`,
          target: `actions.${screen.submit_action}`,
        });
      }
    }
  }

  private validateJobReferences(spec: Spec, errors: LinkError[]): void {
    if (!spec.jobs.jobs) return;

    for (const [jobName, job] of Object.entries(spec.jobs.jobs)) {
      // Check queue reference
      if (job.queue && job.queue !== 'default' && !spec.jobs.queues?.[job.queue]) {
        errors.push({
          type: 'missing_reference',
          message: `Queue "${job.queue}" referenced by job does not exist`,
          source: `jobs.${jobName}`,
          target: `jobs.queues.${job.queue}`,
        });
      }

      // Check dead letter queue reference
      if (job.dead_letter_queue && !spec.jobs.queues?.[job.dead_letter_queue]) {
        errors.push({
          type: 'missing_reference',
          message: `Dead letter queue "${job.dead_letter_queue}" does not exist`,
          source: `jobs.${jobName}`,
          target: `jobs.queues.${job.dead_letter_queue}`,
        });
      }

      // Check trigger action references
      if (job.triggers) {
        for (const trigger of job.triggers) {
          if (!spec.actions[trigger]) {
            errors.push({
              type: 'missing_reference',
              message: `Trigger action "${trigger}" does not exist`,
              source: `jobs.${jobName}`,
              target: `actions.${trigger}`,
            });
          }
        }
      }
    }
  }

  private checkUnused(spec: Spec, warnings: LinkWarning[]): void {
    // Check for unused entities
    const usedEntities = new Set<string>();
    for (const action of Object.values(spec.actions)) {
      if (action.entity) usedEntities.add(action.entity);
    }
    for (const screen of Object.values(spec.ui.screens || {})) {
      if (screen.entity) usedEntities.add(screen.entity);
    }
    // Add referenced entities
    for (const entity of Object.values(spec.entities)) {
      for (const field of Object.values(entity.fields)) {
        if (field.reference) usedEntities.add(field.reference.entity);
      }
      for (const relation of Object.values(entity.relations || {})) {
        usedEntities.add(relation.target);
        if (relation.through) usedEntities.add(relation.through);
      }
    }

    for (const entityName of Object.keys(spec.entities)) {
      if (!usedEntities.has(entityName)) {
        warnings.push({
          type: 'unused',
          message: `Entity "${entityName}" is not referenced by any action, screen, or relation`,
          path: `entities.${entityName}`,
        });
      }
    }
  }

  private checkInvariants(spec: Spec, errors: LinkError[]): void {
    // Check for journal entry balance invariant (LedgerFlow preset)
    const journalEntry = spec.entities['JournalEntry'] || spec.entities['journal_entry'];
    const journalLine = spec.entities['JournalLine'] || spec.entities['journal_line'];

    if (journalEntry && journalLine) {
      // Check that debit/credit fields exist
      const hasDebit = 'debit' in journalLine.fields || 'debit_amount' in journalLine.fields;
      const hasCredit = 'credit' in journalLine.fields || 'credit_amount' in journalLine.fields;

      if (!hasDebit || !hasCredit) {
        errors.push({
          type: 'invariant_violation',
          message: 'JournalLine must have both debit and credit fields for balance invariant',
          source: 'entities.JournalLine',
        });
      }

      // Check immutability for posted entries
      if (!journalEntry.immutable && spec.product.profile === 'prod') {
        errors.push({
          type: 'invariant_violation',
          message: 'JournalEntry should be immutable in production for audit compliance',
          source: 'entities.JournalEntry',
        });
      }
    }

    // Check multi-tenancy invariants
    if (spec.product.tenancy.mode === 'multi') {
      for (const [name, entity] of Object.entries(spec.entities)) {
        if (entity.tenant_scoped !== false) {
          const hasTenantId = 'tenant_id' in entity.fields ||
                              spec.product.tenancy.tenant_id_column &&
                              spec.product.tenancy.tenant_id_column in entity.fields;
          if (!hasTenantId) {
            // This will be auto-added, just verify parent isn't breaking isolation
          }
        }
      }
    }
  }

  private computeHash(spec: Spec): string {
    const content = JSON.stringify(spec, null, 0);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}
