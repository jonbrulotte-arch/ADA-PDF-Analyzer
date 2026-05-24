"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPdf, batchUpload, getProjects, patchProject } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";
import { Upload, AlertTriangle, X, FolderOpen, Plus, ChevronDown } from "lucide-react";

// Derive a project name from filename
function stemName(filename: string): string {
  return filename.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

interface UploadModalProps {
  files: File[];
  onCancel: () => void;
  onConfirm: (projectId: string | null, projectName: string, assignee: string) => void;
}

function UploadModal({ files, onCancel, onConfirm }: UploadModalProps) {
  const isBatch = files.length > 1;
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [projectName, setProjectName] = useState(isBatch ? "Batch Upload" : stemName(files[0]?.name ?? ""));
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const searchProjects = useCallback(async (q: string) => {
    setLoadingProjects(true);
    try {
      const res = await getProjects({ search: q || undefined, limit: 20, sort: "updated_at", order: "desc" });
      setProjects(res.projects);
    } catch { setProjects([]); }
    finally { setLoadingProjects(false); }
  }, []);

  const handleModeSwitch = (m: "new" | "existing") => {
    setMode(m);
    if (m === "existing" && projects.length === 0) searchProjects("");
  };

  const handleConfirm = () => {
    if (mode === "existing" && selectedProject) {
      onConfirm(selectedProject.project_id, selectedProject.name, selectedProject.assignee);
    } else {
      onConfirm(null, projectName.trim() || stemName(files[0]?.name ?? "Untitled"), assignee.trim());
    }
  };

  const canConfirm = mode === "new" ? projectName.trim().length > 0 : selectedProject !== null;

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    in_review: "bg-amber-100 text-amber-700",
    remediated: "bg-indigo-100 text-indigo-700",
    approved: "bg-emerald-100 text-emerald-700",
    archived: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isBatch ? `Analyze ${files.length} PDFs` : `Analyze "${files[0]?.name}"`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Attach to a project to track revisions over time</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        {!isBatch && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(["new", "existing"] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleModeSwitch(m)}
                className={[
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {m === "new" ? <><Plus className="w-3.5 h-3.5" /> New Project</> : <><FolderOpen className="w-3.5 h-3.5" /> Add to Existing</>}
              </button>
            ))}
          </div>
        )}

        {/* New project fields */}
        {(mode === "new" || isBatch) && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="e.g. Annual Report 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assignee <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="e.g. Jon"
              />
            </div>
          </div>
        )}

        {/* Existing project picker */}
        {mode === "existing" && !isBatch && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Select Project</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); searchProjects(e.target.value); setDropdownOpen(true); }}
                onFocus={() => { searchProjects(search); setDropdownOpen(true); }}
                placeholder="Search projects…"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 pr-8 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {selectedProject && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-indigo-800">{selectedProject.name}</span>
                <button onClick={() => setSelectedProject(null)} className="text-indigo-400 hover:text-indigo-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {dropdownOpen && !selectedProject && (
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                {loadingProjects ? (
                  <p className="text-xs text-slate-400 px-3 py-3">Loading…</p>
                ) : projects.length === 0 ? (
                  <p className="text-xs text-slate-400 px-3 py-3">No projects found</p>
                ) : projects.map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => { setSelectedProject(p); setDropdownOpen(false); setSearch(p.name); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      {p.assignee && <p className="text-xs text-slate-400">{p.assignee}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.latest_score != null && (
                        <span className={["text-xs font-bold", p.latest_score >= 75 ? "text-emerald-600" : p.latest_score >= 50 ? "text-amber-500" : "text-red-500"].join(" ")}>{p.latest_score}</span>
                      )}
                      <span className={["text-xs px-1.5 py-0.5 rounded font-medium", STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-600"].join(" ")}>{p.status.replace("_", " ")}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={[
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
              canConfirm
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) { setError("Please select one or more PDF files."); return; }
    if (pdfs.length !== files.length) { setError("Only PDF files are accepted. Non-PDF files were ignored."); return; }
    setError(null);
    setPendingFiles(pdfs);
  }, []);

  const handleConfirm = useCallback(async (projectId: string | null, projectName: string, assignee: string) => {
    if (!pendingFiles) return;
    setPendingFiles(null);
    setUploading(true);
    try {
      if (pendingFiles.length > 1) {
        const resp = await batchUpload(pendingFiles);
        router.push(`/batch/${resp.batch_id}`);
      } else {
        const url = projectId ? `/api/upload?project_id=${encodeURIComponent(projectId)}` : undefined;
        const resp = await uploadPdf(pendingFiles[0], url);
        // Apply name/assignee if new project
        if (!projectId && resp.project_id) {
          await patchProject(resp.project_id, { name: projectName, assignee: assignee || undefined }).catch(() => {});
        }
        router.push(`/project/${resp.project_id}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setUploading(false);
    }
  }, [pendingFiles, router]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  return (
    <>
      {pendingFiles && (
        <UploadModal
          files={pendingFiles}
          onCancel={() => setPendingFiles(null)}
          onConfirm={handleConfirm}
        />
      )}

      <div className="min-h-[calc(100vh-8rem)] bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div
            className={[
              "relative rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer select-none",
              dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-slate-400",
              uploading ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
            onClick={() => !uploading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length > 0) handleFiles(f); e.target.value = ""; }} />

            <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
              {uploading ? (
                <>
                  <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Analyzing…</p>
                    <p className="text-xs text-slate-400 mt-0.5">Running 13 accessibility checks</p>
                  </div>
                </>
              ) : (
                <>
                  <div className={["w-12 h-12 rounded-lg flex items-center justify-center transition-colors", dragging ? "bg-indigo-100" : "bg-slate-100"].join(" ")}>
                    <Upload className={["w-5 h-5 transition-colors", dragging ? "text-indigo-600" : "text-slate-400"].join(" ")} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{dragging ? "Drop to analyze" : "Drop a PDF here to analyze"}</p>
                    <p className="text-xs text-slate-400 mt-1">or <span className="text-indigo-600 font-medium">click to browse</span> · up to 10 files · 80 MB each</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            {["WCAG 2.1 AA", "Section 508", "PDF/UA-1"].map((s) => (
              <span key={s} className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
