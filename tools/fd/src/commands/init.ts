import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';

interface InitOptions {
  preset: string;
  name?: string;
  skipInstall?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing Foundation Dev project...').start();

  try {
    const projectName = options.name || path.basename(process.cwd());

    // Create directory structure
    spinner.text = 'Creating directory structure...';
    await createDirectories();

    // Copy preset spec files
    spinner.text = `Applying ${options.preset} preset...`;
    await applyPreset(options.preset, projectName);

    spinner.succeed(chalk.green('Project initialized successfully!'));

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(chalk.gray('  1. Review and customize spec files in /spec'));
    console.log(chalk.gray('  2. Run: fd spec validate'));
    console.log(chalk.gray('  3. Run: fd generate'));
    console.log(chalk.gray('  4. Run: fd run'));
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Initialization failed'));
    console.error(error);
    process.exit(1);
  }
}

async function createDirectories(): Promise<void> {
  const dirs = [
    'spec',
    '.fd/cache',
    'services/core/src/extensions',
    'services/worker/src/extensions',
    'apps/web/src/extensions',
    'packages/ui/src/components',
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
  }
}

async function applyPreset(preset: string, projectName: string): Promise<void> {
  const presets: Record<string, () => Promise<void>> = {
    ledgerflow: () => applyLedgerFlowPreset(projectName),
    clipflow: () => applyClipFlowPreset(projectName),
  };

  const applyFn = presets[preset];
  if (!applyFn) {
    throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`);
  }

  await applyFn();
}

async function applyLedgerFlowPreset(projectName: string): Promise<void> {
  // Product spec
  const productSpec = `name: ${projectName}
version: "0.1.0"
description: AI-powered accounting and bookkeeping platform

tenancy:
  mode: multi
  isolation: row
  tenant_id_column: tenant_id

profile: dev

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
  provider: demo
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
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/product.yml'), productSpec);

  // Entities spec
  const entitiesSpec = `entities:
  Organization:
    description: A company or business entity
    tenant_scoped: false
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      name:
        type: string
        required: true
        length: 255
      status:
        type: enum
        enum_values: [active, suspended, closed]
        default: active
    indexes:
      - fields: [name]
        unique: true

  Member:
    description: A user's membership in an organization
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      organization_id:
        type: uuid
        required: true
        reference:
          entity: Organization
          on_delete: cascade
      user_id:
        type: uuid
        required: true
      email:
        type: string
        required: true
        validation:
          format: email
      role:
        type: enum
        enum_values: [owner, admin, accountant, viewer]
        required: true
    indexes:
      - fields: [organization_id, user_id]
        unique: true
    relations:
      organization:
        type: belongs_to
        target: Organization

  Document:
    description: An uploaded receipt or invoice
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      type:
        type: enum
        enum_values: [receipt, invoice, statement, other]
        required: true
      file_url:
        type: string
        required: true
      file_name:
        type: string
        required: true
      file_size:
        type: integer
      mime_type:
        type: string
      status:
        type: enum
        enum_values: [uploaded, processing, extracted, failed]
        default: uploaded
      extracted_data:
        type: jsonb
      extraction_confidence:
        type: float
      uploaded_by:
        type: uuid
        required: true
    relations:
      suggestions:
        type: has_many
        target: Suggestion

  Suggestion:
    description: AI-generated suggestion from document extraction
    ai_suggest_only: true
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      document_id:
        type: uuid
        required: true
        reference:
          entity: Document
          on_delete: cascade
      suggestion_type:
        type: enum
        enum_values: [journal_entry, vendor, category, amount]
        required: true
      suggested_data:
        type: jsonb
        required: true
      confidence:
        type: float
        required: true
      status:
        type: enum
        enum_values: [pending, approved, rejected, applied]
        default: pending
      reviewed_by:
        type: uuid
      reviewed_at:
        type: timestamp
    relations:
      document:
        type: belongs_to
        target: Document

  Account:
    description: Chart of accounts entry
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      code:
        type: string
        required: true
        length: 20
      name:
        type: string
        required: true
      type:
        type: enum
        enum_values: [asset, liability, equity, revenue, expense]
        required: true
      parent_id:
        type: uuid
        reference:
          entity: Account
          on_delete: restrict
      is_active:
        type: boolean
        default: true
    indexes:
      - fields: [tenant_id, code]
        unique: true

  JournalEntry:
    description: A journal entry (group of balanced lines)
    immutable: true
    ai_suggest_only: true
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      entry_number:
        type: string
        required: true
      date:
        type: date
        required: true
      description:
        type: text
      status:
        type: enum
        enum_values: [draft, posted, void]
        default: draft
      source_document_id:
        type: uuid
        reference:
          entity: Document
      posted_by:
        type: uuid
      posted_at:
        type: timestamp
      currency:
        type: string
        length: 3
        default: USD
    indexes:
      - fields: [tenant_id, entry_number]
        unique: true
      - fields: [tenant_id, date]
    constraints:
      - type: check
        name: valid_currency
        expression: "length(currency) = 3"
    relations:
      lines:
        type: has_many
        target: JournalLine
      document:
        type: belongs_to
        target: Document

  JournalLine:
    description: A single line in a journal entry
    immutable: true
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      entry_id:
        type: uuid
        required: true
        reference:
          entity: JournalEntry
          on_delete: cascade
      account_id:
        type: uuid
        required: true
        reference:
          entity: Account
      line_number:
        type: integer
        required: true
      description:
        type: string
      debit_amount:
        type: decimal
        precision: 19
        scale: 4
        default: 0
      credit_amount:
        type: decimal
        precision: 19
        scale: 4
        default: 0
    indexes:
      - fields: [entry_id, line_number]
        unique: true
    constraints:
      - type: check
        name: debit_xor_credit
        expression: "(debit_amount > 0 AND credit_amount = 0) OR (debit_amount = 0 AND credit_amount > 0) OR (debit_amount = 0 AND credit_amount = 0)"
    relations:
      entry:
        type: belongs_to
        target: JournalEntry
      account:
        type: belongs_to
        target: Account
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/entities.yml'), entitiesSpec);

  // Actions spec
  const actionsSpec = `actions:
  # Organization actions
  create_organization:
    type: command
    entity: Organization
    description: Create a new organization
    idempotent: false
    input:
      fields:
        name:
          type: string
          required: true
    output:
      type: entity
      entity: Organization
    auth:
      required: true

  list_organizations:
    type: query
    entity: Organization
    description: List organizations for current user
    input:
      fields:
        limit:
          type: integer
          default: 20
        offset:
          type: integer
          default: 0
    output:
      type: list
      entity: Organization
      pagination: true

  # Document actions
  upload_document:
    type: command
    entity: Document
    description: Upload a receipt or invoice
    idempotent: false
    input:
      fields:
        file:
          type: file
          required: true
          file_config:
            max_size_mb: 10
            allowed_types: [image/jpeg, image/png, application/pdf]
        type:
          type: enum
          enum_values: [receipt, invoice, statement, other]
          required: true
    output:
      type: entity
      entity: Document
    rate_limit:
      requests_per_minute: 20
      scope: user
    triggers_job: extract_document

  list_documents:
    type: query
    entity: Document
    description: List uploaded documents
    input:
      fields:
        status:
          type: enum
          enum_values: [uploaded, processing, extracted, failed]
        limit:
          type: integer
          default: 20
        offset:
          type: integer
          default: 0
    output:
      type: list
      entity: Document
      pagination: true

  get_document:
    type: query
    entity: Document
    description: Get document details
    input:
      fields:
        id:
          type: uuid
          required: true
    output:
      type: entity
      entity: Document

  # Suggestion actions
  list_suggestions:
    type: query
    entity: Suggestion
    description: List pending AI suggestions
    input:
      fields:
        status:
          type: enum
          enum_values: [pending, approved, rejected, applied]
          default: pending
        limit:
          type: integer
          default: 20
        offset:
          type: integer
          default: 0
    output:
      type: list
      entity: Suggestion
      pagination: true

  approve_suggestion:
    type: command
    entity: Suggestion
    description: Approve an AI suggestion
    idempotent: true
    idempotency_key: input.id
    input:
      fields:
        id:
          type: uuid
          required: true
        modifications:
          type: object
    output:
      type: entity
      entity: Suggestion
    auth:
      required: true
      roles: [owner, admin, accountant]

  reject_suggestion:
    type: command
    entity: Suggestion
    description: Reject an AI suggestion
    idempotent: true
    input:
      fields:
        id:
          type: uuid
          required: true
        reason:
          type: string
    output:
      type: entity
      entity: Suggestion

  # Journal entry actions
  create_journal_entry:
    type: command
    entity: JournalEntry
    description: Create a draft journal entry
    idempotent: false
    input:
      fields:
        date:
          type: date
          required: true
        description:
          type: string
        lines:
          type: array
          array_of: object
          required: true
        source_document_id:
          type: uuid
    output:
      type: entity
      entity: JournalEntry
    ai_rules:
      suggest_only: true
      require_confirmation: true

  post_journal_entry:
    type: command
    entity: JournalEntry
    description: Post a journal entry (makes it immutable)
    idempotent: true
    idempotency_key: input.id
    input:
      fields:
        id:
          type: uuid
          required: true
    output:
      type: entity
      entity: JournalEntry
    auth:
      required: true
      roles: [owner, admin, accountant]
    ai_rules:
      allowed: false
    audit:
      enabled: true
      include_input: true
      include_output: true
    hooks:
      before:
        - validate_entry_balance

  list_journal_entries:
    type: query
    entity: JournalEntry
    description: List journal entries
    input:
      fields:
        status:
          type: enum
          enum_values: [draft, posted, void]
        start_date:
          type: date
        end_date:
          type: date
        limit:
          type: integer
          default: 20
        offset:
          type: integer
          default: 0
    output:
      type: list
      entity: JournalEntry
      pagination: true

  get_journal_entry:
    type: query
    entity: JournalEntry
    description: Get journal entry with lines
    input:
      fields:
        id:
          type: uuid
          required: true
    output:
      type: entity
      entity: JournalEntry

  # Account actions
  list_accounts:
    type: query
    entity: Account
    description: List chart of accounts
    input:
      fields:
        type:
          type: enum
          enum_values: [asset, liability, equity, revenue, expense]
        is_active:
          type: boolean
          default: true
    output:
      type: list
      entity: Account
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/actions.yml'), actionsSpec);

  // Flows spec
  const flowsSpec = `flows:
  documents:
    name: Documents
    description: Upload and manage receipts/invoices
    entry_point: true
    icon: FileText
    steps:
      list:
        screen: documents_list
        title: Documents
        transitions:
          upload:
            target: upload
            label: Upload Document
          view:
            target: detail
            action: get_document
      upload:
        screen: document_upload
        title: Upload Document
        transitions:
          success:
            target: list
            action: upload_document
          cancel:
            target: list
      detail:
        screen: document_detail
        title: Document Details
        transitions:
          back:
            target: list

  suggestions:
    name: AI Suggestions
    description: Review and approve AI-generated suggestions
    entry_point: true
    icon: CheckCircle
    steps:
      list:
        screen: suggestions_list
        title: Pending Suggestions
        transitions:
          review:
            target: review
      review:
        screen: suggestion_review
        title: Review Suggestion
        transitions:
          approve:
            target: list
            action: approve_suggestion
          reject:
            target: list
            action: reject_suggestion
          back:
            target: list

  journal:
    name: Journal Entries
    description: View and manage journal entries
    entry_point: true
    icon: BookOpen
    steps:
      list:
        screen: journal_list
        title: Journal Entries
        transitions:
          create:
            target: create
          view:
            target: detail
      create:
        screen: journal_form
        title: New Journal Entry
        transitions:
          save:
            target: detail
            action: create_journal_entry
          cancel:
            target: list
      detail:
        screen: journal_detail
        title: Journal Entry
        transitions:
          post:
            target: list
            action: post_journal_entry
            condition: "status === 'draft'"
          back:
            target: list

  accounts:
    name: Chart of Accounts
    description: Manage chart of accounts
    entry_point: true
    icon: CreditCard
    steps:
      list:
        screen: accounts_list
        title: Chart of Accounts
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/flows.yml'), flowsSpec);

  // Policies spec
  const policiesSpec = `roles:
  owner:
    name: Owner
    description: Organization owner with full access
    can:
      - create_organization
      - list_organizations
      - upload_document
      - list_documents
      - get_document
      - list_suggestions
      - approve_suggestion
      - reject_suggestion
      - create_journal_entry
      - post_journal_entry
      - list_journal_entries
      - get_journal_entry
      - list_accounts

  admin:
    name: Administrator
    description: Full access except ownership transfer
    inherits:
      - accountant
    can:
      - approve_suggestion
      - reject_suggestion
      - post_journal_entry

  accountant:
    name: Accountant
    description: Can manage documents and entries
    inherits:
      - viewer
    can:
      - upload_document
      - create_journal_entry
      - approve_suggestion
      - reject_suggestion

  viewer:
    name: Viewer
    description: Read-only access
    can:
      - list_documents
      - get_document
      - list_suggestions
      - list_journal_entries
      - get_journal_entry
      - list_accounts

policies:
  tenant_isolation:
    resource: "*"
    action: "*"
    effect: allow
    filter: "tenant_id = :tenant_id"

  own_documents:
    resource: Document
    action: read
    effect: allow
    conditions:
      - type: allow_if
        expression: "resource.tenant_id = user.tenant_id"

rate_limits:
  document_upload:
    requests_per_minute: 20
    burst: 5
    scope: user
    applies_to:
      - upload_document

  general_api:
    requests_per_minute: 100
    burst: 20
    scope: user

ai_rules:
  global:
    enabled: true
    max_actions_per_session: 50
    require_human_review: false
    blocked_actions:
      - post_journal_entry

  entities:
    JournalEntry:
      readable: true
      writable: true
      suggest_only: true
      require_confirmation: true
    JournalLine:
      readable: true
      writable: true
      suggest_only: true
    Suggestion:
      readable: true
      writable: false

  actions:
    post_journal_entry:
      allowed: false
    approve_suggestion:
      suggest_only: true
      require_confirmation: true
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/policies.yml'), policiesSpec);

  // UI spec
  const uiSpec = `theme:
  primary_color: "#2563eb"
  font_family: "Inter, system-ui, sans-serif"
  border_radius: "0.5rem"
  spacing_unit: 4

layouts:
  dashboard:
    type: dashboard
    sidebar:
      items:
        - label: Documents
          flow: documents
          icon: FileText
        - label: Suggestions
          flow: suggestions
          icon: CheckCircle
        - label: Journal
          flow: journal
          icon: BookOpen
        - label: Accounts
          flow: accounts
          icon: CreditCard
    header:
      show_user_menu: true
      show_tenant_switcher: true

screens:
  documents_list:
    title: Documents
    layout_type: list
    entity: Document
    load_action: list_documents
    table:
      columns:
        - field: file_name
          header: File Name
          type: text
        - field: type
          header: Type
          type: badge
          badge_colors:
            receipt: green
            invoice: blue
            statement: purple
            other: gray
        - field: status
          header: Status
          type: badge
          badge_colors:
            uploaded: gray
            processing: yellow
            extracted: green
            failed: red
        - field: createdAt
          header: Uploaded
          type: datetime
      row_actions:
        - label: View
          action: get_document
          icon: Eye
    actions:
      - label: Upload Document
        flow: documents
        icon: Upload
        variant: primary
        position: header

  document_upload:
    title: Upload Document
    layout_type: form
    entity: Document
    submit_action: upload_document
    form:
      fields:
        - name: file
          type: file
          label: Document File
          validation:
            required: true
        - name: type
          type: select
          label: Document Type
          options:
            - value: receipt
              label: Receipt
            - value: invoice
              label: Invoice
            - value: statement
              label: Statement
            - value: other
              label: Other
          validation:
            required: true
      submit_label: Upload
      cancel_label: Cancel

  document_detail:
    title: Document Details
    layout_type: detail
    entity: Document
    load_action: get_document
    detail:
      fields:
        - name: file_name
          label: File Name
        - name: type
          label: Type
        - name: status
          label: Status
        - name: extraction_confidence
          label: Confidence
          type: percentage
        - name: createdAt
          label: Uploaded At
          type: datetime
      related:
        - entity: Suggestion
          title: AI Suggestions
          screen: suggestions_list

  suggestions_list:
    title: AI Suggestions
    layout_type: list
    entity: Suggestion
    load_action: list_suggestions
    table:
      columns:
        - field: suggestion_type
          header: Type
          type: badge
        - field: confidence
          header: Confidence
          type: number
          format: percentage
        - field: status
          header: Status
          type: badge
          badge_colors:
            pending: yellow
            approved: green
            rejected: red
            applied: blue
        - field: createdAt
          header: Created
          type: datetime
      row_actions:
        - label: Review
          action: approve_suggestion
          icon: Check
          condition: "status === 'pending'"

  suggestion_review:
    title: Review Suggestion
    layout_type: detail
    entity: Suggestion
    detail:
      sections:
        - type: fields
          title: Suggestion Details
          fields:
            - name: suggestion_type
            - name: confidence
            - name: suggested_data
    actions:
      - label: Approve
        action: approve_suggestion
        variant: primary
      - label: Reject
        action: reject_suggestion
        variant: destructive

  journal_list:
    title: Journal Entries
    layout_type: list
    entity: JournalEntry
    load_action: list_journal_entries
    table:
      columns:
        - field: entry_number
          header: Entry #
          type: text
        - field: date
          header: Date
          type: date
        - field: description
          header: Description
          type: text
        - field: status
          header: Status
          type: badge
          badge_colors:
            draft: yellow
            posted: green
            void: red
      row_actions:
        - label: View
          action: get_journal_entry
          icon: Eye
    actions:
      - label: New Entry
        flow: journal
        icon: Plus
        variant: primary
        position: header

  journal_form:
    title: New Journal Entry
    layout_type: form
    entity: JournalEntry
    submit_action: create_journal_entry
    form:
      columns: 2
      fields:
        - name: date
          type: date
          label: Entry Date
          validation:
            required: true
        - name: description
          type: textarea
          label: Description
      submit_label: Create Entry

  journal_detail:
    title: Journal Entry
    layout_type: detail
    entity: JournalEntry
    load_action: get_journal_entry
    detail:
      fields:
        - name: entry_number
          label: Entry Number
        - name: date
          label: Date
        - name: status
          label: Status
        - name: description
          label: Description
      related:
        - entity: JournalLine
          title: Lines
    actions:
      - label: Post Entry
        action: post_journal_entry
        variant: primary
        condition: "status === 'draft'"

  accounts_list:
    title: Chart of Accounts
    layout_type: list
    entity: Account
    load_action: list_accounts
    table:
      columns:
        - field: code
          header: Code
          type: text
        - field: name
          header: Name
          type: text
        - field: type
          header: Type
          type: badge
          badge_colors:
            asset: blue
            liability: red
            equity: purple
            revenue: green
            expense: orange
        - field: is_active
          header: Active
          type: boolean
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/ui.yml'), uiSpec);

  // Metrics spec
  const metricsSpec = `events:
  document_uploaded:
    name: Document Uploaded
    category: user
    triggered_by:
      - upload_document
    properties:
      document_type:
        type: string
        required: true
      file_size:
        type: number

  document_extracted:
    name: Document Extracted
    category: system
    properties:
      document_id:
        type: string
        required: true
      confidence:
        type: number
      extraction_time_ms:
        type: number

  suggestion_created:
    name: AI Suggestion Created
    category: system
    properties:
      suggestion_type:
        type: string
      confidence:
        type: number

  suggestion_reviewed:
    name: Suggestion Reviewed
    category: user
    triggered_by:
      - approve_suggestion
      - reject_suggestion
    properties:
      approved:
        type: boolean
        required: true
      time_to_review_ms:
        type: number

  journal_posted:
    name: Journal Entry Posted
    category: business
    triggered_by:
      - post_journal_entry
    properties:
      entry_id:
        type: string
        required: true
      line_count:
        type: number
      total_amount:
        type: number

kpis:
  documents_uploaded:
    name: Documents Uploaded
    type: count
    source:
      event: document_uploaded
    time_window: day
    format: number

  extraction_success_rate:
    name: Extraction Success Rate
    type: ratio
    source:
      entity: Document
      field: status
    filter: "status IN ('extracted', 'failed')"
    format: percentage
    target:
      value: 95
      direction: up

  suggestion_approval_rate:
    name: Suggestion Approval Rate
    type: ratio
    source:
      event: suggestion_reviewed
    filter: "approved = true"
    format: percentage

  entries_posted:
    name: Journal Entries Posted
    type: count
    source:
      event: journal_posted
    time_window: day
    format: number

dashboards:
  overview:
    name: Overview
    widgets:
      - type: metric
        title: Documents Today
        kpi: documents_uploaded
        size: small
      - type: metric
        title: Extraction Rate
        kpi: extraction_success_rate
        size: small
      - type: metric
        title: Approval Rate
        kpi: suggestion_approval_rate
        size: small
      - type: metric
        title: Entries Posted
        kpi: entries_posted
        size: small
      - type: chart
        title: Documents Over Time
        kpi: documents_uploaded
        chart_type: line
        size: large
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/metrics.yml'), metricsSpec);

  // Jobs spec
  const jobsSpec = `jobs:
  extract_document:
    name: Extract Document
    description: Run AI extraction on uploaded document
    queue: extraction
    input:
      document_id:
        type: string
        required: true
    retry:
      attempts: 3
      backoff: exponential
      delay: 5000
    timeout: 120000
    hooks:
      on_complete: create_suggestions
      on_failure: mark_extraction_failed

  create_suggestions:
    name: Create Suggestions
    description: Generate AI suggestions from extracted data
    queue: default
    input:
      document_id:
        type: string
        required: true
      extracted_data:
        type: object
        required: true
    retry:
      attempts: 2
      backoff: fixed
      delay: 1000

  apply_suggestion:
    name: Apply Suggestion
    description: Apply an approved suggestion
    queue: default
    triggers:
      - approve_suggestion
    input:
      suggestion_id:
        type: string
        required: true

queues:
  default:
    concurrency: 5
    priority: 0

  extraction:
    concurrency: 2
    priority: 1
    rate_limit:
      max: 10
      duration: 60000
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/jobs.yml'), jobsSpec);

  // Roadmap
  const roadmap = `# Product Roadmap

## MVP (v0.1.0)
- [x] Document upload and storage
- [x] AI extraction (via background jobs)
- [x] Suggestion review workflow
- [x] Basic journal entry creation
- [x] Posting with balance validation

## v0.2.0
- [ ] Multi-currency support
- [ ] Recurring entries
- [ ] Bank statement reconciliation
- [ ] Vendor management

## v0.3.0
- [ ] Financial reports (P&L, Balance Sheet)
- [ ] Audit trail export
- [ ] Team collaboration features
- [ ] API access for integrations

## Future
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Multi-entity consolidation
- [ ] Tax integration
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/roadmap.md'), roadmap);
}

async function applyClipFlowPreset(projectName: string): Promise<void> {
  // Minimal starter preset for general apps
  const productSpec = `name: ${projectName}
version: "0.1.0"
description: A Foundation Dev application

tenancy:
  mode: multi
  isolation: row

profile: dev

auth:
  provider: demo

features:
  ai_suggestions: false
  file_uploads: false
  background_jobs: false
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/product.yml'), productSpec);

  const entitiesSpec = `entities:
  Item:
    description: A basic item entity
    fields:
      id:
        type: uuid
        primary: true
        generated: uuid
      name:
        type: string
        required: true
      description:
        type: text
      status:
        type: enum
        enum_values: [active, archived]
        default: active
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/entities.yml'), entitiesSpec);

  const actionsSpec = `actions:
  list_items:
    type: query
    entity: Item
    output:
      type: list
      entity: Item

  create_item:
    type: command
    entity: Item
    input:
      fields:
        name:
          type: string
          required: true
        description:
          type: string
    output:
      type: entity
      entity: Item
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/actions.yml'), actionsSpec);

  const flowsSpec = `flows:
  items:
    name: Items
    entry_point: true
    icon: Home
    steps:
      list:
        screen: items_list
        transitions:
          create:
            target: create
      create:
        screen: item_form
        transitions:
          save:
            target: list
            action: create_item
`;

  await fs.writeFile(path.join(process.cwd(), 'spec/flows.yml'), flowsSpec);
}
