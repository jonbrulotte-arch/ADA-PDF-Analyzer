"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getProject, patchProject, patchRevision, deleteRevision, uploadPdf } from "@/lib/api";
import type { Project, ProjectRevision, ProjectStatus } from "@/lib/types";
import {
  ArrowLeft, FileText, Upload, Loader2, XCircle, CheckCircle2,
  ChevronRight, Trash2, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

function cx(...c: (string | false | undefined | null)[]): string { return c.filter(Boolean).join(" "); }

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",     label: "Active" },
  { value: "in_review",  label: "In Review" },
  { value: "remediated", label: "Remediated" },
  { value: "approved",   label: "Approved" },
  { value: "archived",   label: "Archived" },
];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active:     "bg-blue-100 text-blue-700 border-blue-200",
  in_review:  "bg-amber-100 text-amber-700 border-amber-200",
  remediated: "bg-indigo-100 text-indigo-700 border-indigo-200",
  approved:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  archived:   "bg-slate-100 text-slate-500 border-slate-200",
};

function scoreColor(s: number) {
  return s >= 75 ? "text-emerald-600" : s >= 50 ? "text-amber-500" : "text-red-500";
}

function gradeBadge(g: string) {
  const f = g[0]?.toUpperCase();
  if (f === "A") return "bg-emerald-100 text-emerald-700";
  if (f === "B") return "bg-blue-100 text-blue-700";
  if (f === "C") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24); if (day < 30) return `${day}d ago`;
  return new Date(d).toLocaleDateString();
}

function ScoreTrend({ revisions }: { revisions: ProjectRevision[] }) {
  if (revisions.length < 2) return null;
  const ordered = [...revisions].reverse(); // oldest first
  const scores = ordered.map(r => r.score);
  const max = Math.max(...scores, 100);
  const w = 8; const gap = 4;
  const totalW = scores.length * w + (scores.length - 1) * gap;

  return (
    <div className="flex items-end gap-1" style={{ width: totalW, height: 32 }} title="Score trend across revisions">
      {scores.map((s, i) => (
        <div key={i} className={cx("rounded-sm flex-shrink-0", s >= 75 ? "bg-emerald-400" : s >= 50 ? "bg-amber-400" : "bg-red-400")}
          style={{ width: w, height: Math.max(4, (s / max) * 32) }} />
      ))}
    </div>
  );
}

function TrendIcon({ revisions }: { revisions: ProjectRevision[] }) {
  if (revisions.length < 2) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  const latest = revisions[0].score;
  const prev = revisions[1].score;
  if (latest > prev) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (latest < prev) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");

  // Upload new revision
  const revInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inline revision editing
  const [editingRevision, setEditingRevision] = useState<string | null>(null);
  const [revLabel, setRevLabel] = useState("");
  const [revNotes, setRevNotes] = useState("");

  const savedRef = useRef(false);

  useEffect(() => {
    getProject(id)
      .then((p) => {
        setProject(p);
        setName(p.name);
        setAssignee(p.assignee);
        setDescription(p.description);
        setStatus(p.status);
        setLoading(false);
        setTimeout(() => { savedRef.current = true; }, 100);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [id]);

  // Debounced save for metadata
  useEffect(() => {
    if (!savedRef.current || !project) return;
    const t = setTimeout(() => {
      patchProject(id, { name, assignee, description, status }).then(setProject).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [id, name, assignee, description, status, project]);

  const handleUploadRevision = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const resp = await uploadPdf(file, `/api/upload?project_id=${encodeURIComponent(id)}`);
      const updated = await getProject(id);
      setProject(updated);
      router.push(`/report/${resp.session_id}`);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [id, router]);

  const handleDeleteRevision = useCallback(async (sessionId: string) => {
    if (!confirm("Remove this revision from the project?")) return;
    await deleteRevision(id, sessionId).catch(() => {});
    setProject((p) => p ? { ...p, revisions: p.revisions.filter(r => r.session_id !== sessionId) } : p);
  }, [id]);

  const handleSaveRevision = useCallback(async (sessionId: string) => {
    const rev = await patchRevision(id, sessionId, { label: revLabel, notes: revNotes }).catch(() => null);
    if (rev) {
      setProject((p) => p ? { ...p, revisions: p.revisions.map(r => r.session_id === sessionId ? rev : r) } : p);
    }
    setEditingRevision(null);
  }, [id, revLabel, revNotes]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error || !project) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-slate-600">{error ?? "Project not found."}</p>
      <button onClick={() => router.push("/history")} className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>
    </div>
  );

  const latestScore = project.revisions[0]?.score;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back */}
      <Link href="/history" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Projects
      </Link>

      {/* Project header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Score circle */}
          {latestScore != null && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="44" cy="44" r="36" fill="none"
                    stroke={latestScore >= 75 ? "#10b981" : latestScore >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 36}
                    strokeDashoffset={2 * Math.PI * 36 * (1 - latestScore / 100)}
                    strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cx("text-xl font-extrabold", scoreColor(latestScore))}>{latestScore}</span>
                  <span className="text-xs text-slate-400 -mt-0.5">/ 100</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon revisions={project.revisions} />
                <ScoreTrend revisions={project.revisions} />
              </div>
            </div>
          )}

          {/* Editable metadata */}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xl font-bold text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none px-0 py-0.5 flex-1 min-w-0 transition-colors"
                placeholder="Project name"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className={cx("text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors", STATUS_STYLES[status])}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium w-16">Assignee</span>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Unassigned"
                className="text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none flex-1 py-0.5 transition-colors"
              />
            </div>

            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-400 font-medium w-16 mt-1.5">Notes</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Project description or notes…"
                className="text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none flex-1 resize-none py-0.5 transition-colors"
              />
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{project.revisions.length} revision{project.revisions.length !== 1 ? "s" : ""}</span>
              <span>Created {timeAgo(project.created_at)}</span>
              <span>Updated {timeAgo(project.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revisions section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Revision History</h2>
          <div>
            <input ref={revInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadRevision(f); e.target.value = ""; }} />
            <button
              onClick={() => revInputRef.current?.click()}
              disabled={uploading}
              className={cx(
                "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                uploading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Upload className="w-3.5 h-3.5" /> Upload New Revision</>}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mb-3 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {uploadError}
          </div>
        )}

        {project.revisions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No revisions yet — upload a PDF above to get started.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[120px_1fr_80px_64px_60px_120px_80px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
              {["Label", "Filename", "Score", "Grade", "Pages", "Date", ""].map((h) => (
                <span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-slate-100">
              {project.revisions.map((rev, i) => (
                <div key={rev.session_id} className="group">
                  {editingRevision === rev.session_id ? (
                    <div className="px-5 py-4 space-y-3 bg-indigo-50/40">
                      <div className="flex gap-3">
                        <input value={revLabel} onChange={(e) => setRevLabel(e.target.value)}
                          placeholder="Revision label (e.g. v1, After OCR)"
                          className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                      </div>
                      <textarea value={revNotes} onChange={(e) => setRevNotes(e.target.value)}
                        rows={2} placeholder="Notes about this revision…"
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveRevision(rev.session_id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingRevision(null)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden sm:grid grid-cols-[120px_1fr_80px_64px_60px_120px_80px] gap-3 px-5 py-3.5 items-center">
                      <div>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {rev.label || `v${project.revisions.length - i}`}
                        </span>
                      </div>
                      <div className="min-w-0 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{rev.filename}</span>
                        {rev.notes && <span className="text-xs text-slate-400 truncate max-w-[120px]" title={rev.notes}>{rev.notes}</span>}
                      </div>
                      <div>
                        <span className={cx("text-sm font-bold", scoreColor(rev.score))}>{rev.score || "—"}</span>
                      </div>
                      <div>
                        {rev.grade && rev.grade !== "?" && (
                          <span className={cx("text-xs font-semibold px-2 py-0.5 rounded-full", gradeBadge(rev.grade))}>{rev.grade}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-sm text-slate-500">{rev.page_count || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400">{timeAgo(rev.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/report/${rev.session_id}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Open report">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        <button onClick={() => { setEditingRevision(rev.session_id); setRevLabel(rev.label); setRevNotes(rev.notes); }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xs font-medium" title="Edit label">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteRevision(rev.session_id)}
                          className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove revision">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mobile */}
                  <div className="sm:hidden px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{rev.label || `v${project.revisions.length - i}`}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{rev.filename}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{rev.page_count} pages · {timeAgo(rev.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cx("text-lg font-bold", scoreColor(rev.score))}>{rev.score || "—"}</span>
                        <Link href={`/report/${rev.session_id}`} className="p-1.5 text-slate-400 hover:text-indigo-600">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
