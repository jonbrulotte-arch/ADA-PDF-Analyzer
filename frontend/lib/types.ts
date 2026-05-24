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
