# Code Boundaries

Foundation Dev enforces strict boundaries between generated and human-written code.

## The Rule

> **Humans never edit files in `__generated__/` directories.**
> **Generators never overwrite files in `extensions/` directories.**

## Generated Code Locations

All generated code lives in `__generated__/` directories:

```
services/core/src/__generated__/
├── db/
│   ├── schema.ts           # Drizzle schema
│   ├── types.ts            # TypeScript types
│   └── repositories/       # Repository classes
├── actions/
│   ├── handlers/           # Action handlers
│   └── schemas/            # Zod validation schemas
├── middleware/
│   ├── auth.middleware.ts
│   ├── policy.middleware.ts
│   ├── rate-limit.middleware.ts
│   └── audit.middleware.ts
└── routes.ts               # Express routes

services/worker/src/__generated__/
├── jobs/                   # Job handlers
├── queues.ts               # Queue configs
└── setup.ts                # Worker setup

packages/sdk/src/__generated__/
├── client.ts
├── types.ts
└── actions/                # SDK action methods

apps/web/app/(generated)/
├── layout.tsx              # Generated layout
├── navigation.ts           # Navigation config
├── hooks.ts                # Generated hooks
└── [flow-name]/           # Flow pages
    └── page.tsx
```

## Extension Points

Customize behavior in `extensions/` directories:

### API Extensions

```
services/core/src/extensions/
├── actions/               # Override action handlers
│   └── create_user.ts     # Custom create_user logic
├── middleware/            # Custom middleware
│   └── custom-auth.ts
└── hooks/                 # Action hooks
    └── validate_email.ts
```

**Override an action handler:**

```typescript
// services/core/src/extensions/actions/create_user.ts
import type { CreateUserInput, CreateUserOutput } from '../__generated__/actions/schemas/create-user.schema';
import type { ActionContext } from '../__generated__/types';

export async function createUser(
  input: CreateUserInput,
  ctx: ActionContext
): Promise<CreateUserOutput> {
  // Custom implementation
  // ...
}
```

### Worker Extensions

```
services/worker/src/extensions/
├── jobs/                  # Override job handlers
│   └── extract_document.ts
└── processors/            # Custom processors
```

### UI Extensions

```
apps/web/src/extensions/
├── components/            # Custom components
│   └── CustomChart.tsx
├── hooks/                 # Custom hooks
│   └── useCustomQuery.ts
└── screens/               # Override screens
    └── documents_list.tsx
```

## How Overrides Work

1. **Action Handlers**: The router checks `extensions/actions/{name}.ts` first
2. **Job Handlers**: The worker checks `extensions/jobs/{name}.ts` first
3. **UI Screens**: The app checks `extensions/screens/{name}.tsx` first

If an extension exists, it completely replaces the generated version.

## Extension Example

**Generated handler:**
```typescript
// __generated__/actions/handlers/create-user.handler.ts
export async function createUserHandler(input, ctx) {
  const result = await ctx.repositories.userRepository.create({
    ...input,
    tenantId: ctx.tenantId,
  });
  return result;
}
```

**Custom extension:**
```typescript
// extensions/actions/create-user.ts
import { createUserHandler as generated } from '../__generated__/actions/handlers/create-user.handler';

export async function createUserHandler(input, ctx) {
  // Pre-processing
  const normalizedEmail = input.email.toLowerCase();

  // Call generated handler
  const result = await generated({ ...input, email: normalizedEmail }, ctx);

  // Post-processing
  await sendWelcomeEmail(result.email);

  return result;
}
```

## UI Component Overrides

**Method 1: Create a custom component**
```typescript
// apps/web/src/extensions/components/EnhancedTable.tsx
import { Table } from '@foundation/ui';

export function EnhancedTable({ data, ...props }) {
  // Custom table with additional features
  return <Table {...props} data={data} />;
}
```

**Method 2: Replace a generated screen**
```typescript
// apps/web/src/extensions/screens/documents_list.tsx
'use client';

import { EnhancedTable } from '../components/EnhancedTable';

export default function DocumentsListPage() {
  // Completely custom implementation
  return <EnhancedTable data={...} />;
}
```

## Best Practices

1. **Start with generated code** - Only override when needed
2. **Wrap, don't copy** - Call generated functions from extensions
3. **Document overrides** - Add comments explaining why
4. **Keep extensions minimal** - Put reusable logic in packages
5. **Test extensions** - Write tests for custom code

## Regeneration Safety

When you run `fd generate`:

- Files in `__generated__/` are overwritten
- Files in `extensions/` are never touched
- Bootstrap stubs (empty files) are created only if missing

This means you can safely regenerate after spec changes without losing custom code.
