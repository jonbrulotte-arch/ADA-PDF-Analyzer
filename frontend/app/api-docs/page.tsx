import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "API Reference — ADA PDF Analyzer" };

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-slate-900 mt-12 mb-4 pb-2 border-b border-slate-200 scroll-mt-6">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}

const METHOD_COLOR: Record<string, string> = {
  GET:    "bg-blue-100 text-blue-700",
  POST:   "bg-emerald-100 text-emerald-700",
  PATCH:  "bg-amber-100 text-amber-700",
  PUT:    "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

function Endpoint({
  method, path, summary, description, params, requestBody, response, responseSample,
}: {
  method: string; path: string; summary: string;
  description?: string;
  params?: { name: string; in: string; type: string; required?: boolean; desc: string }[];
  requestBody?: string;
  response: string;
  responseSample: string;
}) {
  return (
    <div className="mb-10 rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${METHOD_COLOR[method] ?? "bg-slate-100 text-slate-600"}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-slate-700 break-all flex-1">{path}</code>
        <span className="text-xs text-slate-500 hidden sm:block">{summary}</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {description && <p className="text-sm text-slate-600">{description}</p>}

        {/* Parameters */}
        {params && params.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Parameters</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              {params.map(p => (
                <div key={p.name} className="flex flex-wrap gap-x-4 gap-y-0.5 px-3 py-2 text-xs">
                  <code className="text-indigo-600 font-mono font-medium w-36 flex-shrink-0">{p.name}</code>
                  <span className="text-slate-400 w-16 flex-shrink-0">{p.in}</span>
                  <span className="text-slate-400 w-16 flex-shrink-0">{p.type}{p.required ? " *" : ""}</span>
                  <span className="text-slate-600 flex-1">{p.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">* required</p>
          </div>
        )}

        {/* Request body */}
        {requestBody && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Request body</p>
            <pre className="bg-slate-900 text-emerald-300 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre">
              {requestBody}
            </pre>
          </div>
        )}

        {/* Response */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Response — {response}</p>
          <pre className="bg-slate-900 text-sky-300 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre">
            {responseSample}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-3xl font-extrabold text-slate-900 mb-1">API Reference</h1>
      <p className="text-slate-500 mb-4 text-sm">
        All endpoints return JSON. No authentication required. Base URL: <code className="bg-slate-100 px-1 rounded text-xs">http://localhost:8085</code>
      </p>

      <div className="flex flex-wrap gap-2 mb-10 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-indigo-800">
        <span className="font-semibold">Interactive docs:</span>
        <span>Swagger UI → <code className="bg-white/70 px-1 rounded text-xs">http://localhost:8085/docs</code></span>
        <span className="text-indigo-300">·</span>
        <span>ReDoc → <code className="bg-white/70 px-1 rounded text-xs">http://localhost:8085/redoc</code></span>
      </div>

      <nav className="text-xs text-indigo-600 space-x-3 mb-10 flex flex-wrap gap-y-1">
        {["upload","report","remediate","projects","revisions","batch","history","session","settings","health"].map(s => (
          <a key={s} href={`#${s}`} className="hover:underline capitalize">{s}</a>
        ))}
      </nav>

      {/* ── Upload ────────────────────────────────────────────────────────── */}
      <H2 id="upload">Upload</H2>

      <Endpoint
        method="POST"
        path="/api/upload"
        summary="Upload a PDF"
        description="Upload a single PDF (≤ 80 MB). A project record is auto-created, or the file is appended to an existing project as a new revision. Analysis does NOT run at upload time — call GET /api/report/{session_id} to trigger it."
        params={[
          { name: "file", in: "form", type: "File", required: true, desc: "PDF file (multipart/form-data)" },
          { name: "project_id", in: "query", type: "string", desc: "Existing project UUID — appends as new revision instead of creating a project" },
        ]}
        response="200 UploadResponse"
        responseSample={`{
  "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
  "project_id": "d1e2f3a4-5b6c-7d8e-9f0a-abcdef123456",
  "filename": "annual-report-2024.pdf",
  "page_count": 18,
  "file_size_kb": 1240
}`}
      />

      {/* ── Report ────────────────────────────────────────────────────────── */}
      <H2 id="report">Report</H2>

      <Endpoint
        method="GET"
        path="/api/report/{session_id}"
        summary="Run / retrieve accessibility report"
        description="Triggers analysis on first call (runs all 13 checks); returns cached JSON on subsequent calls. Also updates the linked project revision score/grade and appends to the global history log."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "UUID returned by POST /api/upload" },
        ]}
        response="200 AccessibilityReport"
        responseSample={`{
  "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
  "filename": "annual-report-2024.pdf",
  "page_count": 18,
  "file_size_kb": 1240,
  "is_scanned": false,
  "created_at": "2024-05-15T14:22:10Z",
  "summary": {
    "score": 58,
    "grade": "C",
    "total_checks": 13,
    "passed": 5,
    "failed": 6,
    "warnings": 2,
    "critical_failures": 3
  },
  "checks": [
    {
      "id": "check_document_title",
      "category": "metadata",
      "name": "Document Title",
      "wcag_criterion": "2.4.2",
      "pdf_ua_criterion": null,
      "status": "fail",
      "severity": "major",
      "description": "The PDF has no document title set in its metadata.",
      "details": ["Set a descriptive title via File > Properties in your PDF editor."],
      "fix": {
        "id": "fix_metadata_title",
        "description": "Set document title in PDF metadata",
        "auto_fixable": true,
        "fix_type": "metadata_title",
        "fix_data": {}
      },
      "findings": [
        {
          "id": "finding_title_0",
          "page": null,
          "element_type": "document",
          "element_label": "Document",
          "infringing_text": "Missing /Title in Info dictionary",
          "recommended_fix": "Set a descriptive title that identifies this document.",
          "editor": "text",
          "field_key": "doc_title",
          "placeholder": "e.g. Annual Report 2024 — Acme Corp"
        }
      ]
    },
    {
      "id": "check_color_contrast",
      "category": "visual",
      "name": "Color Contrast",
      "wcag_criterion": "1.4.3",
      "pdf_ua_criterion": null,
      "status": "fail",
      "severity": "critical",
      "description": "1 text span may have insufficient contrast against a white background.",
      "details": ["Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (18pt+)."],
      "fix": null,
      "findings": [
        {
          "id": "finding_contrast_0",
          "page": 3,
          "element_type": "text",
          "element_label": "\\"Q2 performance overview\\"",
          "infringing_text": "Color #CCCCCC — luminance 204/255 (high = light)",
          "recommended_fix": "Check contrast against background — minimum 4.5:1 for normal text.",
          "editor": "none",
          "field_key": null,
          "placeholder": null
        }
      ]
    }
  ]
}`}
      />

      <Endpoint
        method="GET"
        path="/api/session/{session_id}/export-html"
        summary="Export report as HTML"
        description="Returns a self-contained HTML file attachment with the full accessibility report. Suitable for sharing with stakeholders."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="200 text/html (attachment)"
        responseSample={`<!-- Content-Disposition: attachment; filename="accessibility-report-a3f9c2e1.html" -->
<!-- Full standalone HTML file with embedded styles -->`}
      />

      {/* ── Remediate ─────────────────────────────────────────────────────── */}
      <H2 id="remediate">Remediate &amp; Download</H2>

      <Endpoint
        method="POST"
        path="/api/remediate/{session_id}"
        summary="Apply fixes and generate remediated PDF"
        description="Applies approved fixes in a single pikepdf pass and writes a remediated PDF to storage. Returns the list of changes made."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        requestBody={`{
  "approved_fix_ids": [
    "fix_metadata_title",
    "fix_metadata_language",
    "fix_alt_text",
    "fix_bookmarks"
  ],
  "finding_values": {
    "doc_title": "Annual Report 2024 — Acme Corp",
    "doc_language": "en-US"
  },
  "custom_alt_texts": {
    "0": "Bar chart showing Q2 revenue by region",
    "1": "Photo of the executive leadership team"
  },
  "acknowledgments": {
    "check_reading_order": "Verified in Acrobat Pro — reading order matches visual layout"
  }
}`}
        response="200 RemediateResponse"
        responseSample={`{
  "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
  "changes_made": [
    "Set document title: Annual Report 2024 — Acme Corp",
    "Set document language: en-US",
    "Added alt text for 2 image(s)",
    "Added bookmark tree (18 entries from headings)"
  ],
  "download_url": "/api/download/a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab"
}`}
      />

      <Endpoint
        method="GET"
        path="/api/download/{session_id}"
        summary="Download remediated PDF"
        description="Streams the remediated PDF as an attachment. Requires a prior successful remediation call."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="200 application/pdf (attachment)"
        responseSample={`Content-Disposition: attachment; filename="annual-report-2024-accessible.pdf"
Content-Type: application/pdf

<binary PDF data>`}
      />

      <Endpoint
        method="POST"
        path="/api/session/{session_id}/reanalyze"
        summary="Re-analyze the remediated PDF"
        description="Runs all 13 checks against the remediated PDF. Returns before/after score comparison. Requires a prior successful remediation."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="200 ReanalyzeResponse"
        responseSample={`{
  "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
  "score_before": 58,
  "score_after": 83,
  "new_report": {
    "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
    "filename": "annual-report-2024.pdf",
    "summary": { "score": 83, "grade": "B", "passed": 9, "failed": 2, "warnings": 2 }
  }
}`}
      />

      {/* ── Projects ──────────────────────────────────────────────────────── */}
      <H2 id="projects">Projects</H2>
      <P>Projects group multiple revisions of the same document. Every upload auto-creates one.</P>

      <Endpoint
        method="GET"
        path="/api/projects"
        summary="List projects"
        params={[
          { name: "search",   in: "query", type: "string",  desc: "Full-text search on name and description" },
          { name: "status",   in: "query", type: "string",  desc: "active | in_review | remediated | approved | archived" },
          { name: "assignee", in: "query", type: "string",  desc: "Substring match on assignee field" },
          { name: "sort",     in: "query", type: "string",  desc: "updated_at (default) | created_at | name" },
          { name: "order",    in: "query", type: "string",  desc: "desc (default) | asc" },
          { name: "limit",    in: "query", type: "integer", desc: "Page size, 1–200 (default: 50)" },
          { name: "offset",   in: "query", type: "integer", desc: "Pagination offset (default: 0)" },
        ]}
        response="200 ProjectListResponse"
        responseSample={`{
  "total": 42,
  "projects": [
    {
      "project_id": "d1e2f3a4-5b6c-7d8e-9f0a-abcdef123456",
      "name": "Annual Report 2024",
      "assignee": "jane.doe@example.com",
      "status": "in_review",
      "tags": ["annual-report", "priority"],
      "latest_score": 83,
      "latest_grade": "B",
      "revision_count": 2,
      "created_at": "2024-05-10T09:00:00Z",
      "updated_at": "2024-05-15T14:22:10Z"
    }
  ]
}`}
      />

      <Endpoint
        method="POST"
        path="/api/projects"
        summary="Create a project"
        requestBody={`{
  "name": "Q3 Investor Deck",
  "description": "Quarterly investor relations PDF — must meet Section 508",
  "assignee": "john.smith@example.com",
  "status": "active",
  "tags": ["investor-relations", "q3-2024"]
}`}
        response="201 Project"
        responseSample={`{
  "project_id": "e5f6a7b8-c9d0-1e2f-3a4b-567890abcdef",
  "name": "Q3 Investor Deck",
  "description": "Quarterly investor relations PDF — must meet Section 508",
  "assignee": "john.smith@example.com",
  "status": "active",
  "tags": ["investor-relations", "q3-2024"],
  "created_at": "2024-05-20T11:30:00Z",
  "updated_at": "2024-05-20T11:30:00Z",
  "revisions": []
}`}
      />

      <Endpoint
        method="GET"
        path="/api/projects/{project_id}"
        summary="Get project with full revision history"
        params={[
          { name: "project_id", in: "path", type: "string", required: true, desc: "Project UUID" },
        ]}
        response="200 Project"
        responseSample={`{
  "project_id": "d1e2f3a4-5b6c-7d8e-9f0a-abcdef123456",
  "name": "Annual Report 2024",
  "description": "Accessibility review for board approval",
  "assignee": "jane.doe@example.com",
  "status": "in_review",
  "tags": ["annual-report", "priority"],
  "created_at": "2024-05-10T09:00:00Z",
  "updated_at": "2024-05-15T14:22:10Z",
  "revisions": [
    {
      "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
      "filename": "annual-report-2024.pdf",
      "label": "v1",
      "score": 58,
      "grade": "C",
      "page_count": 18,
      "file_size_kb": 1240,
      "created_at": "2024-05-10T09:00:00Z",
      "notes": ""
    },
    {
      "session_id": "b4e0d3f2-8c5e-5f3b-a097-2345678901bc",
      "filename": "annual-report-2024-v2.pdf",
      "label": "v2",
      "score": 83,
      "grade": "B",
      "page_count": 18,
      "file_size_kb": 1195,
      "created_at": "2024-05-15T14:00:00Z",
      "notes": "Applied title, language, alt text, and bookmark fixes"
    }
  ]
}`}
      />

      <Endpoint
        method="PATCH"
        path="/api/projects/{project_id}"
        summary="Partially update project metadata"
        params={[
          { name: "project_id", in: "path", type: "string", required: true, desc: "Project UUID" },
        ]}
        requestBody={`{
  "status": "remediated",
  "assignee": "jane.doe@example.com",
  "tags": ["annual-report", "priority", "remediated-2024-05"]
}`}
        response="200 Project"
        responseSample={`{
  "project_id": "d1e2f3a4-5b6c-7d8e-9f0a-abcdef123456",
  "name": "Annual Report 2024",
  "status": "remediated",
  "assignee": "jane.doe@example.com",
  "tags": ["annual-report", "priority", "remediated-2024-05"],
  "updated_at": "2024-05-16T08:00:00Z",
  "revisions": [ "..." ]
}`}
      />

      <Endpoint
        method="DELETE"
        path="/api/projects/{project_id}"
        summary="Delete a project"
        description="Removes the project record. The underlying session files (uploads, reports, remediated PDFs) are NOT deleted. Returns 204 No Content."
        params={[
          { name: "project_id", in: "path", type: "string", required: true, desc: "Project UUID" },
        ]}
        response="204 No Content"
        responseSample={`(empty body)`}
      />

      {/* ── Revisions ─────────────────────────────────────────────────────── */}
      <H2 id="revisions">Revisions</H2>

      <Endpoint
        method="PATCH"
        path="/api/projects/{project_id}/revisions/{session_id}"
        summary="Update revision label or notes"
        params={[
          { name: "project_id", in: "path", type: "string", required: true, desc: "Project UUID" },
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID of the revision" },
        ]}
        requestBody={`{
  "label": "v2-client-review",
  "notes": "Sent to legal for review on 2024-05-16. Awaiting sign-off."
}`}
        response="200 ProjectRevision"
        responseSample={`{
  "session_id": "b4e0d3f2-8c5e-5f3b-a097-2345678901bc",
  "filename": "annual-report-2024-v2.pdf",
  "label": "v2-client-review",
  "score": 83,
  "grade": "B",
  "page_count": 18,
  "file_size_kb": 1195,
  "created_at": "2024-05-15T14:00:00Z",
  "notes": "Sent to legal for review on 2024-05-16. Awaiting sign-off."
}`}
      />

      <Endpoint
        method="DELETE"
        path="/api/projects/{project_id}/revisions/{session_id}"
        summary="Remove a revision from a project"
        description="Unlinks the session from the project. The session report and uploaded PDF are NOT deleted. Returns 204 No Content."
        params={[
          { name: "project_id", in: "path", type: "string", required: true, desc: "Project UUID" },
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="204 No Content"
        responseSample={`(empty body)`}
      />

      {/* ── Batch ─────────────────────────────────────────────────────────── */}
      <H2 id="batch">Batch upload</H2>

      <Endpoint
        method="POST"
        path="/api/batch/upload"
        summary="Upload and analyze up to 10 PDFs"
        description="Each file is analyzed immediately during the request. Returns a batch_id and per-file results. Large batches may take 30–60 seconds."
        params={[
          { name: "files", in: "form", type: "File[]", required: true, desc: "PDF files (field name: files, multipart/form-data)" },
        ]}
        response="200 BatchUploadResponse"
        responseSample={`{
  "batch_id": "f7a8b9c0-d1e2-f3a4-b5c6-d7e8f9a0b1c2",
  "sessions": [
    {
      "session_id": "c5d6e7f8-a9b0-c1d2-e3f4-567890abcdef",
      "filename": "policy-manual.pdf",
      "score": 71,
      "grade": "C",
      "page_count": 42,
      "status": "done"
    },
    {
      "session_id": "d6e7f8a9-b0c1-d2e3-f4a5-678901bcdef0",
      "filename": "employee-handbook.pdf",
      "score": 0,
      "grade": "F",
      "page_count": 0,
      "status": "error",
      "error": "File exceeds 80 MB limit."
    }
  ]
}`}
      />

      <Endpoint
        method="GET"
        path="/api/batch/{batch_id}"
        summary="Get batch results"
        params={[
          { name: "batch_id", in: "path", type: "string", required: true, desc: "Batch UUID returned by POST /api/batch/upload" },
        ]}
        response="200 BatchManifest"
        responseSample={`{
  "batch_id": "f7a8b9c0-d1e2-f3a4-b5c6-d7e8f9a0b1c2",
  "created_at": "2024-05-20T10:00:00Z",
  "sessions": [
    {
      "session_id": "c5d6e7f8-a9b0-c1d2-e3f4-567890abcdef",
      "filename": "policy-manual.pdf",
      "score": 71,
      "grade": "C",
      "page_count": 42,
      "status": "done"
    }
  ]
}`}
      />

      {/* ── History ───────────────────────────────────────────────────────── */}
      <H2 id="history">History</H2>

      <Endpoint
        method="GET"
        path="/api/history"
        summary="List analysis history (all sessions)"
        params={[
          { name: "limit",  in: "query", type: "integer", desc: "Page size, 1–500 (default: 50)" },
          { name: "offset", in: "query", type: "integer", desc: "Pagination offset (default: 0)" },
        ]}
        response="200"
        responseSample={`{
  "total": 124,
  "entries": [
    {
      "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
      "filename": "annual-report-2024.pdf",
      "score": 58,
      "grade": "C",
      "page_count": 18,
      "file_size_kb": 1240,
      "created_at": "2024-05-15T14:22:10Z"
    }
  ]
}`}
      />

      <Endpoint
        method="DELETE"
        path="/api/history/{session_id}"
        summary="Remove a session from history"
        description="Removes the entry from the history log. The session report and uploaded PDF are NOT deleted."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="200"
        responseSample={`{
  "deleted": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab"
}`}
      />

      {/* ── Session ───────────────────────────────────────────────────────── */}
      <H2 id="session">Session state &amp; AI</H2>

      <Endpoint
        method="GET"
        path="/api/session/{session_id}/state"
        summary="Get session UI state"
        description="Per-session state stores approved fix IDs, custom alt texts, acknowledgments, and finding values across page reloads."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        response="200 SessionState"
        responseSample={`{
  "session_id": "a3f9c2e1-7b4d-4e2a-9f8c-1234567890ab",
  "approved_fix_ids": ["fix_metadata_title", "fix_metadata_language"],
  "custom_alt_texts": {
    "0": "Bar chart showing Q2 revenue by region",
    "1": "Photo of the executive leadership team"
  },
  "acknowledgments": {
    "check_reading_order": "Verified in Acrobat Pro — reading order matches visual layout"
  },
  "finding_values": {
    "doc_title": "Annual Report 2024 — Acme Corp",
    "doc_language": "en-US"
  },
  "reanalysis_done": true,
  "score_before": 58,
  "score_after": 83,
  "updated_at": "2024-05-15T15:00:00Z"
}`}
      />

      <Endpoint
        method="POST"
        path="/api/session/{session_id}/generate-alt-text"
        summary="AI-generate alt text for images"
        description="Uses Claude Vision (claude-haiku-4-5-20251001) to describe images in the PDF. Requires ANTHROPIC_API_KEY set on the server and AI alt text enabled in settings."
        params={[
          { name: "session_id", in: "path", type: "string", required: true, desc: "Session UUID" },
        ]}
        requestBody={`{
  "check_id": "check_alt_text"
}`}
        response="200 AltTextResponse"
        responseSample={`{
  "check_id": "check_alt_text",
  "alt_texts": {
    "0": "Bar chart showing Q2 2024 revenue by region: North America $4.2M, Europe $2.8M, Asia-Pacific $1.9M",
    "1": "Group photograph of five executives standing in front of a glass office building"
  }
}`}
      />

      {/* ── Settings ──────────────────────────────────────────────────────── */}
      <H2 id="settings">Settings</H2>

      <Endpoint
        method="GET"
        path="/api/settings"
        summary="Get application settings"
        response="200 AppSettingsResponse"
        responseSample={`{
  "ai_alt_text_enabled": true,
  "has_api_key": true
}`}
      />

      <Endpoint
        method="PATCH"
        path="/api/settings"
        summary="Update application settings"
        requestBody={`{
  "ai_alt_text_enabled": false
}`}
        response="200 AppSettingsResponse"
        responseSample={`{
  "ai_alt_text_enabled": false,
  "has_api_key": true
}`}
      />

      {/* ── Health ────────────────────────────────────────────────────────── */}
      <H2 id="health">Health</H2>

      <Endpoint
        method="GET"
        path="/health"
        summary="Health check"
        description="Use for container health checks and uptime monitoring."
        response="200"
        responseSample={`{
  "status": "ok"
}`}
      />

      <div className="mt-12 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
        <p className="font-semibold text-slate-700 mb-1">Error responses</p>
        <p>All errors return standard HTTP status codes with a JSON body: <code className="bg-white px-1 rounded border border-slate-200">{`{ "detail": "Error message here" }`}</code></p>
        <p className="mt-1">Common codes: <code className="bg-white px-1 rounded border border-slate-200">400</code> bad request · <code className="bg-white px-1 rounded border border-slate-200">404</code> not found · <code className="bg-white px-1 rounded border border-slate-200">413</code> file too large · <code className="bg-white px-1 rounded border border-slate-200">422</code> invalid PDF · <code className="bg-white px-1 rounded border border-slate-200">500</code> server error</p>
      </div>
    </div>
  );
}
