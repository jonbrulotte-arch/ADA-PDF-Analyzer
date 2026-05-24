"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getReport, remediatePdf, downloadUrl } from "@/lib/api";
import type { AccessibilityCheck, AccessibilityReport, CheckStatus, Severity } from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Download,
  ArrowLeft,
  FileText,
  Loader2,
  Check,
  X,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const STATUS_META: Record<CheckStatus, { label: string; color: string; icon: React.ReactNode; bg: string; border: string }> = {
  pass: {
    label: "Pass",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  },
  fail: {
    label: "Fail",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <XCircle className="w-4 h-4 text-red-600" />,
  },
  warning: {
    label: "Warning",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  },
  info: {
    label: "Info",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: <Info className="w-4 h-4 text-blue-500" />,
  },
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-red-200",
  major: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  minor: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  metadata: "Metadata",
  structure: "Structure",
  images: "Images",
  text: "Text",
  forms: "Forms",
  navigation: "Navigation",
  visual: "Visual",
  security: "Security",
};

// ---------------------------------------------------------------------------
// Score Circle
// ---------------------------------------------------------------------------

function ScoreCircle({ score, grade }: { score: number; grade: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const gradeBg =
    score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cx("text-3xl font-extrabold", gradeBg)}>{score}</span>
        <span className="text-xs text-slate-400 -mt-1">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Check Item
// ---------------------------------------------------------------------------

function CheckItem({
  check,
  approved,
  onToggleApprove,
}: {
  check: AccessibilityCheck;
  approved: boolean;
  onToggleApprove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[check.status];
  const hasFix = !!check.fix && check.fix.auto_fixable;

  return (
    <div className={cx("border rounded-xl overflow-hidden transition-all", meta.border)}>
      {/* Header row */}
      <button
        className={cx("w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50/80 transition-colors", meta.bg)}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="mt-0.5 flex-shrink-0">{meta.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-800">{check.name}</span>
            <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full", SEVERITY_BADGE[check.severity])}>
              {check.severity}
            </span>
            {check.wcag_criterion && (
              <span className="text-xs text-slate-400 font-mono">WCAG {check.wcag_criterion}</span>
            )}
          </div>
          <p className="text-sm text-slate-600">{check.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {hasFix && check.status !== "pass" && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> fixable
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-white">
          {check.details.length > 0 && (
            <ul className="mt-3 space-y-1">
              {check.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-slate-300 mt-0.5">›</span>
                  {d}
                </li>
              ))}
            </ul>
          )}

          {hasFix && check.status !== "pass" && check.fix && (
            <div className="mt-4 flex items-start justify-between gap-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-700 mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Automated Fix Available
                </p>
                <p className="text-sm text-slate-700">{check.fix.description}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleApprove(check.fix!.id); }}
                className={cx(
                  "flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all",
                  approved
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:text-indigo-600"
                )}
              >
                {approved ? (
                  <><Check className="w-3.5 h-3.5" /> Approved</>
                ) : (
                  <>Approve Fix</>
                )}
              </button>
            </div>
          )}

          {!hasFix && check.status === "fail" && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Manual remediation required.</span> This issue cannot be automatically fixed and requires editing the source document or using specialized PDF authoring tools.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Report Page
// ---------------------------------------------------------------------------

type ActiveTab = "all" | string;

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

  const [remediating, setRemediating] = useState(false);
  const [remediateError, setRemediateError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [changesMade, setChangesMade] = useState<string[]>([]);

  // Fetch report
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    getReport(sessionId)
      .then((r) => { setReport(r); setLoading(false); })
      .catch((e) => { setLoadError(e.message); setLoading(false); });
  }, [sessionId]);

  const toggleApprove = useCallback((fixId: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  }, []);

  const autoFixableChecks = useMemo(() =>
    report?.checks.filter((c) => c.fix?.auto_fixable && c.status !== "pass") ?? [],
    [report]
  );

  const approveAll = () => {
    const ids = new Set(autoFixableChecks.map((c) => c.fix!.id));
    setApprovedIds(ids);
  };

  const unapproveAll = () => setApprovedIds(new Set());

  const applyFixes = async () => {
    if (!report || approvedIds.size === 0) return;
    setRemediating(true);
    setRemediateError(null);
    try {
      const resp = await remediatePdf(sessionId, Array.from(approvedIds));
      setChangesMade(resp.changes_made);
      setDownloadReady(true);
    } catch (e: unknown) {
      setRemediateError(e instanceof Error ? e.message : "Remediation failed.");
    } finally {
      setRemediating(false);
    }
  };

  // Derive categories
  const categories = useMemo(() => {
    if (!report) return [];
    return Array.from(new Set(report.checks.map((c) => c.category)));
  }, [report]);

  const filteredChecks = useMemo(() => {
    if (!report) return [];
    if (activeTab === "all") return report.checks;
    return report.checks.filter((c) => c.category === activeTab);
  }, [report, activeTab]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-lg font-medium">Analyzing PDF…</p>
        <p className="text-sm text-slate-400">Running 13 accessibility checks</p>
      </div>
    );
  }

  if (loadError || !report) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Analysis Failed</h2>
        <p className="text-slate-500 mb-6">{loadError ?? "Unknown error."}</p>
        <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Try Another PDF
        </button>
      </div>
    );
  }

  const { summary } = report;
  const scoreColor =
    summary.score >= 75 ? "text-emerald-600" : summary.score >= 50 ? "text-amber-500" : "text-red-500";

  // ---------------------------------------------------------------------------
  // Main report render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Back link */}
      <button onClick={() => router.push("/")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Upload another PDF
      </button>

      {/* ============================================================ */}
      {/* Header / Score Card                                          */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ScoreCircle score={summary.score} grade={summary.grade} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500 truncate">{report.filename}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{report.page_count} pages</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{report.file_size_kb} KB</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Accessibility Score:{" "}
              <span className={scoreColor}>{summary.grade}</span>
            </h2>

            {/* Stat row */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Passed", count: summary.passed, color: "bg-emerald-100 text-emerald-700" },
                { label: "Failed", count: summary.failed, color: "bg-red-100 text-red-700" },
                { label: "Warnings", count: summary.warnings, color: "bg-amber-100 text-amber-700" },
                { label: "Critical Issues", count: summary.critical_failures, color: "bg-rose-100 text-rose-700" },
              ].map((s) => (
                <div key={s.label} className={cx("flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full", s.color)}>
                  <span className="text-base font-bold">{s.count}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {report.is_scanned && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Scanned/image-only PDF detected. Run OCR before applying accessibility fixes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Download Success Banner                                      */}
      {/* ============================================================ */}
      {downloadReady && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Remediated PDF Ready
              </h3>
              <ul className="mt-2 space-y-1">
                {changesMade.map((c, i) => (
                  <li key={i} className="text-sm text-emerald-700 flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">✓</span> {c}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={downloadUrl(sessionId)}
              download
              className="flex-shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Fix Approval Bar                                             */}
      {/* ============================================================ */}
      {!downloadReady && autoFixableChecks.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-indigo-900 text-sm">
              <Sparkles className="w-4 h-4 inline mr-1" />
              {autoFixableChecks.length} issue{autoFixableChecks.length > 1 ? "s" : ""} can be fixed automatically ·{" "}
              {approvedIds.size} approved
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              Expand any fixable check below to approve it, or approve all at once.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {approvedIds.size < autoFixableChecks.length ? (
              <button onClick={approveAll} className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-2">
                Approve All
              </button>
            ) : (
              <button onClick={unapproveAll} className="text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
            <button
              onClick={applyFixes}
              disabled={approvedIds.size === 0 || remediating}
              className={cx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all",
                approvedIds.size > 0 && !remediating
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {remediating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
              ) : (
                <>Apply {approvedIds.size > 0 ? approvedIds.size : ""} Fix{approvedIds.size !== 1 ? "es" : ""}</>
              )}
            </button>
          </div>
        </div>
      )}

      {remediateError && (
        <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {remediateError}
        </div>
      )}

      {/* ============================================================ */}
      {/* Category Tabs                                                */}
      {/* ============================================================ */}
      <div className="flex gap-1 flex-wrap mb-4">
        {(["all", ...categories] as ActiveTab[]).map((tab) => {
          const label = tab === "all" ? "All Checks" : (CATEGORY_LABELS[tab] ?? tab);
          const count =
            tab === "all"
              ? report.checks.length
              : report.checks.filter((c) => c.category === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              )}
            >
              {label}
              <span className={cx("ml-1.5 text-xs", activeTab === tab ? "text-indigo-200" : "text-slate-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* Check List                                                   */}
      {/* ============================================================ */}
      <div className="space-y-3">
        {filteredChecks.map((check) => (
          <CheckItem
            key={check.id}
            check={check}
            approved={!!check.fix && approvedIds.has(check.fix.id)}
            onToggleApprove={toggleApprove}
          />
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-12" />
    </div>
  );
}
