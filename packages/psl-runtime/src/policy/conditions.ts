export interface ConditionContext {
  user: {
    id?: string;
    tenant_id?: string;
    roles: string[];
    [key: string]: unknown;
  };
  resource: Record<string, unknown>;
  request: Record<string, unknown>;
}

/**
 * Evaluates a simple condition expression.
 *
 * Supported syntax:
 * - Property access: user.id, resource.tenant_id, request.amount
 * - Comparisons: =, !=, <, >, <=, >=
 * - Logical: AND, OR, NOT
 * - Contains: IN
 * - Null checks: IS NULL, IS NOT NULL
 *
 * Examples:
 * - "user.tenant_id = resource.tenant_id"
 * - "user.id = resource.created_by"
 * - "resource.status IN ('draft', 'pending')"
 * - "'admin' IN user.roles"
 * - "resource.amount < 10000"
 */
export function evaluateCondition(
  expression: string,
  ctx: ConditionContext
): boolean {
  try {
    // Simple expression parser
    const expr = expression.trim();

    // Handle logical operators
    if (expr.includes(' AND ')) {
      const parts = expr.split(' AND ');
      return parts.every((part) => evaluateCondition(part.trim(), ctx));
    }

    if (expr.includes(' OR ')) {
      const parts = expr.split(' OR ');
      return parts.some((part) => evaluateCondition(part.trim(), ctx));
    }

    if (expr.startsWith('NOT ')) {
      return !evaluateCondition(expr.slice(4).trim(), ctx);
    }

    // Handle IS NULL / IS NOT NULL
    if (expr.includes(' IS NOT NULL')) {
      const field = expr.replace(' IS NOT NULL', '').trim();
      const value = resolveValue(field, ctx);
      return value !== null && value !== undefined;
    }

    if (expr.includes(' IS NULL')) {
      const field = expr.replace(' IS NULL', '').trim();
      const value = resolveValue(field, ctx);
      return value === null || value === undefined;
    }

    // Handle IN operator
    if (expr.includes(' IN ')) {
      const [left, right] = expr.split(' IN ').map((s) => s.trim());
      const leftValue = resolveValue(left, ctx);
      const rightValue = resolveValue(right, ctx);

      if (Array.isArray(rightValue)) {
        return rightValue.includes(leftValue);
      }

      // Parse array literal: ('a', 'b', 'c')
      if (typeof rightValue === 'string' && rightValue.startsWith('(')) {
        const items = rightValue
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
        return items.includes(String(leftValue));
      }

      return false;
    }

    // Handle comparisons
    const operators = ['!=', '<=', '>=', '=', '<', '>'];
    for (const op of operators) {
      if (expr.includes(` ${op} `)) {
        const [left, right] = expr.split(` ${op} `).map((s) => s.trim());
        const leftValue = resolveValue(left, ctx);
        const rightValue = resolveValue(right, ctx);
        return compareValues(leftValue, rightValue, op);
      }
    }

    // Fallback: treat as boolean field
    const value = resolveValue(expr, ctx);
    return Boolean(value);
  } catch {
    // If evaluation fails, deny by default
    return false;
  }
}

function resolveValue(expr: string, ctx: ConditionContext): unknown {
  const trimmed = expr.trim();

  // String literal
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Boolean literals
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  // Array literal
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed;
  }

  // Property path
  const parts = trimmed.split('.');
  let value: unknown = ctx;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

function compareValues(left: unknown, right: unknown, op: string): boolean {
  switch (op) {
    case '=':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return Number(left) < Number(right);
    case '>':
      return Number(left) > Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '>=':
      return Number(left) >= Number(right);
    default:
      return false;
  }
}
