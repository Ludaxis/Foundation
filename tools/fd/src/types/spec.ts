// Core spec types derived from JSON schemas

export interface ProductSpec {
  name: string;
  version: string;
  description?: string;
  tenancy: {
    mode: 'single' | 'multi';
    isolation: 'row' | 'schema' | 'database';
    tenant_id_column?: string;
  };
  profile: 'dev' | 'prod';
  profiles?: {
    dev?: ProfileConfig;
    prod?: ProfileConfig;
  };
  auth?: {
    provider?: 'demo' | 'clerk' | 'auth0' | 'supabase' | 'custom';
    session_duration?: string;
    require_mfa?: boolean;
  };
  defaults?: {
    pagination?: {
      page_size?: number;
      max_page_size?: number;
    };
    rate_limits?: {
      default_rpm?: number;
      default_burst?: number;
    };
    audit?: {
      enabled?: boolean;
      retention_days?: number;
    };
  };
  features?: {
    ai_suggestions?: boolean;
    file_uploads?: boolean;
    background_jobs?: boolean;
    real_time?: boolean;
  };
}

export interface ProfileConfig {
  require_idempotency?: boolean;
  require_rate_limits?: boolean;
  strict_tenancy?: boolean;
  audit_level?: 'none' | 'commands' | 'all';
}

export interface EntitySpec {
  description?: string;
  table?: string;
  tenant_scoped?: boolean;
  auditable?: boolean;
  immutable?: boolean;
  soft_delete?: boolean;
  ai_writable?: boolean;
  ai_suggest_only?: boolean;
  fields: Record<string, FieldSpec>;
  indexes?: IndexSpec[];
  constraints?: ConstraintSpec[];
  relations?: Record<string, RelationSpec>;
}

export interface FieldSpec {
  type: FieldType;
  description?: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  generated?: 'uuid' | 'now' | 'auto_increment';
  primary?: boolean;
  nullable?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  enum_values?: string[];
  array_of?: string;
  reference?: {
    entity: string;
    field?: string;
    on_delete?: 'cascade' | 'restrict' | 'set_null' | 'no_action';
  };
  validation?: {
    min?: number;
    max?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    format?: 'email' | 'url' | 'phone' | 'currency' | 'percentage';
  };
}

export type FieldType =
  | 'uuid'
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'json'
  | 'jsonb'
  | 'enum'
  | 'array';

export interface IndexSpec {
  name?: string;
  fields: string[];
  unique?: boolean;
  where?: string;
}

export interface ConstraintSpec {
  name?: string;
  type: 'check' | 'unique' | 'exclude';
  expression: string;
}

export interface RelationSpec {
  type: 'has_one' | 'has_many' | 'belongs_to' | 'many_to_many';
  target: string;
  through?: string;
  foreign_key?: string;
  inverse?: string;
}

export interface ActionSpec {
  type: 'command' | 'query';
  description?: string;
  entity?: string;
  async?: boolean;
  idempotent?: boolean;
  idempotency_key?: string;
  input?: InputSchema;
  output?: OutputSchema;
  auth?: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
  };
  rate_limit?: {
    requests_per_minute?: number;
    burst?: number;
    scope?: 'user' | 'tenant' | 'global';
  };
  ai_rules?: {
    allowed?: boolean;
    suggest_only?: boolean;
    max_per_session?: number;
    require_confirmation?: boolean;
  };
  audit?: {
    enabled?: boolean;
    include_input?: boolean;
    include_output?: boolean;
    sensitive_fields?: string[];
  };
  metrics?: {
    track?: boolean;
    custom_dimensions?: string[];
  };
  hooks?: {
    before?: string[];
    after?: string[];
    on_error?: string[];
  };
  triggers_job?: string;
}

export interface InputSchema {
  fields?: Record<string, InputFieldSpec>;
  validation?: {
    rules?: ValidationRule[];
  };
}

export interface InputFieldSpec {
  type: InputFieldType;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum_values?: string[];
  array_of?: string;
  object_schema?: Record<string, InputFieldSpec>;
  validation?: {
    min?: number;
    max?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    format?: string;
  };
  file_config?: {
    max_size_mb?: number;
    allowed_types?: string[];
  };
}

export type InputFieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'enum'
  | 'array'
  | 'object'
  | 'file';

export interface ValidationRule {
  expression: string;
  message: string;
}

export interface OutputSchema {
  type?: 'entity' | 'list' | 'object' | 'void';
  entity?: string;
  fields?: Record<string, { type: string; description?: string }>;
  pagination?: boolean;
}

export interface FlowSpec {
  name: string;
  description?: string;
  entry_point?: boolean;
  icon?: string;
  auth?: {
    required?: boolean;
    roles?: string[];
  };
  steps: Record<string, StepSpec>;
  initial_step?: string;
}

export interface StepSpec {
  screen: string;
  title?: string;
  transitions?: Record<string, TransitionSpec>;
  on_enter?: {
    action?: string;
    params?: Record<string, unknown>;
  };
  guards?: GuardSpec[];
}

export interface TransitionSpec {
  target: string;
  action?: string;
  condition?: string;
  label?: string;
}

export interface GuardSpec {
  condition: string;
  redirect?: string;
  message?: string;
}

export interface PoliciesSpec {
  roles?: Record<string, RoleSpec>;
  permissions?: Record<string, PermissionSpec>;
  policies?: Record<string, PolicySpec>;
  rate_limits?: Record<string, RateLimitSpec>;
  ai_rules?: {
    global?: AiGlobalRules;
    entities?: Record<string, AiEntityRules>;
    actions?: Record<string, AiActionRules>;
  };
}

export interface RoleSpec {
  name: string;
  description?: string;
  inherits?: string[];
  permissions?: string[];
  can?: string[];
}

export interface PermissionSpec {
  name?: string;
  description?: string;
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'list' | '*')[];
}

export interface PolicySpec {
  name?: string;
  description?: string;
  resource: string;
  action?: 'create' | 'read' | 'update' | 'delete' | 'list' | '*';
  effect?: 'allow' | 'deny';
  conditions?: ConditionSpec[];
  filter?: string;
  priority?: number;
}

export interface ConditionSpec {
  type?: 'allow_if' | 'deny_if' | 'require';
  expression: string;
  message?: string;
}

export interface RateLimitSpec {
  requests_per_minute: number;
  burst?: number;
  scope?: 'user' | 'tenant' | 'ip' | 'global';
  key?: string;
  applies_to?: string[];
}

export interface AiGlobalRules {
  enabled?: boolean;
  max_actions_per_session?: number;
  require_human_review?: boolean;
  blocked_actions?: string[];
}

export interface AiEntityRules {
  readable?: boolean;
  writable?: boolean;
  suggest_only?: boolean;
  require_confirmation?: boolean;
}

export interface AiActionRules {
  allowed?: boolean;
  suggest_only?: boolean;
  max_per_session?: number;
  require_confirmation?: boolean;
}

export interface UiSpec {
  theme?: ThemeSpec;
  layouts?: Record<string, LayoutSpec>;
  screens?: Record<string, ScreenSpec>;
  components?: Record<string, ComponentSpec>;
}

export interface ThemeSpec {
  primary_color?: string;
  font_family?: string;
  border_radius?: string;
  spacing_unit?: number;
}

export interface LayoutSpec {
  type: 'dashboard' | 'auth' | 'blank' | 'sidebar' | 'full';
  sidebar?: {
    items?: NavItemSpec[];
  };
  header?: {
    show_user_menu?: boolean;
    show_tenant_switcher?: boolean;
  };
}

export interface NavItemSpec {
  label: string;
  flow: string;
  icon?: string;
  badge?: string;
}

export interface ScreenSpec {
  title?: string;
  description?: string;
  layout_type: 'form' | 'list' | 'detail' | 'dashboard' | 'wizard' | 'custom';
  layout?: string;
  entity?: string;
  load_action?: string;
  submit_action?: string;
  sections?: SectionSpec[];
  table?: TableConfigSpec;
  form?: FormConfigSpec;
  detail?: DetailConfigSpec;
  actions?: ScreenActionSpec[];
}

export interface SectionSpec {
  type: 'fields' | 'table' | 'card' | 'stats' | 'chart' | 'custom';
  title?: string;
  fields?: FieldConfigSpec[];
  component?: string;
}

export interface FieldConfigSpec {
  name: string;
  label?: string;
  type?: string;
  placeholder?: string;
  help_text?: string;
  readonly?: boolean;
  hidden?: boolean;
  options?: { value: unknown; label: string }[];
  options_from?: {
    action?: string;
    value_field?: string;
    label_field?: string;
  };
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  col_span?: number;
  conditional?: {
    show_when?: string;
    hide_when?: string;
  };
}

export interface TableConfigSpec {
  columns?: ColumnConfigSpec[];
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  paginated?: boolean;
  selectable?: boolean;
  row_actions?: RowActionSpec[];
  bulk_actions?: BulkActionSpec[];
  empty_state?: {
    title?: string;
    description?: string;
    action?: ScreenActionSpec;
  };
}

export interface ColumnConfigSpec {
  field: string;
  header?: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'badge' | 'link' | 'avatar' | 'boolean' | 'custom';
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  format?: string;
  link_to?: string;
  badge_colors?: Record<string, string>;
}

export interface RowActionSpec {
  label: string;
  action: string;
  icon?: string;
  variant?: 'default' | 'destructive' | 'outline';
  confirm?: {
    title?: string;
    message?: string;
  };
  condition?: string;
}

export interface BulkActionSpec {
  label: string;
  action: string;
  icon?: string;
  confirm?: {
    title?: string;
    message?: string;
  };
}

export interface FormConfigSpec {
  fields?: FieldConfigSpec[];
  columns?: number;
  submit_label?: string;
  cancel_label?: string;
  show_reset?: boolean;
}

export interface DetailConfigSpec {
  fields?: FieldConfigSpec[];
  sections?: SectionSpec[];
  related?: {
    entity?: string;
    title?: string;
    screen?: string;
  }[];
}

export interface ScreenActionSpec {
  label: string;
  action?: string;
  flow?: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  position?: 'header' | 'footer' | 'inline';
}

export interface ComponentSpec {
  name?: string;
  description?: string;
  props?: Record<string, { type: string; required?: boolean; default?: unknown }>;
}

export interface MetricsSpec {
  events?: Record<string, EventSpec>;
  kpis?: Record<string, KpiSpec>;
  dashboards?: Record<string, DashboardSpec>;
  alerts?: Record<string, AlertSpec>;
}

export interface EventSpec {
  name: string;
  description?: string;
  category?: 'user' | 'system' | 'business' | 'error';
  triggered_by?: string[];
  properties?: Record<string, { type: string; description?: string; required?: boolean }>;
  retention_days?: number;
}

export interface KpiSpec {
  name: string;
  description?: string;
  type: 'count' | 'sum' | 'average' | 'ratio' | 'percentile' | 'unique';
  source?: {
    event?: string;
    entity?: string;
    field?: string;
  };
  filter?: string;
  group_by?: string[];
  time_window?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  target?: {
    value?: number;
    direction?: 'up' | 'down';
  };
}

export interface DashboardSpec {
  name: string;
  description?: string;
  access?: {
    roles?: string[];
  };
  widgets: WidgetSpec[];
  refresh_interval?: number;
}

export interface WidgetSpec {
  type: 'metric' | 'chart' | 'table' | 'list' | 'status';
  title?: string;
  kpi?: string;
  chart_type?: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  size?: 'small' | 'medium' | 'large' | 'full';
  position?: {
    row?: number;
    col?: number;
  };
}

export interface AlertSpec {
  name?: string;
  kpi: string;
  condition: {
    operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    threshold?: number;
    duration?: string;
  };
  severity?: 'info' | 'warning' | 'error' | 'critical';
  channels?: ('email' | 'slack' | 'pagerduty' | 'webhook')[];
}

export interface JobSpec {
  name: string;
  description?: string;
  queue?: string;
  input?: Record<string, { type: string; required?: boolean }>;
  retry?: {
    attempts?: number;
    backoff?: 'fixed' | 'exponential';
    delay?: number;
  };
  timeout?: number;
  concurrency?: number;
  rate_limit?: {
    max?: number;
    duration?: number;
  };
  cron?: string;
  triggers?: string[];
  dead_letter_queue?: string;
  hooks?: {
    on_complete?: string;
    on_failure?: string;
  };
}

export interface JobsSpec {
  jobs?: Record<string, JobSpec>;
  queues?: Record<string, QueueSpec>;
}

export interface QueueSpec {
  name?: string;
  concurrency?: number;
  priority?: number;
  rate_limit?: {
    max?: number;
    duration?: number;
  };
}

// Bundle of all specs
export interface Spec {
  product: ProductSpec;
  entities: Record<string, EntitySpec>;
  actions: Record<string, ActionSpec>;
  flows: Record<string, FlowSpec>;
  policies: PoliciesSpec;
  ui: UiSpec;
  metrics: MetricsSpec;
  jobs: JobsSpec;
}

export interface SpecBundle extends Spec {
  _meta: {
    version: string;
    generated_at: string;
    hash: string;
  };
}
