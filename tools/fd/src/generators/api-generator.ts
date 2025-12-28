import { BaseGenerator, type GeneratorConfig } from './base-generator.js';
import type { GeneratedFile } from '../types/generator.js';
import type { ActionSpec, InputFieldSpec, InputFieldType } from '../types/spec.js';

export class ApiGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    super(config);
  }

  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate action handlers
    files.push(this.generateActionsIndex());

    for (const [name, action] of Object.entries(this.spec.actions)) {
      files.push(this.generateActionHandler(name, action));
      files.push(this.generateActionSchema(name, action));
    }

    // Generate middleware
    files.push(this.generateAuthMiddleware());
    files.push(this.generatePolicyMiddleware());
    files.push(this.generateRateLimitMiddleware());
    files.push(this.generateAuditMiddleware());

    // Generate routes
    files.push(this.generateRoutes());

    // Generate types
    files.push(this.generateApiTypes());

    return files;
  }

  private generateActionsIndex(): GeneratedFile {
    const imports: string[] = [];
    const exports: string[] = [];

    for (const name of Object.keys(this.spec.actions)) {
      const kebabName = this.helpers.toKebabCase(name);
      const camelName = this.helpers.toCamelCase(name);
      imports.push(`import { ${camelName}Handler } from './handlers/${kebabName}.handler.js';`);
      exports.push(`  '${name}': ${camelName}Handler,`);
    }

    const content = `${this.generateHeader('Actions Index')}
${imports.join('\n')}

export const actionHandlers = {
${exports.join('\n')}
} as const;

export type ActionName = keyof typeof actionHandlers;
`;

    return this.createFile('services/core/src/__generated__/actions/index.ts', content);
  }

  private generateActionHandler(name: string, action: ActionSpec): GeneratedFile {
    const camelName = this.helpers.toCamelCase(name);
    const pascalName = this.helpers.toPascalCase(name);
    const kebabName = this.helpers.toKebabCase(name);

    const inputType = action.input?.fields ? `${pascalName}Input` : 'void';
    const outputType = action.output ? `${pascalName}Output` : 'void';

    let handlerBody = '';

    if (action.entity) {
      const entityPascal = this.helpers.toPascalCase(action.entity);
      const entityCamel = this.helpers.toCamelCase(action.entity);

      if (action.type === 'query') {
        if (action.output?.type === 'list') {
          handlerBody = `
    const { ${entityCamel}Repository } = ctx.repositories;

    const items = await ${entityCamel}Repository.findMany({
      tenantId: ctx.tenantId,
      limit: input.limit || 20,
      offset: input.offset || 0,
    });

    const total = await ${entityCamel}Repository.count(ctx.tenantId);

    return {
      items,
      total,
      limit: input.limit || 20,
      offset: input.offset || 0,
    };`;
        } else {
          handlerBody = `
    const { ${entityCamel}Repository } = ctx.repositories;

    const result = await ${entityCamel}Repository.findById(input.id, ctx.tenantId);

    if (!result) {
      throw new ActionError('NOT_FOUND', '${entityPascal} not found');
    }

    return result;`;
        }
      } else if (action.type === 'command') {
        handlerBody = `
    const { ${entityCamel}Repository } = ctx.repositories;

    // TODO: Implement command logic
    const result = await ${entityCamel}Repository.create({
      ...input,
      ${this.spec.product.tenancy.mode === 'multi' ? 'tenantId: ctx.tenantId,' : ''}
    });

    return result;`;
      }
    } else {
      handlerBody = `
    // TODO: Implement action logic
    throw new ActionError('NOT_IMPLEMENTED', 'Action not implemented');`;
    }

    const content = `${this.generateHeader(`Handler for ${name}`)}
import type { ActionContext } from '../types.js';
import type { ${pascalName}Input, ${pascalName}Output } from './schemas/${kebabName}.schema.js';
import { ActionError } from '../errors.js';

export async function ${camelName}Handler(
  input: ${inputType},
  ctx: ActionContext
): Promise<${outputType}> {${handlerBody}
}
`;

    return this.createFile(`services/core/src/__generated__/actions/handlers/${kebabName}.handler.ts`, content);
  }

  private generateActionSchema(name: string, action: ActionSpec): GeneratedFile {
    const pascalName = this.helpers.toPascalCase(name);
    const kebabName = this.helpers.toKebabCase(name);

    const inputSchema = this.generateZodSchema(action.input?.fields || {}, `${pascalName}Input`);
    const outputSchema = this.generateOutputType(action, pascalName);

    const content = `${this.generateHeader(`Schema for ${name}`)}
import { z } from 'zod';

${inputSchema}

${outputSchema}
`;

    return this.createFile(`services/core/src/__generated__/actions/schemas/${kebabName}.schema.ts`, content);
  }

  private generateZodSchema(fields: Record<string, InputFieldSpec>, name: string): string {
    const fieldDefs: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      fieldDefs.push(`  ${this.helpers.toCamelCase(fieldName)}: ${this.getZodType(field)},`);
    }

    return `export const ${this.helpers.toCamelCase(name)}Schema = z.object({
${fieldDefs.join('\n')}
});

export type ${name} = z.infer<typeof ${this.helpers.toCamelCase(name)}Schema>;`;
  }

  private getZodType(field: InputFieldSpec): string {
    let base = '';

    switch (field.type) {
      case 'string':
      case 'text':
        base = 'z.string()';
        if (field.validation?.min_length) base += `.min(${field.validation.min_length})`;
        if (field.validation?.max_length) base += `.max(${field.validation.max_length})`;
        if (field.validation?.pattern) base += `.regex(/${field.validation.pattern}/)`;
        if (field.validation?.format === 'email') base = 'z.string().email()';
        if (field.validation?.format === 'url') base = 'z.string().url()';
        break;
      case 'integer':
        base = 'z.number().int()';
        if (field.validation?.min !== undefined) base += `.min(${field.validation.min})`;
        if (field.validation?.max !== undefined) base += `.max(${field.validation.max})`;
        break;
      case 'float':
      case 'decimal':
        base = 'z.number()';
        if (field.validation?.min !== undefined) base += `.min(${field.validation.min})`;
        if (field.validation?.max !== undefined) base += `.max(${field.validation.max})`;
        break;
      case 'boolean':
        base = 'z.boolean()';
        break;
      case 'date':
      case 'datetime':
        base = 'z.coerce.date()';
        break;
      case 'uuid':
        base = 'z.string().uuid()';
        break;
      case 'enum':
        if (field.enum_values) {
          base = `z.enum([${field.enum_values.map(v => `'${v}'`).join(', ')}])`;
        } else {
          base = 'z.string()';
        }
        break;
      case 'array':
        const itemType = field.array_of ? this.getZodTypeForArrayItem(field.array_of) : 'z.unknown()';
        base = `z.array(${itemType})`;
        break;
      case 'object':
        if (field.object_schema) {
          const nestedFields = Object.entries(field.object_schema)
            .map(([k, v]) => `${k}: ${this.getZodType(v)}`)
            .join(', ');
          base = `z.object({ ${nestedFields} })`;
        } else {
          base = 'z.record(z.unknown())';
        }
        break;
      case 'file':
        base = 'z.instanceof(File).or(z.object({ key: z.string(), url: z.string() }))';
        break;
      default:
        base = 'z.unknown()';
    }

    if (!field.required) {
      base += '.optional()';
    }

    if (field.default !== undefined) {
      base += `.default(${JSON.stringify(field.default)})`;
    }

    return base;
  }

  private getZodTypeForArrayItem(type: string): string {
    const map: Record<string, string> = {
      string: 'z.string()',
      number: 'z.number()',
      boolean: 'z.boolean()',
      uuid: 'z.string().uuid()',
    };
    return map[type] || 'z.unknown()';
  }

  private generateOutputType(action: ActionSpec, pascalName: string): string {
    if (!action.output) {
      return `export type ${pascalName}Output = void;`;
    }

    if (action.output.entity) {
      const entityPascal = this.helpers.toPascalCase(action.output.entity);
      if (action.output.type === 'list') {
        return `import type { ${entityPascal} } from '../../db/types.js';

export type ${pascalName}Output = {
  items: ${entityPascal}[];
  total: number;
  limit: number;
  offset: number;
};`;
      }
      return `import type { ${entityPascal} } from '../../db/types.js';

export type ${pascalName}Output = ${entityPascal};`;
    }

    if (action.output.fields) {
      const fields = Object.entries(action.output.fields)
        .map(([k, v]) => `  ${k}: ${v.type};`)
        .join('\n');
      return `export type ${pascalName}Output = {
${fields}
};`;
    }

    return `export type ${pascalName}Output = void;`;
  }

  private generateAuthMiddleware(): GeneratedFile {
    const content = `${this.generateHeader('Auth Middleware')}
import type { Request, Response, NextFunction } from 'express';
import type { ActionContext } from './types.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    roles: string[];
  };
}

export function authMiddleware(required = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Demo auth: extract from header
      const authHeader = req.headers['x-auth-user'];

      if (!authHeader && required) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (authHeader) {
        // Parse demo auth header: userId:tenantId:role1,role2
        const [userId, tenantId, rolesStr] = (authHeader as string).split(':');
        req.user = {
          id: userId || 'demo-user',
          tenantId: tenantId || 'demo-tenant',
          roles: rolesStr ? rolesStr.split(',') : ['user'],
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function extractContext(req: AuthenticatedRequest): Partial<ActionContext> {
  return {
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
    roles: req.user?.roles || [],
    requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
  };
}
`;

    return this.createFile('services/core/src/__generated__/middleware/auth.middleware.ts', content);
  }

  private generatePolicyMiddleware(): GeneratedFile {
    const roleChecks: string[] = [];

    if (this.spec.policies.roles) {
      for (const [roleName, role] of Object.entries(this.spec.policies.roles)) {
        if (role.can) {
          for (const actionName of role.can) {
            roleChecks.push(`  if (actionName === '${actionName}' && !roles.includes('${roleName}') && !roles.includes('admin')) {
    return false;
  }`);
          }
        }
      }
    }

    const content = `${this.generateHeader('Policy Middleware')}
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';

export function policyMiddleware(actionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roles = req.user?.roles || [];

      if (!checkPolicy(actionName, roles)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: \`Insufficient permissions for action: \${actionName}\`
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function checkPolicy(actionName: string, roles: string[]): boolean {
  // Admin can do everything
  if (roles.includes('admin')) return true;

${roleChecks.join('\n')}

  // Default: allow if no specific policy
  return true;
}
`;

    return this.createFile('services/core/src/__generated__/middleware/policy.middleware.ts', content);
  }

  private generateRateLimitMiddleware(): GeneratedFile {
    const content = `${this.generateHeader('Rate Limit Middleware')}
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  requestsPerMinute: number;
  burst?: number;
  scope?: 'user' | 'tenant' | 'ip' | 'global';
}

export function rateLimitMiddleware(config: RateLimitConfig) {
  const { requestsPerMinute, burst = 10, scope = 'user' } = config;
  const windowMs = 60000;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let key: string;

      switch (scope) {
        case 'user':
          key = \`rate:\${req.user?.id || 'anonymous'}\`;
          break;
        case 'tenant':
          key = \`rate:\${req.user?.tenantId || 'default'}\`;
          break;
        case 'ip':
          key = \`rate:\${req.ip}\`;
          break;
        case 'global':
          key = 'rate:global';
          break;
        default:
          key = \`rate:\${req.user?.id || req.ip}\`;
      }

      const now = Date.now();
      const entry = rateLimitStore.get(key);

      if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      if (entry.count >= requestsPerMinute + burst) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter
        });
      }

      entry.count++;
      next();
    } catch (error) {
      next(error);
    }
  };
}
`;

    return this.createFile('services/core/src/__generated__/middleware/rate-limit.middleware.ts', content);
  }

  private generateAuditMiddleware(): GeneratedFile {
    const content = `${this.generateHeader('Audit Middleware')}
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { auditLog } from '@foundation/psl-runtime';

export function auditMiddleware(actionName: string, options: {
  includeInput?: boolean;
  includeOutput?: boolean;
  sensitiveFields?: string[];
} = {}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture original json method
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const duration = Date.now() - startTime;

      // Log audit event
      auditLog({
        action: actionName,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string,
        duration,
        status: res.statusCode < 400 ? 'success' : 'failure',
        input: options.includeInput ? sanitizeInput(req.body, options.sensitiveFields) : undefined,
        output: options.includeOutput ? body : undefined,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return originalJson(body);
    };

    next();
  };
}

function sanitizeInput(input: unknown, sensitiveFields?: string[]): unknown {
  if (!input || typeof input !== 'object') return input;
  if (!sensitiveFields || sensitiveFields.length === 0) return input;

  const sanitized = { ...input as Record<string, unknown> };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
`;

    return this.createFile('services/core/src/__generated__/middleware/audit.middleware.ts', content);
  }

  private generateRoutes(): GeneratedFile {
    const routeDefs: string[] = [];

    for (const [name, action] of Object.entries(this.spec.actions)) {
      const kebabName = this.helpers.toKebabCase(name);
      const method = action.type === 'query' ? 'get' : 'post';

      const middlewares: string[] = [];

      // Auth
      if (action.auth?.required !== false) {
        middlewares.push('authMiddleware()');
      }

      // Policy
      middlewares.push(`policyMiddleware('${name}')`);

      // Rate limit
      if (action.rate_limit) {
        middlewares.push(`rateLimitMiddleware({
      requestsPerMinute: ${action.rate_limit.requests_per_minute || 60},
      burst: ${action.rate_limit.burst || 10},
      scope: '${action.rate_limit.scope || 'user'}',
    })`);
      }

      // Audit
      if (action.audit?.enabled !== false) {
        const auditOpts = [];
        if (action.audit?.include_input) auditOpts.push('includeInput: true');
        if (action.audit?.include_output) auditOpts.push('includeOutput: true');
        if (action.audit?.sensitive_fields) {
          auditOpts.push(`sensitiveFields: [${action.audit.sensitive_fields.map(f => `'${f}'`).join(', ')}]`);
        }
        middlewares.push(`auditMiddleware('${name}'${auditOpts.length > 0 ? `, { ${auditOpts.join(', ')} }` : ''})`);
      }

      routeDefs.push(`
  // ${name}
  router.${method}(
    '/actions/${kebabName}',
    ${middlewares.join(',\n    ')},
    createActionHandler('${name}')
  );`);
    }

    const content = `${this.generateHeader('API Routes')}
import { Router } from 'express';
import { authMiddleware } from './middleware/auth.middleware.js';
import { policyMiddleware } from './middleware/policy.middleware.js';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware.js';
import { auditMiddleware } from './middleware/audit.middleware.js';
import { actionHandlers } from './actions/index.js';
import { createActionHandler } from './action-runner.js';

export function createRouter(): Router {
  const router = Router();
${routeDefs.join('\n')}

  return router;
}
`;

    return this.createFile('services/core/src/__generated__/routes.ts', content);
  }

  private generateApiTypes(): GeneratedFile {
    const content = `${this.generateHeader('API Types')}
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface ActionContext {
  userId?: string;
  tenantId?: string;
  roles: string[];
  requestId: string;
  repositories: Repositories;
  db: PostgresJsDatabase;
}

export interface Repositories {
  [key: string]: unknown;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
`;

    return this.createFile('services/core/src/__generated__/types.ts', content);
  }
}
