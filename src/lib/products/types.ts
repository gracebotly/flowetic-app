// ============================================================================
// Level 4: SaaS Wrapper — Core Types
// ============================================================================

export type PricingModel = "free" | "per_run" | "monthly" | "usage_based";
export type ProductStatus = "draft" | "active" | "paused" | "archived";
export type ExecutionStatus = "pending" | "running" | "success" | "error" | "timeout";
export type CustomerSubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "select"
  | "multi_select"
  | "textarea"
  | "url"
  | "phone";

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface InputField {
  name: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: { label: string; value: string }[]; // for select/multi_select
}

export interface ResultMapping {
  [displayKey: string]: string; // displayKey → JSONPath-like string e.g. "$.data.score"
}

export interface ExecutionConfig {
  platform: "make" | "n8n";
  timeout_ms: number;
  result_mapping: ResultMapping;
  // webhook_url is NEVER stored here — resolved at runtime from source
}

export interface WorkflowProduct {
  id: string;
  tenant_id: string;
  source_entity_id: string | null;
  source_id: string | null;
  name: string;
  description: string | null;
  slug: string;
  pricing_model: PricingModel;
  price_cents: number;
  input_schema: InputField[];
  execution_config: ExecutionConfig;
  landing_page_id: string | null;
  form_wizard_id: string | null;
  results_display_id: string | null;
  design_tokens: Record<string, unknown>;
  status: ProductStatus;
  max_runs_per_day: number;
  max_runs_per_customer: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCustomer {
  id: string;
  product_id: string;
  tenant_id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
  subscription_status: CustomerSubscriptionStatus;
  stripe_customer_id: string | null;
  total_runs: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  product_id: string;
  tenant_id: string;
  customer_id: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  mapped_results: Record<string, unknown> | null;
  status: ExecutionStatus;
  platform_execution_id: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}
