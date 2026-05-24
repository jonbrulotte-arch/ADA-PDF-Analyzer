"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBatch } from "@/lib/api";
import type { BatchManifest, BatchSessionSummary } from "@/lib/types";
import { ArrowLeft, FileText, Loader2, XCircle, AlertTriangle, ChevronRight } from "lucide-react";

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function SessionCard({ session }: { session: BatchSessionSummary }) {
  const isError = session.status === "error";

  return (
    <div
      className={cx(
        "bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col",
        isError ? "border-slate-200 opacity-60" : "border-slate-200"
      )}
    >
      <div className="p-5 flex-1">
        {/* Filename */}
        <div className="flex items-start gap-2 mb-4">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 min-w-0">
            {session.filename}
          </p>
        </div>

        {isError ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{session.error ?? "Processing failed for this file."}</p>
          </div>
        ) : (
          <>
            {/* Score + Grade */}
            <div className="flex items-end gap-3 mb-4">
              <span className={cx("text-4xl font-extrabold leading-none", scoreColor(session.score))}>
                {session.score}
              </span>
              <div className="pb-0.5">
                <span className={cx("text-xs font-semibold px-2 py-1 rounded-full", gradeBadgeColor(session.grade))}>
                  {session.grade}
                </span>
              </div>
            </div>

            {/* Page count */}
            <p className="text-xs text-slate-400">{session.page_count} page{session.page_count !== 1 ? "s" : ""}</p>
          </>
        )}
      </div>

      {/* Status + Link footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <span
          className={cx(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            isError
              ? "bg-red-100 text-red-600"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          {isError ? "Error" : "Done"}
        </span>

        {!isError && (
          <Link
            href={`/report/${session.session_id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View Report <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function BatchPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [manifest, setManifest] = useState<BatchManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    getBatch(batchId)
      .then(setManifest)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load batch results.");
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-lg font-medium">Loading batch results…</p>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to Load Results</h2>
        <p className="text-slate-500 mb-6">{error ?? "Unknown error."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Upload More PDFs
        </Link>
      </div>
    );
  }

  const doneSessions = manifest.sessions.filter((s) => s.status === "done");
  const errorSessions = manifest.sessions.filter((s) => s.status === "error");
  const avgScore =
    doneSessions.length > 0
      ? Math.round(doneSessions.reduce((sum, s) => sum + s.score, 0) / doneSessions.length)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Upload more PDFs
      </Link>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Batch Analysis Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          {manifest.sessions.length} document{manifest.sessions.length !== 1 ? "s" : ""} · {formatDate(manifest.created_at)}
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Average Score",
            value: avgScore !== null ? String(avgScore) : "—",
            color: avgScore !== null ? scoreColor(avgScore) : "text-slate-400",
          },
          {
            label: "Total Documents",
            value: String(manifest.sessions.length),
            color: "text-slate-900",
          },
          {
            label: "Failures",
            value: String(errorSessions.length),
            color: errorSessions.length > 0 ? "text-red-500" : "text-slate-400",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <p className={cx("text-3xl font-extrabold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Session grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {manifest.sessions.map((session) => (
          <SessionCard key={session.session_id} session={session} />
        ))}
      </div>
    </div>
  );
}
