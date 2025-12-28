export interface TenantInfo {
  id: string;
  name?: string;
  plan?: string;
  settings?: Record<string, unknown>;
}

/**
 * Tenant context for request-scoped tenant isolation.
 * Use with AsyncLocalStorage for proper request isolation.
 */
export class TenantContext {
  private tenant: TenantInfo | null = null;

  setTenant(tenant: TenantInfo): void {
    this.tenant = tenant;
  }

  getTenant(): TenantInfo | null {
    return this.tenant;
  }

  getTenantId(): string | null {
    return this.tenant?.id || null;
  }

  requireTenant(): TenantInfo {
    if (!this.tenant) {
      throw new Error('Tenant context not set');
    }
    return this.tenant;
  }

  clear(): void {
    this.tenant = null;
  }

  /**
   * Creates a tenant-scoped filter for database queries.
   */
  createFilter<T extends { tenantId?: string }>(
    column = 'tenantId'
  ): Record<string, string> {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error('Cannot create filter: no tenant context');
    }
    return { [column]: tenantId };
  }

  /**
   * Validates that a resource belongs to the current tenant.
   */
  validateOwnership<T extends Record<string, unknown>>(
    resource: T,
    tenantIdField = 'tenantId'
  ): boolean {
    const tenantId = this.getTenantId();
    if (!tenantId) return false;

    const resourceTenantId = resource[tenantIdField];
    return resourceTenantId === tenantId;
  }

  /**
   * Asserts that a resource belongs to the current tenant.
   * Throws ForbiddenError if not.
   */
  assertOwnership<T extends Record<string, unknown>>(
    resource: T,
    tenantIdField = 'tenantId'
  ): void {
    if (!this.validateOwnership(resource, tenantIdField)) {
      throw new TenantMismatchError('Resource does not belong to current tenant');
    }
  }
}

export class TenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantMismatchError';
  }
}
