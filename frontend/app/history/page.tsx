"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProjects, deleteProject } from "@/lib/api";
import type { ProjectSummary, ProjectStatus } from "@/lib/types";
import { ArrowLeft, Upload, FolderOpen, Loader2, XCircle, Trash2, ChevronRight } from "lucide-react";

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function gradeBadge(grade: string): string {
  const g = grade[0]?.toUpperCase();
  if (g === "A") return "bg-emerald-100 text-emerald-700";
  if (g === "B") return "bg-blue-100 text-blue-700";
  if (g === "C") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active:     "bg-blue-100 text-blue-700",
  in_review:  "bg-amber-100 text-amber-700",
  remediated: "bg-indigo-100 text-indigo-700",
  approved:   "bg-emerald-100 text-emerald-700",
  archived:   "bg-slate-100 text-slate-500",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",           label: "All statuses" },
  { value: "active",     label: "Active" },
  { value: "in_review",  label: "In Review" },
  { value: "remediated", label: "Remediated" },
  { value: "approved",   label: "Approved" },
  { value: "archived",   label: "Archived" },
];

export default function HistoryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchProjects = (q: string, status: string) => {
    setLoading(true);
    getProjects({
      search: q || undefined,
      status: status || undefined,
      sort: "updated_at",
      order: "desc",
      limit: 50,
      offset: 0,
    })
      .then(({ projects: p, total: t }) => { setProjects(p); setTotal(t); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load projects."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects(search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchProjects(search, statusFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project and all its revisions?")) return;
    setDeleting(projectId);
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
      setTotal((t) => t - 1);
    } catch {
      // silently ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Upload a PDF
      </Link>

      <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          {!loading && !error && total > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">{total} project{total !== 1 ? "s" : ""}</p>
          )}
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-48"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading projects…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <XCircle className="w-10 h-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Upload
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-700">
              {search || statusFilter ? "No matching projects" : "No projects yet"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {search || statusFilter ? "Try adjusting your filters." : "Upload a PDF to get started."}
            </p>
          </div>
          {!search && !statusFilter && (
            <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
              <Upload className="w-4 h-4" /> Upload a PDF
            </Link>
          )}
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px_80px_64px_100px_40px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignee</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Score</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Grade</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Updated</span>
            <span />
          </div>

          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <div
                key={project.project_id}
                className={cx(
                  "group flex items-center hover:bg-indigo-50/40 transition-colors",
                  deleting === project.project_id ? "opacity-40 pointer-events-none" : ""
                )}
              >
                {/* Clickable row */}
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => router.push(`/project/${project.project_id}`)}
                >
                  {/* Desktop */}
                  <div className="hidden sm:grid grid-cols-[1fr_120px_100px_80px_64px_100px] gap-4 px-5 py-4 items-center">
                    <div className="min-w-0 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                        <p className="text-xs text-slate-400">{project.revision_count} revision{project.revision_count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 truncate">{project.assignee || <span className="text-slate-300">—</span>}</div>
                    <div>
                      <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_STYLES[project.status] ?? "bg-slate-100 text-slate-500")}>
                        {project.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-center">
                      {project.latest_score != null
                        ? <span className={cx("text-base font-bold", scoreColor(project.latest_score))}>{project.latest_score}</span>
                        : <span className="text-slate-300 text-sm">—</span>
                      }
                    </div>
                    <div className="flex justify-center">
                      {project.latest_grade
                        ? <span className={cx("text-xs font-semibold px-2 py-0.5 rounded-full", gradeBadge(project.latest_grade))}>{project.latest_grade}</span>
                        : <span className="text-slate-300 text-sm">—</span>
                      }
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">{timeAgo(project.updated_at)}</span>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="sm:hidden px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cx("text-xs font-medium px-1.5 py-0.5 rounded", STATUS_STYLES[project.status] ?? "bg-slate-100 text-slate-500")}>
                            {project.status.replace("_", " ")}
                          </span>
                          <span className="text-xs text-slate-400">{project.revision_count} rev · {timeAgo(project.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {project.latest_score != null && (
                          <span className={cx("text-lg font-bold", scoreColor(project.latest_score))}>{project.latest_score}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Delete button */}
                <div className="px-3 flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, project.project_id)}
                    disabled={deleting === project.project_id}
                    className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete project"
                  >
                    {deleting === project.project_id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
