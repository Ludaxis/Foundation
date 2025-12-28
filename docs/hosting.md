# Hosting Guide

This guide covers deploying Foundation Dev applications to production.

## Recommended Stack

| Component | Provider | Notes |
|-----------|----------|-------|
| Web Frontend | Vercel | Automatic Next.js optimization |
| API | Fly.io, Render | Container-based |
| Worker | Fly.io, Render | Same as API |
| Database | Neon, Supabase | Serverless Postgres |
| Storage | AWS S3, Cloudflare R2 | Object storage |
| Redis | Upstash | Serverless Redis |

## Environment Configuration

### Production Variables

```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/foundation?sslmode=require

# Redis
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# Storage
S3_BUCKET=foundation-uploads
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# API
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://your-app.vercel.app

# Auth (choose one)
CLERK_SECRET_KEY=xxx
# or
AUTH0_DOMAIN=xxx
AUTH0_CLIENT_ID=xxx
```

### Profile Configuration

In `spec/product.yml`:

```yaml
profile: prod

profiles:
  prod:
    require_idempotency: true
    require_rate_limits: true
    strict_tenancy: true
    audit_level: all
```

## Vercel (Web Frontend)

### Setup

1. Connect your repository to Vercel
2. Set the root directory to `apps/web`
3. Add environment variables

### vercel.json

```json
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "outputDirectory": ".next"
}
```

### Environment Variables

- `NEXT_PUBLIC_API_URL` = https://your-api.fly.dev

## Fly.io (API & Worker)

### fly.toml (API)

```toml
app = "foundation-api"
primary_region = "iad"

[build]
  dockerfile = "infra/docker/Dockerfile.api"

[env]
  NODE_ENV = "production"
  PORT = "4000"

[http_service]
  internal_port = 4000
  force_https = true

[[services.ports]]
  port = 443
  handlers = ["tls", "http"]

[[services.ports]]
  port = 80
  handlers = ["http"]
```

### fly.toml (Worker)

```toml
app = "foundation-worker"
primary_region = "iad"

[build]
  dockerfile = "infra/docker/Dockerfile.worker"

[env]
  NODE_ENV = "production"

# No HTTP service needed
```

### Deploy Commands

```bash
# Deploy API
fly deploy -c fly.api.toml

# Deploy Worker
fly deploy -c fly.worker.toml

# Set secrets
fly secrets set DATABASE_URL=xxx REDIS_HOST=xxx
```

## Neon (Database)

### Setup

1. Create a project at neon.tech
2. Get the connection string
3. Set `DATABASE_URL` in your deployment

### Connection String

```
postgres://user:password@ep-xxx.us-east-1.aws.neon.tech/foundation?sslmode=require
```

### Migrations

```bash
# Run from local with production DATABASE_URL
DATABASE_URL=xxx pnpm --filter @foundation/core db:migrate
```

## Upstash (Redis)

### Setup

1. Create a Redis database at upstash.com
2. Get the connection details
3. Set environment variables

### Configuration

```bash
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx
```

## Cloudflare R2 (Storage)

### Setup

1. Create an R2 bucket
2. Generate API credentials
3. Configure endpoint

### Configuration

```bash
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_BUCKET=foundation-uploads
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

## Security Checklist

Before going to production:

- [ ] Enable `profile: prod` in product.yml
- [ ] All commands have idempotency keys
- [ ] Rate limits defined for all actions
- [ ] Strict tenancy enabled for multi-tenant
- [ ] Audit logging enabled
- [ ] AI safety rules configured
- [ ] HTTPS only
- [ ] CORS configured
- [ ] Environment secrets stored securely
- [ ] Database SSL enabled
- [ ] Backup strategy in place

## Scaling Considerations

### API Scaling

- Stateless by design
- Scale horizontally
- Use connection pooling for Postgres

### Worker Scaling

- Scale based on job queue length
- Configure queue priorities
- Set appropriate concurrency

### Database Scaling

- Use connection pooling (pgBouncer)
- Consider read replicas
- Index optimization

## Monitoring

### Recommended Tools

- **Logging**: Axiom, Logtail
- **Metrics**: Prometheus, Grafana
- **APM**: OpenTelemetry
- **Errors**: Sentry

### OpenTelemetry Setup

```bash
# Add to environment
OTEL_EXPORTER_OTLP_ENDPOINT=https://xxx
OTEL_SERVICE_NAME=foundation-api
```

## Cost Optimization

### Estimated Monthly Costs (Low Traffic)

| Service | Provider | Cost |
|---------|----------|------|
| Web | Vercel (Hobby) | $0 |
| API | Fly.io (1 shared) | $5 |
| Worker | Fly.io (1 shared) | $5 |
| Database | Neon (Free) | $0 |
| Redis | Upstash (Free) | $0 |
| Storage | R2 (Free tier) | $0 |
| **Total** | | **~$10/mo** |

### Growth Path

1. Start with free tiers
2. Scale API/Worker as needed
3. Upgrade database when approaching limits
4. Add read replicas for heavy read workloads
5. Consider dedicated infrastructure at scale
