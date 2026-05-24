"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getHistory } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";
import { ArrowLeft, Upload, FileText, Loader2, XCircle } from "lucide-react";

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? "s" : ""} ago`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} year${diffYear !== 1 ? "s" : ""} ago`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function gradeBadgeColor(grade: string): string {
  const first = grade[0]?.toUpperCase();
  if (first === "A") return "bg-emerald-100 text-emerald-700";
  if (first === "B") return "bg-blue-100 text-blue-700";
  if (first === "C") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getHistory(50, 0)
      .then(({ entries: e, total: t }) => {
        setEntries(e);
        setTotal(t);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load history.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Upload a PDF
      </Link>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analysis History</h1>
        {!loading && !error && total > 0 && (
          <p className="text-sm text-slate-500 mt-1">{total} document{total !== 1 ? "s" : ""} analyzed</p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading history…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <XCircle className="w-10 h-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Upload
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-700">No PDFs analyzed yet</p>
            <p className="text-sm text-slate-400 mt-1">Upload your first PDF to get started.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> Upload a PDF
          </Link>
        </div>
      )}

      {/* History table */}
      {!loading && !error && entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_64px_60px_120px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filename</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Score</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Grade</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Pages</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Date</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <button
                key={entry.session_id}
                onClick={() => router.push(`/report/${entry.session_id}`)}
                className="w-full text-left hover:bg-indigo-50/40 transition-colors"
              >
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_64px_60px_120px] gap-4 px-5 py-4 items-center">
                  <div className="min-w-0 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-800 truncate">{entry.filename}</span>
                  </div>
                  <div className="text-center">
                    <span className={cx("text-base font-bold", scoreColor(entry.score))}>{entry.score}</span>
                  </div>
                  <div className="flex justify-center">
                    <span className={cx("text-xs font-semibold px-2 py-0.5 rounded-full", gradeBadgeColor(entry.grade))}>
                      {entry.grade}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-slate-500">{entry.page_count}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{timeAgo(entry.created_at)}</span>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{entry.filename}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.page_count} pages · {timeAgo(entry.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cx("text-lg font-bold", scoreColor(entry.score))}>{entry.score}</span>
                      <span className={cx("text-xs font-semibold px-2 py-0.5 rounded-full", gradeBadgeColor(entry.grade))}>
                        {entry.grade}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
