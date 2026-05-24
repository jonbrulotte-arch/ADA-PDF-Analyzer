import type { AccessibilityReport, RemediateResponse, UploadResponse } from "./types";

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

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return handleResponse<UploadResponse>(res);
}

export async function getReport(sessionId: string): Promise<AccessibilityReport> {
  const res = await fetch(`/api/report/${sessionId}`);
  return handleResponse<AccessibilityReport>(res);
}

export async function remediatePdf(sessionId: string, approvedFixIds: string[]): Promise<RemediateResponse> {
  const res = await fetch(`/api/remediate/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved_fix_ids: approvedFixIds }),
  });
  return handleResponse<RemediateResponse>(res);
}

export function downloadUrl(sessionId: string): string {
  return `/api/download/${sessionId}`;
}
