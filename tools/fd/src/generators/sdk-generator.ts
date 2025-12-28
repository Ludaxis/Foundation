import { BaseGenerator, type GeneratorConfig } from './base-generator.js';
import type { GeneratedFile } from '../types/generator.js';
import type { ActionSpec, InputFieldSpec } from '../types/spec.js';

export class SdkGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    super(config);
  }

  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate main client
    files.push(this.generateClient());

    // Generate types
    files.push(this.generateTypes());

    // Generate action methods
    for (const [name, action] of Object.entries(this.spec.actions)) {
      files.push(this.generateActionMethod(name, action));
    }

    // Generate index
    files.push(this.generateIndex());

    return files;
  }

  private generateClient(): GeneratedFile {
    const content = `${this.generateHeader('Foundation SDK Client')}

export interface ClientConfig {
  baseUrl: string;
  tenantId?: string;
  getAuthToken?: () => Promise<string> | string;
  onError?: (error: ApiError) => void;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export class FoundationClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = \`\${this.config.baseUrl}\${path}\`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.config.tenantId) {
      headers['X-Tenant-Id'] = this.config.tenantId;
    }

    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      headers['Authorization'] = \`Bearer \${token}\`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      const error: ApiError = {
        code: 'API_ERROR',
        message: response.statusText,
        status: response.status,
      };

      try {
        const body = await response.json();
        error.code = body.code || error.code;
        error.message = body.message || error.message;
        error.details = body.details;
      } catch {
        // Ignore JSON parse errors
      }

      if (this.config.onError) {
        this.config.onError(error);
      }

      throw error;
    }

    return response.json();
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request('GET', path, undefined, options);
  }

  async post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request('POST', path, data, options);
  }

  async put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request('PUT', path, data, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request('DELETE', path, undefined, options);
  }
}
`;

    return this.createFile('packages/sdk/src/__generated__/client.ts', content);
  }

  private generateTypes(): GeneratedFile {
    const types: string[] = [];

    // Generate entity types
    for (const [name, entity] of Object.entries(this.spec.entities)) {
      const pascalName = this.helpers.toPascalCase(name);
      const fields: string[] = [];

      for (const [fieldName, field] of Object.entries(entity.fields)) {
        const tsType = this.getTsType(field.type, field);
        const optional = !field.required ? '?' : '';
        fields.push(`  ${this.helpers.toCamelCase(fieldName)}${optional}: ${tsType};`);
      }

      // Add standard fields
      if (entity.auditable !== false) {
        fields.push('  createdAt: string;');
        fields.push('  updatedAt: string;');
      }

      types.push(`export interface ${pascalName} {
${fields.join('\n')}
}`);
    }

    // Generate action input/output types
    for (const [name, action] of Object.entries(this.spec.actions)) {
      const pascalName = this.helpers.toPascalCase(name);

      if (action.input?.fields) {
        const inputFields: string[] = [];
        for (const [fieldName, field] of Object.entries(action.input.fields)) {
          const tsType = this.getTsType(field.type, field);
          const optional = !field.required ? '?' : '';
          inputFields.push(`  ${this.helpers.toCamelCase(fieldName)}${optional}: ${tsType};`);
        }
        types.push(`export interface ${pascalName}Input {
${inputFields.join('\n')}
}`);
      } else {
        types.push(`export type ${pascalName}Input = void;`);
      }

      if (action.output) {
        if (action.output.entity) {
          const entityPascal = this.helpers.toPascalCase(action.output.entity);
          if (action.output.type === 'list') {
            types.push(`export interface ${pascalName}Output {
  items: ${entityPascal}[];
  total: number;
  limit: number;
  offset: number;
}`);
          } else {
            types.push(`export type ${pascalName}Output = ${entityPascal};`);
          }
        } else if (action.output.fields) {
          const outputFields: string[] = [];
          for (const [fieldName, field] of Object.entries(action.output.fields)) {
            outputFields.push(`  ${fieldName}: ${field.type};`);
          }
          types.push(`export interface ${pascalName}Output {
${outputFields.join('\n')}
}`);
        } else {
          types.push(`export type ${pascalName}Output = void;`);
        }
      } else {
        types.push(`export type ${pascalName}Output = void;`);
      }
    }

    const content = `${this.generateHeader('SDK Types')}
${types.join('\n\n')}
`;

    return this.createFile('packages/sdk/src/__generated__/types.ts', content);
  }

  private generateActionMethod(name: string, action: ActionSpec): GeneratedFile {
    const pascalName = this.helpers.toPascalCase(name);
    const camelName = this.helpers.toCamelCase(name);
    const kebabName = this.helpers.toKebabCase(name);

    const hasInput = action.input?.fields && Object.keys(action.input.fields).length > 0;
    const inputParam = hasInput ? `input: ${pascalName}Input` : '';
    const inputArg = hasInput ? ', input' : '';

    const content = `${this.generateHeader(`SDK method for ${name}`)}
import type { FoundationClient, RequestOptions } from './client.js';
import type { ${pascalName}Input, ${pascalName}Output } from './types.js';

export function create${pascalName}Action(client: FoundationClient) {
  return async function ${camelName}(${inputParam}${hasInput ? ', ' : ''}options?: RequestOptions): Promise<${pascalName}Output> {
    return client.${action.type === 'query' ? 'get' : 'post'}<${pascalName}Output>(
      '/api/actions/${kebabName}'${inputArg},
      ${hasInput ? '' : 'options'}
    );
  };
}
`;

    return this.createFile(`packages/sdk/src/__generated__/actions/${kebabName}.ts`, content);
  }

  private generateIndex(): GeneratedFile {
    const imports: string[] = [];
    const actionCreators: string[] = [];

    for (const name of Object.keys(this.spec.actions)) {
      const pascalName = this.helpers.toPascalCase(name);
      const camelName = this.helpers.toCamelCase(name);
      const kebabName = this.helpers.toKebabCase(name);

      imports.push(`import { create${pascalName}Action } from './actions/${kebabName}.js';`);
      actionCreators.push(`  ${camelName}: create${pascalName}Action(client),`);
    }

    const content = `${this.generateHeader('SDK Index')}
export { FoundationClient, type ClientConfig, type ApiError, type RequestOptions } from './client.js';
export * from './types.js';

${imports.join('\n')}

import { FoundationClient, type ClientConfig } from './client.js';

export function createFoundationSDK(config: ClientConfig) {
  const client = new FoundationClient(config);

  return {
    client,
${actionCreators.join('\n')}
  };
}

export type FoundationSDK = ReturnType<typeof createFoundationSDK>;
`;

    return this.createFile('packages/sdk/src/__generated__/index.ts', content);
  }

  private getTsType(type: string, field?: InputFieldSpec): string {
    const map: Record<string, string> = {
      uuid: 'string',
      string: 'string',
      text: 'string',
      integer: 'number',
      bigint: 'number',
      decimal: 'string',
      float: 'number',
      boolean: 'boolean',
      date: 'string',
      datetime: 'string',
      timestamp: 'string',
      json: 'unknown',
      jsonb: 'unknown',
      file: 'File | { key: string; url: string }',
    };

    if (type === 'enum' && field?.enum_values) {
      return field.enum_values.map((v) => `'${v}'`).join(' | ');
    }

    if (type === 'array') {
      return `${field?.array_of || 'unknown'}[]`;
    }

    return map[type] || 'unknown';
  }
}
