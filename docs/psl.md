# Product Spec Language (PSL) Reference

PSL is a YAML-based language for defining your product. Each file in `/spec` defines a different aspect of your application.

## Table of Contents

- [product.yml](#productyml)
- [entities.yml](#entitiesyml)
- [actions.yml](#actionsyml)
- [flows.yml](#flowsyml)
- [policies.yml](#policiesyml)
- [ui.yml](#uiyml)
- [metrics.yml](#metricsyml)
- [jobs.yml](#jobsyml)

---

## product.yml

Root product configuration.

```yaml
name: my-app                  # Required: project name (kebab-case)
version: "0.1.0"              # Required: semantic version
description: "My application" # Optional

tenancy:
  mode: multi                 # single | multi
  isolation: row              # row | schema | database
  tenant_id_column: tenant_id # Default column name

profile: dev                  # Current profile: dev | prod

profiles:
  dev:
    require_idempotency: false
    require_rate_limits: false
    strict_tenancy: false
    audit_level: commands
  prod:
    require_idempotency: true
    require_rate_limits: true
    strict_tenancy: true
    audit_level: all

auth:
  provider: demo              # demo | clerk | auth0 | supabase | custom
  session_duration: 24h
  require_mfa: false

defaults:
  pagination:
    page_size: 20
    max_page_size: 100
  rate_limits:
    default_rpm: 60
    default_burst: 10
  audit:
    enabled: true
    retention_days: 90

features:
  ai_suggestions: true
  file_uploads: true
  background_jobs: true
  real_time: false
```

---

## entities.yml

Data model definitions.

```yaml
entities:
  User:
    description: "Application user"
    table: users              # Override table name
    tenant_scoped: true       # Default: true
    auditable: true           # Default: true
    immutable: false          # Default: false
    soft_delete: true         # Default: true
    ai_writable: true         # Default: true
    ai_suggest_only: false    # Default: false

    fields:
      id:
        type: uuid
        primary: true
        generated: uuid

      email:
        type: string
        required: true
        unique: true
        length: 255
        validation:
          format: email

      name:
        type: string
        length: 100

      status:
        type: enum
        enum_values: [active, suspended, deleted]
        default: active

      balance:
        type: decimal
        precision: 19
        scale: 4
        default: 0

      metadata:
        type: jsonb

      organization_id:
        type: uuid
        reference:
          entity: Organization
          field: id
          on_delete: cascade

    indexes:
      - fields: [email]
        unique: true
      - fields: [tenant_id, created_at]

    constraints:
      - type: check
        name: positive_balance
        expression: "balance >= 0"

    relations:
      organization:
        type: belongs_to
        target: Organization
      posts:
        type: has_many
        target: Post
```

### Field Types

| Type | Description | Options |
|------|-------------|---------|
| `uuid` | UUID v4 | `generated: uuid` |
| `string` | Variable-length string | `length` |
| `text` | Unlimited text | - |
| `integer` | 32-bit integer | `generated: auto_increment` |
| `bigint` | 64-bit integer | - |
| `decimal` | Exact decimal | `precision`, `scale` |
| `float` | Floating point | - |
| `boolean` | True/false | - |
| `date` | Date only | - |
| `datetime` / `timestamp` | Date and time | `generated: now` |
| `json` / `jsonb` | JSON data | - |
| `enum` | Enumerated values | `enum_values` |
| `array` | Array type | `array_of` |

---

## actions.yml

API commands and queries.

```yaml
actions:
  create_user:
    type: command             # command (mutates) | query (reads)
    description: "Create a new user"
    entity: User              # Primary entity
    async: false              # Run as background job
    idempotent: true          # Required in prod for commands
    idempotency_key: input.email

    input:
      fields:
        email:
          type: string
          required: true
          validation:
            format: email
        name:
          type: string
          validation:
            min_length: 1
            max_length: 100

    output:
      type: entity
      entity: User

    auth:
      required: true
      roles: [admin, manager]
      permissions: [users:create]

    rate_limit:
      requests_per_minute: 10
      burst: 5
      scope: user             # user | tenant | ip | global

    ai_rules:
      allowed: true
      suggest_only: false
      max_per_session: 10
      require_confirmation: true

    audit:
      enabled: true
      include_input: true
      include_output: false
      sensitive_fields: [password]

    hooks:
      before: [validate_email]
      after: [send_welcome_email]
      on_error: [log_error]

    triggers_job: send_email

  list_users:
    type: query
    entity: User
    input:
      fields:
        status:
          type: enum
          enum_values: [active, suspended]
        limit:
          type: integer
          default: 20
        offset:
          type: integer
          default: 0
    output:
      type: list
      entity: User
      pagination: true
```

---

## flows.yml

UI flows and step transitions.

```yaml
flows:
  user_onboarding:
    name: "User Onboarding"
    description: "New user registration flow"
    entry_point: true         # Show in navigation
    icon: UserPlus

    auth:
      required: false
      roles: []

    initial_step: welcome

    steps:
      welcome:
        screen: welcome_screen
        title: "Welcome"
        transitions:
          next:
            target: profile
            label: "Get Started"

      profile:
        screen: profile_form
        title: "Your Profile"
        transitions:
          submit:
            target: complete
            action: create_user
          back:
            target: welcome

      complete:
        screen: complete_screen
        title: "All Done!"
        on_enter:
          action: send_welcome_email
        guards:
          - condition: "user.verified = true"
            redirect: verify
            message: "Please verify your email first"
```

---

## policies.yml

Security and access control.

```yaml
roles:
  admin:
    name: "Administrator"
    description: "Full system access"
    can:
      - create_user
      - delete_user
      - list_users

  manager:
    name: "Manager"
    inherits: [viewer]
    can:
      - create_user
      - update_user

  viewer:
    name: "Viewer"
    can:
      - list_users
      - get_user

policies:
  own_data_only:
    resource: User
    action: read
    effect: allow
    conditions:
      - type: allow_if
        expression: "resource.id = user.id OR 'admin' IN user.roles"
    filter: "id = :user_id"

  tenant_isolation:
    resource: "*"
    action: "*"
    effect: allow
    filter: "tenant_id = :tenant_id"

rate_limits:
  api_default:
    requests_per_minute: 100
    burst: 20
    scope: user
    applies_to:
      - list_users
      - get_user

  sensitive_actions:
    requests_per_minute: 10
    burst: 2
    scope: user
    applies_to:
      - delete_user

ai_rules:
  global:
    enabled: true
    max_actions_per_session: 50
    require_human_review: false
    blocked_actions:
      - delete_user
      - post_journal_entry

  entities:
    JournalEntry:
      readable: true
      writable: true
      suggest_only: true
      require_confirmation: true

  actions:
    approve_suggestion:
      suggest_only: true
      require_confirmation: true
```

---

## ui.yml

Screens and layouts.

```yaml
theme:
  primary_color: "#2563eb"
  font_family: "Inter, system-ui, sans-serif"
  border_radius: "0.5rem"

layouts:
  dashboard:
    type: dashboard
    sidebar:
      items:
        - label: "Users"
          flow: users
          icon: Users
        - label: "Settings"
          flow: settings
          icon: Settings
    header:
      show_user_menu: true
      show_tenant_switcher: true

screens:
  user_list:
    title: "Users"
    layout_type: list
    entity: User
    load_action: list_users
    table:
      columns:
        - field: email
          header: "Email"
          type: text
        - field: status
          header: "Status"
          type: badge
          badge_colors:
            active: green
            suspended: red
        - field: createdAt
          header: "Created"
          type: datetime
      row_actions:
        - label: "Edit"
          action: edit_user
          icon: Edit
        - label: "Delete"
          action: delete_user
          icon: Trash
          variant: destructive
          confirm:
            title: "Delete User?"
            message: "This action cannot be undone."
    actions:
      - label: "Add User"
        flow: users
        icon: Plus
        variant: primary
        position: header

  user_form:
    title: "New User"
    layout_type: form
    entity: User
    submit_action: create_user
    form:
      columns: 2
      fields:
        - name: email
          type: email
          label: "Email Address"
          validation:
            required: true
        - name: name
          type: text
          label: "Full Name"
        - name: status
          type: select
          label: "Status"
          options:
            - value: active
              label: "Active"
            - value: suspended
              label: "Suspended"
      submit_label: "Create User"
      cancel_label: "Cancel"
```

---

## metrics.yml

Events and KPIs.

```yaml
events:
  user_created:
    name: "User Created"
    category: user
    triggered_by:
      - create_user
    properties:
      user_id:
        type: string
        required: true
      source:
        type: string

  user_login:
    name: "User Login"
    category: user
    properties:
      user_id:
        type: string
        required: true
      ip:
        type: string

kpis:
  daily_signups:
    name: "Daily Signups"
    type: count
    source:
      event: user_created
    time_window: day
    format: number

  monthly_active_users:
    name: "Monthly Active Users"
    type: unique
    source:
      event: user_login
      field: user_id
    time_window: month
    format: number

dashboards:
  overview:
    name: "Overview"
    widgets:
      - type: metric
        title: "Signups Today"
        kpi: daily_signups
        size: small
      - type: chart
        title: "Signups Over Time"
        kpi: daily_signups
        chart_type: line
        size: large
```

---

## jobs.yml

Background jobs.

```yaml
jobs:
  send_welcome_email:
    name: "Send Welcome Email"
    description: "Send email to new users"
    queue: email
    input:
      user_id:
        type: string
        required: true
    retry:
      attempts: 3
      backoff: exponential
      delay: 5000
    timeout: 30000

  process_document:
    name: "Process Document"
    queue: extraction
    triggers:
      - upload_document
    concurrency: 2
    rate_limit:
      max: 10
      duration: 60000
    dead_letter_queue: failed_jobs
    hooks:
      on_complete: mark_processed
      on_failure: notify_admin

queues:
  default:
    concurrency: 5
    priority: 0

  email:
    concurrency: 10
    priority: 1

  extraction:
    concurrency: 2
    priority: 2
    rate_limit:
      max: 10
      duration: 60000
```

---

## Validation and Linking

When you run `fd spec validate`, the CLI:

1. **Schema Validation**: Checks each file against JSON Schema
2. **Cross-Reference Linking**: Validates references between files
3. **Profile Validation**: Enforces production rules (idempotency, rate limits)
4. **Invariant Checking**: Validates domain rules (e.g., balanced journal entries)

Errors block generation. Warnings are reported but don't block.

---

## Next Steps

- See [commands.md](commands.md) for FD CLI reference
- See [boundaries.md](boundaries.md) for generated code rules
- See [hosting.md](hosting.md) for deployment guide
