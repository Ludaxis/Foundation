# Foundation Dev

**Production-ready monorepo framework for PM + AI to generate real MVPs from human-readable specs.**

The spec is the product. Generated code is deterministic output. Engineers can join later without refactoring.

## Quick Start

```bash
# Clone and install
git clone <your-repo>
cd foundation
pnpm install

# Initialize with LedgerFlow preset
pnpm fd init --preset ledgerflow

# Validate your spec
pnpm fd spec validate

# Generate code
pnpm fd generate

# Start the full stack
pnpm fd run
```

Open http://localhost:3000 to see your app.

## What is Foundation Dev?

Foundation Dev is a framework that lets you:

1. **Write specs** in simple YAML describing your product
2. **Generate code** for the entire stack (DB, API, SDK, UI, jobs)
3. **Run locally** with one command
4. **Ship to production** with enterprise-grade features built-in

### The Philosophy

- **Spec is the Source of Truth**: Your `/spec/*.yml` files define the product
- **Generated Code is Output**: Code in `__generated__/` is deterministic from spec
- **Humans Never Edit Generated Files**: Customizations go in `extensions/` folders
- **Fail Fast**: Schema validation, cross-file linking, production gates
- **Security by Default**: Multi-tenancy, RBAC/ABAC, audit logs, rate limits
- **AI Safety**: AI can suggest, humans approve for high-stakes writes

## Project Structure

```
/
├── spec/                    # Product specification (YAML)
│   ├── product.yml         # Product config, tenancy, auth
│   ├── entities.yml        # Data model
│   ├── actions.yml         # Commands and queries
│   ├── flows.yml           # UI flows and transitions
│   ├── policies.yml        # RBAC/ABAC, rate limits, AI rules
│   ├── ui.yml              # Screens and layouts
│   ├── metrics.yml         # Events and KPIs
│   └── jobs.yml            # Background jobs
│
├── tools/fd/                # FD CLI tool
├── packages/
│   ├── psl-runtime/        # Runtime utilities
│   ├── sdk/                # Type-safe client SDK
│   └── ui/                 # UI component library
│
├── apps/
│   └── web/                # Next.js frontend
│
├── services/
│   ├── core/               # API service (Express + Drizzle)
│   └── worker/             # Background jobs (BullMQ)
│
├── infra/
│   ├── docker/             # Dockerfiles
│   └── deploy/             # Deployment configs
│
└── docs/                   # Documentation
```

## FD CLI Commands

```bash
fd init --preset <preset>  # Initialize project (ledgerflow, clipflow)
fd spec validate           # Validate spec files
fd plan                    # Generate implementation plan
fd generate                # Generate code from specs
fd run                     # Start full stack locally
fd test                    # Run tests
```

## Spec Language (PSL)

### product.yml

```yaml
name: my-app
version: "0.1.0"
tenancy:
  mode: multi          # single | multi
  isolation: row       # row | schema | database
profile: dev           # dev | prod
auth:
  provider: demo       # demo | clerk | auth0
```

### entities.yml

```yaml
entities:
  User:
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      email:
        type: string
        required: true
        validation:
          format: email
```

### actions.yml

```yaml
actions:
  create_user:
    type: command
    entity: User
    input:
      fields:
        email:
          type: string
          required: true
    output:
      type: entity
      entity: User
    rate_limit:
      requests_per_minute: 10
```

See [docs/psl.md](docs/psl.md) for the complete PSL reference.

## LedgerFlow Preset

The flagship preset for AI-powered accounting:

- **Document Upload**: Receipt/invoice storage with S3
- **AI Extraction**: Background job extracts data from documents
- **Suggestion Workflow**: AI suggests journal entries, humans approve
- **Double-Entry Accounting**: Balanced journal entries with invariant checking
- **Audit Trail**: Every action logged

```bash
pnpm fd init --preset ledgerflow
```

## Technology Stack

- **Frontend**: Next.js 14, Tailwind CSS, React Hook Form, TanStack Table
- **Backend**: Express, Drizzle ORM, PostgreSQL
- **Jobs**: BullMQ, Redis
- **Storage**: S3-compatible (MinIO locally)
- **Tooling**: TypeScript 5, pnpm workspaces

## Hosting Recommendations

| Component | Recommendation |
|-----------|----------------|
| Web       | Vercel         |
| API       | Fly.io, Render |
| Worker    | Fly.io, Render |
| Database  | Neon, Supabase |
| Storage   | S3, R2         |
| Redis     | Upstash        |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm test`
5. Submit a pull request

See [docs/contributing.md](docs/contributing.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.
