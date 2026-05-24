import type {
  AccessibilityReport,
  AltTextResponse,
  AppSettings,
  AppSettingsResponse,
  BatchManifest,
  BatchSessionSummary,
  BuildStructureTreeResponse,
  ElementAssignment,
  ExtractElementsResponse,
  HistoryEntry,
  PatchStateRequest,
  Project,
  ProjectListResponse,
  ProjectRevision,
  ReanalyzeResponse,
  RemediateResponse,
  SessionState,
  UploadResponse,
} from "./types";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || body.message || msg;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// PDF Upload & Report
// ---------------------------------------------------------------------------

export async function uploadPdf(file: File, url?: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url ?? "/api/upload", { method: "POST", body: form });
  return handleResponse<UploadResponse>(res);
}

export async function getReport(sessionId: string): Promise<AccessibilityReport> {
  const res = await fetch(`/api/report/${sessionId}`);
  return handleResponse<AccessibilityReport>(res);
}

export async function remediatePdf(
  sessionId: string,
  approvedFixIds: string[],
  customAltTexts?: Record<string, string>,
  acknowledgments?: Record<string, string>,
  findingValues?: Record<string, string>
): Promise<RemediateResponse> {
  const res = await fetch(`/api/remediate/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      approved_fix_ids: approvedFixIds,
      ...(customAltTexts && Object.keys(customAltTexts).length > 0 ? { custom_alt_texts: customAltTexts } : {}),
      ...(acknowledgments && Object.keys(acknowledgments).length > 0 ? { acknowledgments } : {}),
      ...(findingValues && Object.keys(findingValues).length > 0 ? { finding_values: findingValues } : {}),
    }),
  });
  return handleResponse<RemediateResponse>(res);
}

export function downloadUrl(sessionId: string): string {
  return `/api/download/${sessionId}`;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<AppSettingsResponse> {
  const res = await fetch("/api/settings");
  return handleResponse<AppSettingsResponse>(res);
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettingsResponse> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<AppSettingsResponse>(res);
}

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

export async function getSessionState(sessionId: string): Promise<SessionState> {
  const res = await fetch(`/api/session/${sessionId}/state`);
  return handleResponse<SessionState>(res);
}

export async function patchSessionState(sessionId: string, patch: PatchStateRequest): Promise<SessionState> {
  const res = await fetch(`/api/session/${sessionId}/state`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<SessionState>(res);
}

// ---------------------------------------------------------------------------
// AI Alt Text Generation
// ---------------------------------------------------------------------------

export async function generateAltText(sessionId: string, checkId: string): Promise<AltTextResponse> {
  const res = await fetch(`/api/session/${sessionId}/generate-alt-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ check_id: checkId }),
  });
  return handleResponse<AltTextResponse>(res);
}

// ---------------------------------------------------------------------------
// Re-analysis
// ---------------------------------------------------------------------------

export async function reanalyze(sessionId: string): Promise<ReanalyzeResponse> {
  const res = await fetch(`/api/session/${sessionId}/reanalyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleResponse<ReanalyzeResponse>(res);
}

// ---------------------------------------------------------------------------
// HTML Export
// ---------------------------------------------------------------------------

export function exportHtmlReportUrl(sessionId: string): string {
  return `/api/session/${sessionId}/export-html`;
}

// ---------------------------------------------------------------------------
// Batch Upload
// ---------------------------------------------------------------------------

export async function batchUpload(files: File[]): Promise<{ batch_id: string; sessions: BatchSessionSummary[] }> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch("/api/batch/upload", { method: "POST", body: form });
  return handleResponse<{ batch_id: string; sessions: BatchSessionSummary[] }>(res);
}

export async function getBatch(batchId: string): Promise<BatchManifest> {
  const res = await fetch(`/api/batch/${batchId}`);
  return handleResponse<BatchManifest>(res);
}

// ---------------------------------------------------------------------------
// Structure Tree Wizard
// ---------------------------------------------------------------------------

export async function extractElements(sessionId: string): Promise<ExtractElementsResponse> {
  const res = await fetch(`/api/session/${sessionId}/elements`);
  return handleResponse<ExtractElementsResponse>(res);
}

export async function buildStructureTree(
  sessionId: string,
  assignments: ElementAssignment[]
): Promise<BuildStructureTreeResponse> {
  const res = await fetch(`/api/session/${sessionId}/build-structure-tree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
  return handleResponse<BuildStructureTreeResponse>(res);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getProjects(params?: {
  search?: string; status?: string; assignee?: string;
  sort?: string; order?: string; limit?: number; offset?: number;
}): Promise<ProjectListResponse> {
  const q = new URLSearchParams();
  if (params?.search)   q.set("search",   params.search);
  if (params?.status)   q.set("status",   params.status);
  if (params?.assignee) q.set("assignee", params.assignee);
  if (params?.sort)     q.set("sort",     params.sort);
  if (params?.order)    q.set("order",    params.order);
  if (params?.limit != null)  q.set("limit",  String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const res = await fetch(`/api/projects?${q}`);
  return handleResponse<ProjectListResponse>(res);
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`);
  return handleResponse<Project>(res);
}

export async function createProject(body: {
  name: string; description?: string; assignee?: string; status?: string; tags?: string[];
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<Project>(res);
}

export async function patchProject(projectId: string, patch: {
  name?: string; description?: string; assignee?: string; status?: string; tags?: string[];
}): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<Project>(res);
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return handleResponse<void>(res);
}

export async function patchRevision(projectId: string, sessionId: string, patch: {
  label?: string; notes?: string;
}): Promise<ProjectRevision> {
  const res = await fetch(`/api/projects/${projectId}/revisions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<ProjectRevision>(res);
}

export async function deleteRevision(projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/revisions/${sessionId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return handleResponse<void>(res);
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function getHistory(
  limit = 50,
  offset = 0
): Promise<{ entries: HistoryEntry[]; total: number }> {
  const res = await fetch(`/api/history?limit=${limit}&offset=${offset}`);
  return handleResponse<{ entries: HistoryEntry[]; total: number }>(res);
}

export async function deleteHistory(sessionId: string): Promise<void> {
  const res = await fetch(`/api/history/${sessionId}`, { method: "DELETE" });
  return handleResponse<void>(res);
}
