import Link from "next/link";
import { ArrowLeft, Upload, FileText, Wrench, Download, RefreshCw, Tag, FolderKanban, Code2, Layers } from "lucide-react";

export const metadata = { title: "Documentation — ADA PDF Analyzer" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path, desc, children }: { method: string; path: string; desc: string; children?: React.ReactNode }) {
  const colors: Record<string, string> = {
    GET:    "bg-blue-100 text-blue-700",
    POST:   "bg-emerald-100 text-emerald-700",
    PATCH:  "bg-amber-100 text-amber-700",
    PUT:    "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return (
    <div className="mb-5 rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5 ${colors[method] ?? "bg-slate-100 text-slate-600"}`}>{method}</span>
        <code className="text-sm font-mono text-slate-700 break-all">{path}</code>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-slate-600">{desc}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

function Param({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="flex gap-2 text-sm py-1">
      <code className="text-indigo-600 font-mono w-40 flex-shrink-0">{name}</code>
      <span className="text-slate-400 w-20 flex-shrink-0">{type}</span>
      <span className="text-slate-600">{desc}</span>
    </div>
  );
}

const workflowSteps = [
  {
    icon: Upload,
    title: "Upload",
    body: "Drag a PDF onto the home page or click to browse. A project record is auto-created — or add to an existing project. Files up to 80 MB are accepted.",
  },
  {
    icon: FileText,
    title: "Report",
    body: "13 checks run against WCAG 2.1 AA, Section 508, and PDF/UA-1. Each finding shows the exact page, infringing element/text, and a specific recommended fix.",
  },
  {
    icon: Wrench,
    title: "Remediate",
    body: "Approve automated fixes. Inline editors let you supply custom values (title, language, alt text). Non-automatable issues can be acknowledged with a note.",
  },
  {
    icon: Tag,
    title: "Tag (optional)",
    body: "If the PDF lacks a structure tree, the tagging wizard lists every element per page with an auto-suggested role. Adjust assignments, then build the structure tree.",
  },
  {
    icon: Download,
    title: "Download",
    body: "Click \"Apply Fixes\" to generate the remediated PDF. All approved changes are applied in a single pass — title, language, alt text, bookmarks, structure tree.",
  },
  {
    icon: RefreshCw,
    title: "Re-analyze",
    body: "Run all 13 checks against the remediated PDF to see a before/after score comparison and confirm improvements.",
  },
];

export default function InstructionsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Documentation</h1>
      <p className="text-slate-500 mb-10 text-sm">ADA PDF Analyzer — tool reference and REST API guide</p>

      {/* ------------------------------------------------------------------ */}
      <Section title="Workflow">
        <ol className="space-y-6">
          {workflowSteps.map((s, i) => (
            <li key={i} className="flex gap-5">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center mt-0.5">
                <s.icon className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-indigo-400 tracking-widest">0{i + 1}</span>
                  <h3 className="font-semibold text-slate-900 text-sm">{s.title}</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Accessibility checks">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Check</th>
                <th className="text-left px-4 py-2.5">Standard</th>
                <th className="text-left px-4 py-2.5">Auto-fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["Document title",           "WCAG 2.4.2",  true],
                ["Document language",        "WCAG 3.1.1",  true],
                ["Tagged PDF / struct tree", "PDF/UA-1",    false],
                ["Image alternative text",   "WCAG 1.1.1",  true],
                ["Heading hierarchy",        "WCAG 1.3.1",  false],
                ["Table headers",            "WCAG 1.3.1",  false],
                ["Form field labels",        "WCAG 1.3.1",  false],
                ["Bookmarks / navigation",   "PDF/UA-1",    true],
                ["Descriptive link text",    "WCAG 2.4.4",  false],
                ["Font embedding",           "PDF/UA-1",    false],
                ["Color contrast",           "WCAG 1.4.3",  false],
                ["Logical reading order",    "WCAG 1.3.2",  false],
                ["Encryption / security",    "WCAG 4.1.1",  false],
              ].map(([check, std, fix]) => (
                <tr key={String(check)} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-700">{String(check)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{String(std)}</td>
                  <td className="px-4 py-2.5">{fix ? <span className="text-emerald-600 font-semibold">✓ Yes</span> : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Project management">
        <div className="flex gap-4 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex-shrink-0 flex items-center justify-center mt-0.5">
            <FolderKanban className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">
            <p className="mb-2">Every upload creates a <strong>Project</strong> with a unique ID. Each subsequent upload of the same document (e.g. after remediation) is stored as a new <strong>Revision</strong> — auto-labeled <code className="bg-slate-100 px-1 rounded text-xs">v1</code>, <code className="bg-slate-100 px-1 rounded text-xs">v2</code>, etc.</p>
            <p className="mb-2">Projects track <strong>assignee</strong>, <strong>description/notes</strong>, <strong>tags</strong>, and a workflow <strong>status</strong>:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {["active", "in_review", "remediated", "approved", "archived"].map(s => (
                <code key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md">{s}</code>
              ))}
            </div>
            <p className="mt-3">The project page shows a <strong>score trend sparkline</strong> across revisions so you can see improvement over iterations. Each revision links directly to its full accessibility report.</p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="REST API">
        <div className="flex items-start gap-3 mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <Code2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-indigo-800">
            <p className="font-semibold mb-1">Interactive docs</p>
            <p>Swagger UI: <code className="bg-white/70 px-1 rounded text-xs">http://localhost:8085/docs</code></p>
            <p className="mt-0.5">ReDoc: <code className="bg-white/70 px-1 rounded text-xs">http://localhost:8085/redoc</code></p>
            <p className="mt-0.5">OpenAPI JSON: <code className="bg-white/70 px-1 rounded text-xs">http://localhost:8085/openapi.json</code></p>
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Layers className="w-4 h-4" /> Core analysis</h3>

        <Endpoint method="POST" path="/api/upload" desc="Upload a single PDF (≤ 80 MB). Returns session_id and project_id.">
          <div className="space-y-1">
            <Param name="file" type="form" desc="PDF file (multipart/form-data)" />
            <Param name="project_id" type="query?" desc="Existing project UUID — appends as a new revision instead of creating a project" />
          </div>
        </Endpoint>

        <Endpoint method="GET" path="/api/report/{session_id}" desc="Run (or retrieve cached) accessibility report. Triggers analysis on first call; returns cached JSON on subsequent calls." />

        <Endpoint method="POST" path="/api/remediate/{session_id}" desc="Apply approved fixes and generate a remediated PDF.">
          <div className="space-y-1">
            <Param name="approved_fix_ids" type="string[]" desc="IDs of fixes to apply (from report.checks[].fix.id)" />
            <Param name="custom_alt_texts" type="object?" desc='Map of figure index → alt text string, e.g. {"0": "Bar chart showing..."}'  />
            <Param name="finding_values" type="object?" desc='Map of field_key → value for inline-editor fields (e.g. title, language)' />
            <Param name="acknowledgments" type="object?" desc="Map of check_id → acknowledgment note" />
          </div>
        </Endpoint>

        <Endpoint method="GET" path="/api/download/{session_id}" desc="Stream the remediated PDF as an attachment. Requires a prior successful remediation call." />
        <Endpoint method="POST" path="/api/session/{session_id}/reanalyze" desc="Re-run all 13 checks against the remediated PDF. Returns score_before and score_after for comparison." />
        <Endpoint method="GET" path="/api/session/{session_id}/export-html" desc="Download the full accessibility report as a standalone HTML file." />

        <h3 className="text-sm font-bold text-slate-700 mt-8 mb-3 flex items-center gap-2"><FolderKanban className="w-4 h-4" /> Projects</h3>

        <Endpoint method="GET" path="/api/projects" desc="List all projects. Supports filtering, sorting, and pagination.">
          <div className="space-y-1">
            <Param name="search" type="query?" desc="Full-text search against name and description" />
            <Param name="status" type="query?" desc="Filter by status: active | in_review | remediated | approved | archived" />
            <Param name="assignee" type="query?" desc="Filter by assignee string (substring match)" />
            <Param name="sort" type="query?" desc="Sort field: updated_at (default) | created_at | name" />
            <Param name="order" type="query?" desc="asc or desc (default: desc)" />
            <Param name="limit" type="query?" desc="Page size, 1–200 (default: 50)" />
            <Param name="offset" type="query?" desc="Pagination offset (default: 0)" />
          </div>
        </Endpoint>

        <Endpoint method="POST" path="/api/projects" desc="Create a new project (HTTP 201). Returns the full Project object.">
          <div className="space-y-1">
            <Param name="name" type="string" desc="Project name (required)" />
            <Param name="description" type="string?" desc="Free-text description" />
            <Param name="assignee" type="string?" desc="Assignee name or email" />
            <Param name="status" type="string?" desc="Initial status (default: active)" />
            <Param name="tags" type="string[]?" desc="Arbitrary tags" />
          </div>
        </Endpoint>

        <Endpoint method="GET"    path="/api/projects/{project_id}"             desc="Get full project including all revision history." />
        <Endpoint method="PATCH"  path="/api/projects/{project_id}"             desc="Partially update any project fields (name, description, assignee, status, tags)." />
        <Endpoint method="PUT"    path="/api/projects/{project_id}"             desc="Replace all project metadata fields (full update)." />
        <Endpoint method="DELETE" path="/api/projects/{project_id}"             desc="Delete a project (HTTP 204). Revisions are removed from the project record; uploaded PDFs are not deleted." />

        <Endpoint method="GET"    path="/api/projects/{project_id}/revisions"              desc="List all revisions for a project, ordered by creation time." />
        <Endpoint method="GET"    path="/api/projects/{project_id}/revisions/{session_id}" desc="Get a single revision record." />
        <Endpoint method="PATCH"  path="/api/projects/{project_id}/revisions/{session_id}" desc="Update revision label and/or notes.">
          <div className="space-y-1">
            <Param name="label" type="string?" desc='Custom label, e.g. "v3-client-review"' />
            <Param name="notes" type="string?" desc="Free-text notes for this revision" />
          </div>
        </Endpoint>
        <Endpoint method="DELETE" path="/api/projects/{project_id}/revisions/{session_id}" desc="Remove a revision from the project (HTTP 204). Does not delete the underlying session or report." />

        <h3 className="text-sm font-bold text-slate-700 mt-8 mb-3">Batch upload</h3>
        <Endpoint method="POST" path="/api/batch/upload" desc="Upload 1–10 PDFs in one request. Each file is analyzed immediately. Returns batch_id and per-file results.">
          <Param name="files" type="form" desc="PDF files (multipart/form-data, field name: files)" />
        </Endpoint>
        <Endpoint method="GET" path="/api/batch/{batch_id}" desc="Retrieve batch results including per-file scores, grades, and error messages." />

        <h3 className="text-sm font-bold text-slate-700 mt-8 mb-3">Structure tree tagging</h3>
        <Endpoint method="GET"  path="/api/session/{session_id}/elements"             desc="Extract all text blocks and images per page with auto-suggested semantic roles." />
        <Endpoint method="POST" path="/api/session/{session_id}/build-structure-tree" desc="Inject a /StructTreeRoot into the PDF based on user-confirmed role assignments.">
          <Param name="assignments" type="object[]" desc='Array of { element_id, role, alt_text? } — role is one of: H1–H6, P, Figure, Table, L, Span, Artifact' />
        </Endpoint>

        <h3 className="text-sm font-bold text-slate-700 mt-8 mb-3">Miscellaneous</h3>
        <Endpoint method="GET"   path="/api/history"                      desc="Global analysis history log (all sessions, paginated)." />
        <Endpoint method="DELETE" path="/api/history/{session_id}"        desc="Remove a session from the history log (HTTP 200). Does not delete the report." />
        <Endpoint method="GET"   path="/api/session/{session_id}/state"   desc="Retrieve per-session UI state: approved fixes, alt texts, acknowledgments, finding values." />
        <Endpoint method="PATCH" path="/api/session/{session_id}/state"   desc="Partially update session state." />
        <Endpoint method="POST"  path="/api/session/{session_id}/generate-alt-text" desc="Use Claude Vision to generate alt text for images. Requires ANTHROPIC_API_KEY." />
        <Endpoint method="GET"   path="/api/settings"                     desc="Get application settings (ai_alt_text_enabled, has_api_key)." />
        <Endpoint method="PATCH" path="/api/settings"                     desc='Update settings. Body: { "ai_alt_text_enabled": true }' />
        <Endpoint method="GET"   path="/health"                           desc="Returns { status: ok }. Use for container health checks." />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Environment variables">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Variable</th>
                <th className="text-left px-4 py-2.5">Default</th>
                <th className="text-left px-4 py-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {[
                ["ANTHROPIC_API_KEY", "—",       "Enable AI alt text generation (Claude Vision)"],
                ["MAX_UPLOAD_MB",     "80",       "Upload size limit in megabytes"],
                ["STORAGE_DIR",       "./storage","Path for uploads, reports, and project data"],
                ["BACKEND_URL",       "http://backend:8000", "Backend URL used by Next.js server-side proxy"],
              ].map(([k, d, desc]) => (
                <tr key={k}>
                  <td className="px-4 py-2.5 font-mono text-indigo-600 text-xs">{k}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{d}</td>
                  <td className="px-4 py-2.5">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Limitations">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Color contrast analysis is heuristic — it flags light-colored text but cannot compute actual contrast ratios without background color data. Manual verification is required.</span></li>
          <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Structure tree injection (tagging wizard) writes a <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code> but does not add MCID markers to the content stream. Automated checkers (PAC, Acrobat) will pass; real assistive technology navigation may still be limited.</span></li>
          <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Storage is file-based JSON — no external database. Not designed for concurrent multi-user production workloads without a shared filesystem.</span></li>
          <li className="flex gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Automated fixes improve compliance but are not a substitute for expert manual review. Always test remediated PDFs with real assistive technology before publishing.</span></li>
        </ul>
      </Section>

      <div className="mt-4 text-center">
        <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
          <Upload className="w-4 h-4" /> Upload a PDF
        </Link>
      </div>
    </div>
  );
}
