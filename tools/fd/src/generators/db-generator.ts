import { BaseGenerator, type GeneratorConfig } from './base-generator.js';
import type { GeneratedFile } from '../types/generator.js';
import type { EntitySpec, FieldSpec, FieldType } from '../types/spec.js';

export class DbGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    super(config);
  }

  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate schema file
    files.push(this.generateSchema());

    // Generate migrations index
    files.push(this.generateMigrationsIndex());

    // Generate repository files
    for (const [name, entity] of Object.entries(this.spec.entities)) {
      files.push(this.generateRepository(name, entity));
    }

    // Generate types
    files.push(this.generateTypes());

    return files;
  }

  private generateSchema(): GeneratedFile {
    const imports = this.generateSchemaImports();
    const tables = this.generateTables();

    const content = `${this.generateHeader('Database Schema - Drizzle ORM')}
${imports}

${tables}
`;

    return this.createFile('services/core/src/__generated__/db/schema.ts', content);
  }

  private generateSchemaImports(): string {
    const fieldTypes = new Set<string>();
    for (const entity of Object.values(this.spec.entities)) {
      for (const field of Object.values(entity.fields)) {
        fieldTypes.add(this.getDrizzleType(field.type));
      }
    }

    const drizzleImports = [
      'pgTable',
      'pgEnum',
      ...Array.from(fieldTypes),
      'index',
      'uniqueIndex',
    ].filter((v, i, a) => a.indexOf(v) === i);

    return `import { ${drizzleImports.join(', ')} } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';`;
  }

  private generateTables(): string {
    const tables: string[] = [];
    const enums: string[] = [];
    const relationDefs: string[] = [];

    // First pass: collect enums
    for (const [entityName, entity] of Object.entries(this.spec.entities)) {
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.type === 'enum' && field.enum_values) {
          const enumName = `${this.helpers.toCamelCase(entityName)}${this.helpers.toPascalCase(fieldName)}Enum`;
          enums.push(`export const ${enumName} = pgEnum('${this.helpers.toSnakeCase(entityName)}_${this.helpers.toSnakeCase(fieldName)}', [${field.enum_values.map((v) => `'${v}'`).join(', ')}]);`);
        }
      }
    }

    // Second pass: generate tables
    for (const [entityName, entity] of Object.entries(this.spec.entities)) {
      tables.push(this.generateTable(entityName, entity));

      if (entity.relations && Object.keys(entity.relations).length > 0) {
        relationDefs.push(this.generateRelations(entityName, entity));
      }
    }

    return [
      '// Enums',
      ...enums,
      '',
      '// Tables',
      ...tables,
      '',
      '// Relations',
      ...relationDefs,
    ].join('\n\n');
  }

  private generateTable(name: string, entity: EntitySpec): string {
    const tableName = entity.table || this.helpers.toSnakeCase(name);
    const varName = this.helpers.toCamelCase(name);
    const fields: string[] = [];
    const indexes: string[] = [];

    // Add tenant_id if multi-tenant and tenant_scoped
    if (
      this.spec.product.tenancy.mode === 'multi' &&
      entity.tenant_scoped !== false
    ) {
      const tenantCol = this.spec.product.tenancy.tenant_id_column || 'tenant_id';
      if (!entity.fields[tenantCol]) {
        fields.push(`  ${tenantCol}: uuid('${tenantCol}').notNull(),`);
      }
    }

    // Generate fields
    for (const [fieldName, field] of Object.entries(entity.fields)) {
      fields.push(this.generateField(name, fieldName, field));
    }

    // Add timestamps if auditable
    if (entity.auditable !== false) {
      if (!entity.fields['created_at']) {
        fields.push(`  createdAt: timestamp('created_at').defaultNow().notNull(),`);
      }
      if (!entity.fields['updated_at']) {
        fields.push(`  updatedAt: timestamp('updated_at').defaultNow().notNull(),`);
      }
    }

    // Add soft delete field
    if (entity.soft_delete !== false) {
      if (!entity.fields['deleted_at']) {
        fields.push(`  deletedAt: timestamp('deleted_at'),`);
      }
    }

    // Generate indexes
    if (entity.indexes) {
      for (const idx of entity.indexes) {
        const idxName = idx.name || `${tableName}_${idx.fields.join('_')}_idx`;
        const idxFields = idx.fields.map((f) => `table.${this.helpers.toCamelCase(f)}`).join(', ');
        if (idx.unique) {
          indexes.push(`  (table) => ({ ${this.helpers.toCamelCase(idxName)}: uniqueIndex('${idxName}').on(${idxFields}) }),`);
        } else {
          indexes.push(`  (table) => ({ ${this.helpers.toCamelCase(idxName)}: index('${idxName}').on(${idxFields}) }),`);
        }
      }
    }

    // Auto-add tenant + createdAt index for common queries
    if (this.spec.product.tenancy.mode === 'multi' && entity.tenant_scoped !== false) {
      const tenantCol = this.spec.product.tenancy.tenant_id_column || 'tenant_id';
      indexes.push(`  (table) => ({ tenantCreatedAt: index('${tableName}_tenant_created_at_idx').on(table.${this.helpers.toCamelCase(tenantCol)}, table.createdAt) }),`);
    }

    const indexesPart = indexes.length > 0 ? `,\n${indexes.join('\n')}` : '';

    return `export const ${varName} = pgTable('${tableName}', {
${fields.join('\n')}
}${indexesPart});`;
  }

  private generateField(entityName: string, fieldName: string, field: FieldSpec): string {
    const colName = this.helpers.toSnakeCase(fieldName);
    const varName = this.helpers.toCamelCase(fieldName);
    let def = '';

    switch (field.type) {
      case 'uuid':
        def = `uuid('${colName}')`;
        if (field.generated === 'uuid' || field.primary) {
          def += `.defaultRandom()`;
        }
        break;
      case 'string':
        const len = field.length || 255;
        def = `varchar('${colName}', { length: ${len} })`;
        break;
      case 'text':
        def = `text('${colName}')`;
        break;
      case 'integer':
        def = `integer('${colName}')`;
        if (field.generated === 'auto_increment') {
          def = `serial('${colName}')`;
        }
        break;
      case 'bigint':
        def = `bigint('${colName}', { mode: 'number' })`;
        break;
      case 'decimal':
        const precision = field.precision || 19;
        const scale = field.scale || 4;
        def = `decimal('${colName}', { precision: ${precision}, scale: ${scale} })`;
        break;
      case 'float':
        def = `real('${colName}')`;
        break;
      case 'boolean':
        def = `boolean('${colName}')`;
        break;
      case 'date':
        def = `date('${colName}')`;
        break;
      case 'datetime':
      case 'timestamp':
        def = `timestamp('${colName}')`;
        if (field.generated === 'now') {
          def += `.defaultNow()`;
        }
        break;
      case 'json':
      case 'jsonb':
        def = `jsonb('${colName}')`;
        break;
      case 'enum':
        if (field.enum_values) {
          const enumName = `${this.helpers.toCamelCase(entityName)}${this.helpers.toPascalCase(fieldName)}Enum`;
          def = `${enumName}('${colName}')`;
        }
        break;
      case 'array':
        def = `text('${colName}').array()`;
        break;
      default:
        def = `text('${colName}')`;
    }

    // Add primary key
    if (field.primary) {
      def += `.primaryKey()`;
    }

    // Add not null
    if (field.required && !field.nullable) {
      def += `.notNull()`;
    }

    // Add unique
    if (field.unique) {
      def += `.unique()`;
    }

    // Add default
    if (field.default !== undefined && field.generated === undefined) {
      if (typeof field.default === 'string') {
        def += `.default('${field.default}')`;
      } else if (typeof field.default === 'boolean') {
        def += `.default(${field.default})`;
      } else if (typeof field.default === 'number') {
        def += `.default(${field.default})`;
      }
    }

    // Add reference
    if (field.reference) {
      const refTable = this.helpers.toCamelCase(field.reference.entity);
      const refField = field.reference.field || 'id';
      def += `.references(() => ${refTable}.${this.helpers.toCamelCase(refField)}`;
      if (field.reference.on_delete) {
        def += `, { onDelete: '${field.reference.on_delete}' }`;
      }
      def += `)`;
    }

    return `  ${varName}: ${def},`;
  }

  private generateRelations(entityName: string, entity: EntitySpec): string {
    const varName = this.helpers.toCamelCase(entityName);
    const relDefs: string[] = [];

    for (const [relName, relation] of Object.entries(entity.relations || {})) {
      const targetVar = this.helpers.toCamelCase(relation.target);
      const fk = relation.foreign_key || `${this.helpers.toSnakeCase(entityName)}_id`;

      switch (relation.type) {
        case 'has_one':
          relDefs.push(`  ${relName}: one(${targetVar}, {
    fields: [${varName}.id],
    references: [${targetVar}.${this.helpers.toCamelCase(fk)}],
  }),`);
          break;
        case 'has_many':
          relDefs.push(`  ${relName}: many(${targetVar}),`);
          break;
        case 'belongs_to':
          relDefs.push(`  ${relName}: one(${targetVar}, {
    fields: [${varName}.${this.helpers.toCamelCase(fk)}],
    references: [${targetVar}.id],
  }),`);
          break;
        case 'many_to_many':
          if (relation.through) {
            const throughVar = this.helpers.toCamelCase(relation.through);
            relDefs.push(`  ${relName}: many(${throughVar}),`);
          }
          break;
      }
    }

    return `export const ${varName}Relations = relations(${varName}, ({ one, many }) => ({
${relDefs.join('\n')}
}));`;
  }

  private generateRepository(name: string, entity: EntitySpec): GeneratedFile {
    const pascalName = this.helpers.toPascalCase(name);
    const camelName = this.helpers.toCamelCase(name);
    const tableName = entity.table || this.helpers.toSnakeCase(name);

    const content = `${this.generateHeader(`Repository for ${pascalName}`)}
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ${camelName} } from './schema.js';
import type { ${pascalName}, New${pascalName}, ${pascalName}Update } from './types.js';

export class ${pascalName}Repository {
  constructor(private db: PostgresJsDatabase) {}

  async findById(id: string, tenantId?: string): Promise<${pascalName} | null> {
    const conditions = [eq(${camelName}.id, id)];
    ${entity.tenant_scoped !== false ? `if (tenantId) conditions.push(eq(${camelName}.tenantId, tenantId));` : ''}
    ${entity.soft_delete !== false ? `conditions.push(isNull(${camelName}.deletedAt));` : ''}

    const result = await this.db
      .select()
      .from(${camelName})
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async findMany(options: {
    tenantId?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt';
    orderDir?: 'asc' | 'desc';
  } = {}): Promise<${pascalName}[]> {
    const conditions = [];
    ${entity.tenant_scoped !== false ? `if (options.tenantId) conditions.push(eq(${camelName}.tenantId, options.tenantId));` : ''}
    ${entity.soft_delete !== false ? `conditions.push(isNull(${camelName}.deletedAt));` : ''}

    let query = this.db.select().from(${camelName});

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const orderFn = options.orderDir === 'asc' ? asc : desc;
    const orderCol = options.orderBy === 'updatedAt' ? ${camelName}.updatedAt : ${camelName}.createdAt;
    query = query.orderBy(orderFn(orderCol)) as typeof query;

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return await query;
  }

  async create(data: New${pascalName}): Promise<${pascalName}> {
    const result = await this.db
      .insert(${camelName})
      .values(data)
      .returning();

    return result[0]!;
  }

  async update(id: string, data: ${pascalName}Update, tenantId?: string): Promise<${pascalName} | null> {
    const conditions = [eq(${camelName}.id, id)];
    ${entity.tenant_scoped !== false ? `if (tenantId) conditions.push(eq(${camelName}.tenantId, tenantId));` : ''}
    ${entity.soft_delete !== false ? `conditions.push(isNull(${camelName}.deletedAt));` : ''}

    const result = await this.db
      .update(${camelName})
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    return result[0] || null;
  }

  ${entity.soft_delete !== false ? `
  async softDelete(id: string, tenantId?: string): Promise<boolean> {
    const conditions = [eq(${camelName}.id, id)];
    ${entity.tenant_scoped !== false ? `if (tenantId) conditions.push(eq(${camelName}.tenantId, tenantId));` : ''}

    const result = await this.db
      .update(${camelName})
      .set({ deletedAt: new Date() })
      .where(and(...conditions))
      .returning();

    return result.length > 0;
  }` : ''}

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const conditions = [eq(${camelName}.id, id)];
    ${entity.tenant_scoped !== false ? `if (tenantId) conditions.push(eq(${camelName}.tenantId, tenantId));` : ''}

    const result = await this.db
      .delete(${camelName})
      .where(and(...conditions))
      .returning();

    return result.length > 0;
  }

  async count(tenantId?: string): Promise<number> {
    const conditions = [];
    ${entity.tenant_scoped !== false ? `if (tenantId) conditions.push(eq(${camelName}.tenantId, tenantId));` : ''}
    ${entity.soft_delete !== false ? `conditions.push(isNull(${camelName}.deletedAt));` : ''}

    const result = await this.db
      .select({ count: sql<number>\`count(*)\` })
      .from(${camelName})
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }
}
`;

    return this.createFile(`services/core/src/__generated__/db/repositories/${this.helpers.toKebabCase(name)}.repository.ts`, content);
  }

  private generateTypes(): GeneratedFile {
    const types: string[] = [];

    for (const [name, entity] of Object.entries(this.spec.entities)) {
      const pascalName = this.helpers.toPascalCase(name);
      const fields: string[] = [];
      const newFields: string[] = [];
      const updateFields: string[] = [];

      // Add tenant_id if needed
      if (this.spec.product.tenancy.mode === 'multi' && entity.tenant_scoped !== false) {
        fields.push(`  tenantId: string;`);
        newFields.push(`  tenantId: string;`);
      }

      for (const [fieldName, field] of Object.entries(entity.fields)) {
        const tsType = this.getTsType(field);
        const optional = !field.required ? '?' : '';
        const varName = this.helpers.toCamelCase(fieldName);

        fields.push(`  ${varName}: ${tsType};`);

        if (!field.generated && !field.primary) {
          newFields.push(`  ${varName}${optional}: ${tsType};`);
          updateFields.push(`  ${varName}?: ${tsType};`);
        }
      }

      // Add timestamps
      if (entity.auditable !== false) {
        fields.push(`  createdAt: Date;`);
        fields.push(`  updatedAt: Date;`);
      }
      if (entity.soft_delete !== false) {
        fields.push(`  deletedAt: Date | null;`);
      }

      types.push(`export interface ${pascalName} {
${fields.join('\n')}
}

export interface New${pascalName} {
${newFields.join('\n')}
}

export interface ${pascalName}Update {
${updateFields.join('\n')}
}`);
    }

    const content = `${this.generateHeader('Database Types')}
${types.join('\n\n')}
`;

    return this.createFile('services/core/src/__generated__/db/types.ts', content);
  }

  private generateMigrationsIndex(): GeneratedFile {
    const content = `${this.generateHeader('Migrations Index')}
// Run migrations with: pnpm drizzle-kit push:pg
// Or generate migration: pnpm drizzle-kit generate:pg

export * from './schema.js';
`;

    return this.createFile('services/core/src/__generated__/db/index.ts', content);
  }

  private getDrizzleType(fieldType: FieldType): string {
    const map: Record<FieldType, string> = {
      uuid: 'uuid',
      string: 'varchar',
      text: 'text',
      integer: 'integer',
      bigint: 'bigint',
      decimal: 'decimal',
      float: 'real',
      boolean: 'boolean',
      date: 'date',
      datetime: 'timestamp',
      timestamp: 'timestamp',
      json: 'jsonb',
      jsonb: 'jsonb',
      enum: 'pgEnum',
      array: 'text',
    };
    return map[fieldType] || 'text';
  }

  private getTsType(field: FieldSpec): string {
    const map: Record<FieldType, string> = {
      uuid: 'string',
      string: 'string',
      text: 'string',
      integer: 'number',
      bigint: 'number',
      decimal: 'string',
      float: 'number',
      boolean: 'boolean',
      date: 'Date',
      datetime: 'Date',
      timestamp: 'Date',
      json: 'unknown',
      jsonb: 'unknown',
      enum: field.enum_values ? field.enum_values.map((v) => `'${v}'`).join(' | ') : 'string',
      array: `${field.array_of || 'string'}[]`,
    };
    return map[field.type] || 'unknown';
  }
}
