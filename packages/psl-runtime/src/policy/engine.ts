import { evaluateCondition, type ConditionContext } from './conditions.js';

export interface PolicyContext {
  userId?: string;
  tenantId?: string;
  roles: string[];
  resource?: string;
  action?: string;
  resourceData?: Record<string, unknown>;
  requestData?: Record<string, unknown>;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  filters?: string[];
}

export interface PolicyRule {
  name: string;
  resource: string;
  action?: string;
  effect: 'allow' | 'deny';
  conditions?: Array<{
    type: 'allow_if' | 'deny_if' | 'require';
    expression: string;
    message?: string;
  }>;
  filter?: string;
  priority?: number;
}

export interface RoleDefinition {
  name: string;
  inherits?: string[];
  permissions?: string[];
  can?: string[];
}

export class PolicyEngine {
  private policies: PolicyRule[] = [];
  private roles: Map<string, RoleDefinition> = new Map();

  constructor(config?: {
    policies?: PolicyRule[];
    roles?: Record<string, RoleDefinition>;
  }) {
    if (config?.policies) {
      this.policies = config.policies.sort((a, b) =>
        (b.priority || 0) - (a.priority || 0)
      );
    }
    if (config?.roles) {
      for (const [name, role] of Object.entries(config.roles)) {
        this.roles.set(name, role);
      }
    }
  }

  evaluate(ctx: PolicyContext): PolicyResult {
    // Admin bypass
    if (ctx.roles.includes('admin') || ctx.roles.includes('super_admin')) {
      return { allowed: true, reason: 'Admin role' };
    }

    // Check RBAC first
    if (ctx.action && !this.checkRolePermissions(ctx)) {
      return {
        allowed: false,
        reason: `No role permission for action: ${ctx.action}`,
      };
    }

    // Find applicable policies
    const applicablePolicies = this.policies.filter(
      (p) =>
        (p.resource === '*' || p.resource === ctx.resource) &&
        (!p.action || p.action === '*' || p.action === ctx.action)
    );

    // Evaluate each policy
    const filters: string[] = [];
    let explicitAllow = false;
    let explicitDeny = false;
    let denyReason = '';

    for (const policy of applicablePolicies) {
      const conditionCtx: ConditionContext = {
        user: {
          id: ctx.userId,
          tenant_id: ctx.tenantId,
          roles: ctx.roles,
        },
        resource: ctx.resourceData || {},
        request: ctx.requestData || {},
      };

      // Check conditions
      let conditionsPassed = true;

      for (const condition of policy.conditions || []) {
        const result = evaluateCondition(condition.expression, conditionCtx);

        switch (condition.type) {
          case 'deny_if':
            if (result) {
              explicitDeny = true;
              denyReason = condition.message || policy.name;
              conditionsPassed = false;
            }
            break;
          case 'allow_if':
            if (!result) {
              conditionsPassed = false;
            }
            break;
          case 'require':
            if (!result) {
              explicitDeny = true;
              denyReason = condition.message || `Requirement not met: ${policy.name}`;
              conditionsPassed = false;
            }
            break;
        }

        if (explicitDeny) break;
      }

      if (explicitDeny) break;

      if (conditionsPassed) {
        if (policy.effect === 'allow') {
          explicitAllow = true;
          if (policy.filter) {
            filters.push(policy.filter);
          }
        } else if (policy.effect === 'deny') {
          explicitDeny = true;
          denyReason = policy.name;
        }
      }
    }

    if (explicitDeny) {
      return { allowed: false, reason: denyReason };
    }

    if (explicitAllow || applicablePolicies.length === 0) {
      return { allowed: true, filters };
    }

    return { allowed: false, reason: 'No matching allow policy' };
  }

  private checkRolePermissions(ctx: PolicyContext): boolean {
    const effectivePermissions = this.getEffectivePermissions(ctx.roles);
    return effectivePermissions.includes(ctx.action!) ||
           effectivePermissions.includes('*');
  }

  private getEffectivePermissions(roleNames: string[]): string[] {
    const permissions = new Set<string>();

    const processRole = (roleName: string, visited: Set<string>) => {
      if (visited.has(roleName)) return;
      visited.add(roleName);

      const role = this.roles.get(roleName);
      if (!role) return;

      // Add direct permissions
      for (const perm of role.permissions || []) {
        permissions.add(perm);
      }

      // Add can actions
      for (const action of role.can || []) {
        permissions.add(action);
      }

      // Process inherited roles
      for (const parent of role.inherits || []) {
        processRole(parent, visited);
      }
    };

    const visited = new Set<string>();
    for (const roleName of roleNames) {
      processRole(roleName, visited);
    }

    return Array.from(permissions);
  }

  addPolicy(policy: PolicyRule): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  addRole(name: string, role: RoleDefinition): void {
    this.roles.set(name, role);
  }
}
