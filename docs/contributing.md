# Contributing to Foundation Dev

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/foundation-dev/foundation.git
cd foundation

# Install dependencies
pnpm install

# Build the CLI
pnpm build:tools

# Run tests
pnpm test
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow the code style (Prettier + ESLint)
- Add tests for new features
- Update documentation

### 3. Test

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @foundation/fd test

# Type check
pnpm tsc --noEmit
```

### 4. Commit

We use conventional commits:

```
feat: add new action type
fix: resolve validation error
docs: update PSL reference
test: add policy engine tests
refactor: simplify code generation
```

### 5. Submit PR

- Describe your changes
- Link related issues
- Ensure CI passes

## Project Structure

```
/
├── tools/fd/           # CLI tool
│   ├── src/
│   │   ├── commands/   # CLI commands
│   │   ├── core/       # Spec loading, validation, linking
│   │   └── generators/ # Code generators
│   └── templates/      # Code templates
│
├── packages/
│   ├── psl-runtime/    # Runtime utilities
│   ├── sdk/            # Client SDK
│   └── ui/             # UI components
│
├── services/
│   ├── core/           # API service
│   └── worker/         # Background jobs
│
├── apps/
│   └── web/            # Next.js frontend
│
├── spec-schema/        # JSON Schema definitions
│
└── docs/               # Documentation
```

## Code Style

### TypeScript

```typescript
// Use explicit types
function createUser(input: CreateUserInput): Promise<User> {
  // ...
}

// Use const assertions
const STATUS = ['active', 'suspended'] as const;

// Prefer interfaces for objects
interface UserData {
  email: string;
  name?: string;
}
```

### File Naming

- `kebab-case.ts` for files
- `PascalCase` for React components
- `camelCase` for functions and variables

### Imports

```typescript
// External imports first
import { z } from 'zod';

// Internal imports with relative paths
import { SpecLoader } from './core/spec-loader.js';

// Type imports
import type { Spec } from './types/spec.js';
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { PolicyEngine } from './engine';

describe('PolicyEngine', () => {
  it('allows admin to access everything', () => {
    const engine = new PolicyEngine();
    const result = engine.evaluate({
      roles: ['admin'],
      action: 'delete_user',
    });
    expect(result.allowed).toBe(true);
  });
});
```

### Test Location

- Tests live next to source files: `foo.ts` -> `foo.test.ts`
- Integration tests in `__tests__/` directories

## Documentation

### Code Comments

```typescript
/**
 * Evaluates a policy against the given context.
 *
 * @param ctx - The policy context (user, resource, action)
 * @returns Whether the action is allowed and any filters to apply
 */
export function evaluate(ctx: PolicyContext): PolicyResult {
  // ...
}
```

### Markdown Docs

- Use clear headings
- Include code examples
- Keep content up to date

## Adding a New Generator

1. Create generator in `tools/fd/src/generators/`
2. Add to generator factory in `core/generator.ts`
3. Add target to CLI options
4. Add tests
5. Update documentation

**Example:**

```typescript
// tools/fd/src/generators/my-generator.ts
import { BaseGenerator } from './base-generator.js';

export class MyGenerator extends BaseGenerator {
  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate files based on spec
    for (const [name, entity] of Object.entries(this.spec.entities)) {
      files.push(this.generateEntityFile(name, entity));
    }

    return files;
  }

  private generateEntityFile(name: string, entity: EntitySpec): GeneratedFile {
    return this.createFile(
      `path/to/__generated__/${name}.ts`,
      `// Generated code for ${name}`
    );
  }
}
```

## Adding a New Spec Type

1. Create JSON Schema in `spec-schema/schemas/`
2. Add TypeScript types in `tools/fd/src/types/spec.ts`
3. Update `SpecLoader` to load the new file
4. Update `SpecLinker` for cross-references
5. Add generator support
6. Update documentation

## Release Process

1. Update version in root `package.json`
2. Update CHANGELOG.md
3. Create release branch
4. Submit PR
5. After merge, tag release

## Questions?

- Open an issue for bugs or feature requests
- Join discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
