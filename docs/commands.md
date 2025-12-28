# FD CLI Commands Reference

The `fd` command-line tool is the primary interface for Foundation Dev projects.

## Installation

The CLI is included in the monorepo workspace:

```bash
# From project root
pnpm fd <command>

# Or install globally (after building)
npm install -g @foundation/fd
```

## Commands

### `fd init`

Initialize a new Foundation Dev project.

```bash
fd init [options]

Options:
  --preset <name>    Use a preset (ledgerflow, clipflow)
  --name <name>      Project name
  --skip-install     Skip dependency installation
```

**Presets:**
- `ledgerflow` - AI-powered accounting MVP with document upload, extraction, and journal entries
- `clipflow` - Minimal starter for general applications

**Example:**
```bash
fd init --preset ledgerflow --name my-accounting-app
```

### `fd spec validate`

Validate spec files against schemas and check cross-references.

```bash
fd spec validate [options]

# Shorthand
fd validate [options]

Options:
  --strict           Enable strict validation (require descriptions, etc.)
  --profile <name>   Validate for specific profile (dev, prod)
```

**What it checks:**
- YAML syntax
- JSON Schema compliance
- Cross-file references (entities, actions, screens, etc.)
- Production requirements (idempotency, rate limits)
- Domain invariants (balanced journal entries, etc.)

**Output:**
- Creates `.fd/cache/spec.bundle.json` on success
- Reports errors and warnings

### `fd plan`

Generate an implementation plan from specs.

```bash
fd plan [options]

Options:
  --output <path>    Output path (default: docs/plan.md)
```

Creates a markdown document outlining:
- Database schema
- API actions
- User flows
- Security policies
- Background jobs

### `fd generate`

Generate code from spec files.

```bash
fd generate [options]

Options:
  --only <targets>   Generate only specific targets (db,api,sdk,ui,jobs)
  --dry-run          Show what would be generated without writing
  --force            Overwrite existing generated files
```

**Targets:**
- `db` - Database schema, migrations, repositories
- `api` - API routes, handlers, middleware
- `sdk` - TypeScript client SDK
- `ui` - React screens, forms, tables
- `jobs` - Background job handlers

**Example:**
```bash
# Generate everything
fd generate

# Generate only database
fd generate --only db

# Preview changes
fd generate --dry-run
```

### `fd run`

Start the full development stack.

```bash
fd run [options]

Options:
  --service <name>   Run only specific service (web, api, worker)
  --no-docker        Skip Docker services (db, redis)
  --migrate          Run database migrations before starting
```

**Services started:**
- Docker: PostgreSQL, Redis, MinIO (unless `--no-docker`)
- API: http://localhost:4000
- Worker: Background job processor
- Web: http://localhost:3000

### `fd test`

Run tests.

```bash
fd test [options]

Options:
  --unit             Run unit tests only
  --e2e              Run e2e tests only
  --coverage         Generate coverage report
```

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://...localhost:5432/foundation` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `S3_ENDPOINT` | S3/MinIO endpoint | `http://localhost:9000` |
| `S3_BUCKET` | Storage bucket | `foundation-uploads` |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | CORS origin | `http://localhost:3000` |

## Workflow

Typical development workflow:

```bash
# 1. Edit spec files
vim spec/entities.yml

# 2. Validate changes
fd validate

# 3. Generate code
fd generate

# 4. Start development
fd run

# 5. Run tests
fd test
```

## Troubleshooting

### Validation Errors

```bash
# See detailed errors
fd validate --strict

# Check specific profile
fd validate --profile prod
```

### Generation Issues

```bash
# Preview what will be generated
fd generate --dry-run

# Force regenerate all files
fd generate --force
```

### Docker Issues

```bash
# Check Docker status
docker compose ps

# View logs
docker compose logs postgres

# Restart services
docker compose down && docker compose up -d
```
