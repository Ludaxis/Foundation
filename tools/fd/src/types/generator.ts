import type { SpecBundle } from './spec.js';

export type GeneratorTarget = 'db' | 'api' | 'sdk' | 'ui' | 'jobs' | 'all';

export interface GeneratorContext {
  spec: SpecBundle;
  rootDir: string;
  profile: 'dev' | 'prod';
  targets: GeneratorTarget[];
  dryRun: boolean;
  force: boolean;
}

export interface GeneratorResult {
  target: GeneratorTarget;
  files: GeneratedFile[];
  errors: GeneratorError[];
  warnings: GeneratorWarning[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  overwritten: boolean;
}

export interface GeneratorError {
  message: string;
  path?: string;
  details?: string;
}

export interface GeneratorWarning {
  message: string;
  path?: string;
  suggestion?: string;
}

export interface TemplateContext {
  spec: SpecBundle;
  helpers: TemplateHelpers;
}

export interface TemplateHelpers {
  toPascalCase: (str: string) => string;
  toCamelCase: (str: string) => string;
  toSnakeCase: (str: string) => string;
  toKebabCase: (str: string) => string;
  toUpperSnakeCase: (str: string) => string;
  pluralize: (str: string) => string;
  singularize: (str: string) => string;
}
