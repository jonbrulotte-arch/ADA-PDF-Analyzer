export type CheckStatus = "pass" | "fail" | "warning" | "info";
export type Severity = "critical" | "major" | "minor";
export type FixType =
  | "metadata_title"
  | "metadata_language"
  | "alt_text"
  | "bookmarks"
  | "form_tooltip"
  | "pdfua_identifier";

export interface FixAction {
  id: string;
  description: string;
  auto_fixable: boolean;
  fix_type: FixType;
  fix_data: Record<string, unknown>;
}

export interface AccessibilityCheck {
  id: string;
  category: string;
  name: string;
  wcag_criterion: string | null;
  pdf_ua_criterion: string | null;
  status: CheckStatus;
  severity: Severity;
  description: string;
  details: string[];
  fix: FixAction | null;
}

export interface ScoreSummary {
  score: number;
  grade: string;
  total_checks: number;
  passed: number;
  failed: number;
  warnings: number;
  critical_failures: number;
}

export interface AccessibilityReport {
  session_id: string;
  filename: string;
  page_count: number;
  file_size_kb: number;
  is_scanned: boolean;
  created_at: string;
  checks: AccessibilityCheck[];
  summary: ScoreSummary;
}

export interface UploadResponse {
  session_id: string;
  filename: string;
  page_count: number;
  file_size_kb: number;
}

export interface RemediateResponse {
  session_id: string;
  changes_made: string[];
  download_url: string;
}

export interface RemediateRequest {
  approved_fix_ids: string[];
  custom_alt_texts?: Record<string, string>;
  acknowledgments?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

export interface SessionState {
  session_id: string;
  approved_fix_ids: string[];
  custom_alt_texts: Record<string, string>; // figure_index_str → alt text
  acknowledgments: Record<string, string>;  // check_id → note
  reanalysis_done: boolean;
  score_before: number | null;
  score_after: number | null;
  updated_at: string;
}

export interface PatchStateRequest {
  approved_fix_ids?: string[];
  custom_alt_texts?: Record<string, string>;
  acknowledgments?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  ai_alt_text_enabled: boolean;
}

export interface AppSettingsResponse extends AppSettings {
  has_api_key: boolean;
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export interface BatchSessionSummary {
  session_id: string;
  filename: string;
  score: number;
  grade: string;
  page_count: number;
  status: "done" | "error";
  error?: string;
}

export interface BatchManifest {
  batch_id: string;
  created_at: string;
  sessions: BatchSessionSummary[];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  session_id: string;
  filename: string;
  score: number;
  grade: string;
  page_count: number;
  file_size_kb: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// AI Alt Text & Re-analysis
// ---------------------------------------------------------------------------

export interface AltTextResponse {
  check_id: string;
  alt_texts: Record<string, string>;
}

export interface ReanalyzeResponse {
  session_id: string;
  score_before: number;
  score_after: number;
  new_report: AccessibilityReport;
}
