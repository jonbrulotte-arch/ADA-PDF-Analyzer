"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getReport,
  remediatePdf,
  downloadUrl,
  getSettings,
  getSessionState,
  patchSessionState,
  patchRevision,
  generateAltText,
  reanalyze,
  exportHtmlReportUrl,
} from "@/lib/api";
import type {
  AccessibilityCheck,
  AccessibilityReport,
  AppSettingsResponse,
  CheckStatus,
  ReanalyzeResponse,
  Severity,
} from "@/lib/types";
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
  Link2,
  RefreshCw,
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

function ScoreCircle({ score, grade, size = "lg" }: { score: number; grade: string; size?: "sm" | "lg" }) {
  const radius = size === "sm" ? 36 : 54;
  const viewBox = size === "sm" ? "0 0 88 88" : "0 0 128 128";
  const cx64 = size === "sm" ? 44 : 64;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const gradeBg =
    score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-red-500";

  const containerClass = size === "sm" ? "w-[88px] h-[88px]" : "w-32 h-32";
  const scoreClass = size === "sm" ? "text-xl" : "text-3xl";

  return (
    <div className={cx("relative flex-shrink-0", containerClass)}>
      <svg className="w-full h-full -rotate-90" viewBox={viewBox}>
        <circle cx={cx64} cy={cx64} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx={cx64}
          cy={cx64}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cx("font-extrabold", scoreClass, gradeBg)}>{score}</span>
        <span className="text-xs text-slate-400 -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Check Item
// ---------------------------------------------------------------------------

interface FigureItem {
  index: number;
  page?: number;
  description?: string;
}

interface CheckItemProps {
  check: AccessibilityCheck;
  approved: boolean;
  onToggleApprove: (id: string) => void;
  customAltTexts: Record<string, string>;
  onAltTextChange: (figureIndexStr: string, text: string) => void;
  acknowledgments: Record<string, string>;
  onAcknowledge: (checkId: string, note: string) => void;
  settings: AppSettingsResponse;
  generatingAltTextForCheck: string | null;
  onGenerateAltText: (checkId: string) => void;
  findingValues: Record<string, string>;
  onFindingValueChange: (fieldKey: string, value: string) => void;
  sessionId: string;
}

function CheckItem({
  check,
  approved,
  onToggleApprove,
  customAltTexts,
  onAltTextChange,
  acknowledgments,
  onAcknowledge,
  settings,
  generatingAltTextForCheck,
  onGenerateAltText,
  findingValues,
  onFindingValueChange,
  sessionId,
}: CheckItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [ackNote, setAckNote] = useState("");
  const [editingAck, setEditingAck] = useState(false);

  const meta = STATUS_META[check.status];
  const hasFix = !!check.fix && check.fix.auto_fixable;
  const isAltTextCheck = check.fix?.fix_type === "alt_text";
  const isGenerating = generatingAltTextForCheck === check.id;

  // Determine figures missing from fix_data
  const figuresMissing: FigureItem[] = useMemo(() => {
    if (!isAltTextCheck || !check.fix) return [];
    const fd = check.fix.fix_data as Record<string, unknown>;
    const arr = fd.figures_missing;
    if (Array.isArray(arr)) return arr as FigureItem[];
    return [];
  }, [isAltTextCheck, check.fix]);

  const fixDataAltTexts: Record<string, string> = useMemo(() => {
    if (!isAltTextCheck || !check.fix) return {};
    const fd = check.fix.fix_data as Record<string, unknown>;
    return (fd.alt_texts as Record<string, string>) ?? {};
  }, [isAltTextCheck, check.fix]);

  const existingAck = acknowledgments[check.id];
  const isWarning = check.status === "warning";
  const canAcknowledge =
    (check.status === "fail" && (!check.fix || !check.fix.auto_fixable)) || isWarning;

  const handleAcknowledgeSubmit = () => {
    onAcknowledge(check.id, ackNote.trim());
    setEditingAck(false);
    setAckNote("");
  };

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
            {existingAck && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {check.status === "warning" ? "Validated" : "Acknowledged"}
              </span>
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

          {/* Findings table */}
          {check.findings && check.findings.length > 0 && check.status !== "pass" && check.status !== "info" && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-16">Page</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/4">Element</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Issue / Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {check.findings.map((finding) => (
                    <tr key={finding.id} className="align-top">
                      <td className="px-3 py-2.5 text-slate-400 font-mono">
                        {finding.page ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-700">{finding.element_label}</span>
                        {finding.infringing_text && (
                          <div className="text-slate-400 mt-0.5 truncate max-w-[160px]" title={finding.infringing_text}>
                            {finding.infringing_text}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-slate-600 mb-1.5">{finding.recommended_fix}</p>
                        {finding.editor !== "none" && finding.field_key && (
                          finding.editor === "textarea" ? (
                            null
                          ) : (
                            <div>
                              <input
                                type="text"
                                value={findingValues[finding.field_key] ?? ""}
                                placeholder={finding.placeholder ?? ""}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  onFindingValueChange(finding.field_key!, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                              />
                              <p className="text-xs text-slate-400 mt-1">
                                Value saved automatically · applied when you click <strong>Apply Fixes</strong>
                              </p>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Alt text fix UI */}
          {isAltTextCheck && check.status === "fail" && check.fix && (
            <div className="mt-4 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Alt Text Required
                    <span className="ml-1 text-indigo-500 font-normal">
                      ({figuresMissing.length} image{figuresMissing.length !== 1 ? "s" : ""} missing alt text)
                    </span>
                  </p>
                  {settings.ai_alt_text_enabled && settings.has_api_key && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onGenerateAltText(check.id); }}
                      disabled={isGenerating}
                      className={cx(
                        "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all",
                        isGenerating
                          ? "bg-indigo-100 text-indigo-400 cursor-not-allowed"
                          : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                      )}
                    >
                      {isGenerating ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> Generate with AI</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Per-figure textareas */}
              {figuresMissing.map((figure) => {
                const key = String(figure.index);
                const placeholder = fixDataAltTexts[key] ?? "";
                const value = customAltTexts[key] ?? "";
                const charCount = value.length;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Image #{figure.index + 1}
                      {figure.page !== undefined && (
                        <span className="font-normal text-slate-400 ml-1">(page {figure.page})</span>
                      )}
                    </label>
                    <textarea
                      rows={3}
                      value={value}
                      placeholder={placeholder || "Describe this image for screen reader users…"}
                      onChange={(e) => onAltTextChange(key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                    />
                    <p className={cx("text-xs text-right", charCount > 150 ? "text-amber-500" : "text-slate-400")}>
                      {charCount} / 150 chars suggested
                    </p>
                  </div>
                );
              })}

              {/* Standard approve button for the fix */}
              <div className="flex items-start justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex-1 min-w-0">
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
            </div>
          )}

          {/* Standard auto-fixable (non-alt-text) */}
          {hasFix && !isAltTextCheck && check.status !== "pass" && check.fix && (
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

          {/* Acknowledge / Validation Complete section */}
          {canAcknowledge && (
            <div className="mt-4">
              {existingAck && !editingAck ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-1">
                        <Check className="w-3 h-3" /> {isWarning ? "Validation Complete" : "Acknowledged"}
                      </p>
                      {existingAck !== "__validated__" && (
                        <p className="text-sm text-slate-700">{existingAck}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAckNote(existingAck === "__validated__" ? "" : existingAck); setEditingAck(true); }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline underline-offset-2 flex-shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    {editingAck
                      ? (isWarning ? "Edit Validation Note" : "Edit Acknowledgment")
                      : (isWarning ? "Manual verification required" : "Manual remediation required")}
                  </p>
                  {!editingAck && (
                    <p className="text-sm text-slate-600">
                      {isWarning
                        ? "This check requires visual verification — automated tools cannot fully validate it. Once you have confirmed it manually, mark it as validated to clear it from the score."
                        : "This issue cannot be automatically fixed. You can acknowledge it with a note."}
                    </p>
                  )}
                  <textarea
                    rows={2}
                    value={ackNote}
                    placeholder={isWarning ? "Optional: describe how you verified this (e.g. reviewed in Acrobat Pro, tested with NVDA…)" : "Add a note (e.g. tracked in Jira, will fix in v2…)"}
                    onChange={(e) => setAckNote(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge(check.id, ackNote.trim() || "__validated__");
                        setEditingAck(false);
                        setAckNote("");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Check className="w-3 h-3" /> {isWarning ? "Mark Validation Complete" : "Mark Acknowledged"}
                    </button>
                    {editingAck && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAck(false); setAckNote(""); }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:text-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-fixable, non-fail checks info */}
          {!hasFix && !canAcknowledge && check.status === "fail" && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              {check.category === "structure" && check.name.toLowerCase().includes("tagged") ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-700 mb-1">No structure tree detected.</p>
                    <p>Use the guided tagging wizard to assign semantic roles to each element and build a structure tree.</p>
                  </div>
                  <a
                    href={`/tag/${sessionId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Tag This PDF
                  </a>
                </div>
              ) : (
                <>
                  <span className="font-medium text-slate-700">Manual remediation required.</span> This issue cannot be automatically fixed and requires editing the source document or using specialized PDF authoring tools.
                </>
              )}
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

  // Core report state
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fix approval state
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

  // Remediation state
  const [remediating, setRemediating] = useState(false);
  const [remediateError, setRemediateError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [changesMade, setChangesMade] = useState<string[]>([]);

  // New state
  const [settings, setSettings] = useState<AppSettingsResponse>({ ai_alt_text_enabled: false, has_api_key: false });
  const [customAltTexts, setCustomAltTexts] = useState<Record<string, string>>({});
  const [acknowledgments, setAcknowledgments] = useState<Record<string, string>>({});
  const [findingValues, setFindingValues] = useState<Record<string, string>>({});
  const [generatingAltTextForCheck, setGeneratingAltTextForCheck] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalysisResult, setReanalysisResult] = useState<ReanalyzeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Ref to track initial load (skip first debounce save)
  const initialLoadDone = useRef(false);

  // ---------------------------------------------------------------------------
  // On mount: parallel fetches
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    Promise.all([
      getReport(sessionId),
      getSettings().catch(() => ({ ai_alt_text_enabled: false, has_api_key: false } as AppSettingsResponse)),
      getSessionState(sessionId).catch(() => null),
    ]).then(([reportData, settingsData, stateData]) => {
      setReport(reportData);
      setSettings(settingsData);

      if (stateData) {
        setApprovedIds(new Set(stateData.approved_fix_ids));
        setCustomAltTexts(stateData.custom_alt_texts ?? {});
        setAcknowledgments(stateData.acknowledgments ?? {});
        setFindingValues(stateData.finding_values ?? {});
      }

      setLoading(false);
      // Mark initial load done after state is set (next tick)
      setTimeout(() => { initialLoadDone.current = true; }, 0);
    }).catch((e) => {
      setLoadError(e.message);
      setLoading(false);
    });
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Debounced state save (800ms)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialLoadDone.current) return;

    const timer = setTimeout(() => {
      patchSessionState(sessionId, {
        approved_fix_ids: Array.from(approvedIds),
        custom_alt_texts: customAltTexts,
        acknowledgments,
        finding_values: findingValues,
      }).catch(() => {
        // Silent fail — state save is best-effort
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [sessionId, approvedIds, customAltTexts, acknowledgments, findingValues]);

  // ---------------------------------------------------------------------------
  // Page unload save via sendBeacon
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!sessionId) return;

    const handleBeforeUnload = () => {
      const payload = JSON.stringify({
        approved_fix_ids: Array.from(approvedIds),
        custom_alt_texts: customAltTexts,
        acknowledgments,
        finding_values: findingValues,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(`/api/session/${sessionId}/state`, blob);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId, approvedIds, customAltTexts, acknowledgments, findingValues]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleApprove = useCallback((fixId: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  }, []);

  const handleAltTextChange = useCallback((figureIndexStr: string, text: string) => {
    setCustomAltTexts((prev) => ({ ...prev, [figureIndexStr]: text }));
  }, []);

  const handleAcknowledge = useCallback((checkId: string, note: string) => {
    setAcknowledgments((prev) => ({ ...prev, [checkId]: note }));
  }, []);

  const handleFindingValueChange = useCallback((fieldKey: string, value: string) => {
    setFindingValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleGenerateAltText = useCallback(async (checkId: string) => {
    setGeneratingAltTextForCheck(checkId);
    try {
      const result = await generateAltText(sessionId, checkId);
      setCustomAltTexts((prev) => ({ ...prev, ...result.alt_texts }));
    } catch {
      // Silent fail — user can retry
    } finally {
      setGeneratingAltTextForCheck(null);
    }
  }, [sessionId]);

  const autoFixableChecks = useMemo(() =>
    report?.checks.filter((c) => c.fix?.auto_fixable && c.status !== "pass") ?? [],
    [report]
  );

  // Effective score: acknowledged warnings count as full passes
  const effectiveScore = useMemo(() => {
    if (!report) return 0;
    const WEIGHTS: Record<string, number> = { critical: 3, major: 2, minor: 1 };
    const scorable = report.checks.filter((c) => c.status !== "info");
    let earned = 0, total = 0;
    for (const c of scorable) {
      const w = WEIGHTS[c.severity] ?? 1;
      total += w;
      if (c.status === "pass") {
        earned += w;
      } else if (c.status === "warning") {
        earned += acknowledgments[c.id] ? w : w * 0.5;
      }
      // fail = 0
    }
    return total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 100;
  }, [report, acknowledgments]);

  const effectiveGrade = effectiveScore >= 90 ? "A" : effectiveScore >= 75 ? "B" : effectiveScore >= 55 ? "C" : effectiveScore >= 35 ? "D" : "F";
  const hasManualValidations = report ? report.checks.some((c) => c.status === "warning" && acknowledgments[c.id]) : false;

  // Sync effective score back to the project revision whenever it changes
  // (must be after effectiveScore/effectiveGrade declarations)
  useEffect(() => {
    if (!initialLoadDone.current || !report?.project_id) return;
    const timer = setTimeout(() => {
      patchRevision(report.project_id, sessionId, {
        score: effectiveScore,
        grade: effectiveGrade,
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScore]);

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
      const resp = await remediatePdf(
        sessionId,
        Array.from(approvedIds),
        customAltTexts,
        acknowledgments,
        findingValues
      );
      setChangesMade(resp.changes_made);
      setDownloadReady(true);
    } catch (e: unknown) {
      setRemediateError(e instanceof Error ? e.message : "Remediation failed.");
    } finally {
      setRemediating(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const result = await reanalyze(sessionId);
      setReanalysisResult(result);
      // Update the report with the new one
      setReport(result.new_report);
    } catch {
      // Silent fail
    } finally {
      setReanalyzing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
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
  const displayScore = effectiveScore;
  const displayGrade = effectiveGrade;
  const scoreColor =
    displayScore >= 75 ? "text-emerald-600" : displayScore >= 50 ? "text-amber-500" : "text-red-500";

  // ---------------------------------------------------------------------------
  // Main report render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Back link */}
      <button
        onClick={() => router.push(report.project_id ? `/project/${report.project_id}` : "/projects")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Project
      </button>

      {/* ============================================================ */}
      {/* Header / Score Card                                          */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative">
            <ScoreCircle score={displayScore} grade={displayGrade} />
            {hasManualValidations && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center" title="Score includes manually validated checks">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500 truncate">{report.filename}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{report.page_count} pages</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{report.file_size_kb} KB</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              Accessibility Score:{" "}
              <span className={scoreColor}>{displayGrade}</span>
            </h2>
            {hasManualValidations && displayScore !== summary.score && (
              <p className="text-xs text-emerald-600 mb-2">
                Includes manually validated checks · raw score: {summary.score}
              </p>
            )}

            {/* Stat row */}
            <div className="flex flex-wrap gap-3 mb-4">
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

            {/* Action buttons row */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyLink}
                className={cx(
                  "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-all",
                  copied
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                )}
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5" /> Copied!</>
                ) : (
                  <><Link2 className="w-3.5 h-3.5" /> Copy Link</>
                )}
              </button>

              <a
                href={exportHtmlReportUrl(sessionId)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Export Report
              </a>
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
            <div className="flex flex-col gap-2 flex-shrink-0">
              <a
                href={downloadUrl(sessionId)}
                download
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className={cx(
                  "inline-flex items-center justify-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm text-sm",
                  reanalyzing
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                )}
              >
                {reanalyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Re-analyzing…</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Re-analyze to Confirm Fixes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Re-analysis Result Card                                      */}
      {/* ============================================================ */}
      {reanalysisResult && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
          <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-500" />
            Re-analysis Results
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <ScoreCircle score={reanalysisResult.score_before} grade="" size="sm" />
                <p className="text-xs text-slate-500 mt-2">Before</p>
              </div>
              <div className="text-2xl text-slate-300 font-light">→</div>
              <div className="text-center">
                <ScoreCircle score={reanalysisResult.score_after} grade="" size="sm" />
                <p className="text-xs text-slate-500 mt-2">After</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {reanalysisResult.score_after > reanalysisResult.score_before
                  ? `Score improved from ${reanalysisResult.score_before} to ${reanalysisResult.score_after}`
                  : reanalysisResult.score_after === reanalysisResult.score_before
                  ? "No change in score"
                  : `Score changed from ${reanalysisResult.score_before} to ${reanalysisResult.score_after}`}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Download the report to see the full updated analysis.
              </p>
            </div>
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
            customAltTexts={customAltTexts}
            onAltTextChange={handleAltTextChange}
            acknowledgments={acknowledgments}
            onAcknowledge={handleAcknowledge}
            settings={settings}
            generatingAltTextForCheck={generatingAltTextForCheck}
            onGenerateAltText={handleGenerateAltText}
            findingValues={findingValues}
            onFindingValueChange={handleFindingValueChange}
            sessionId={sessionId}
          />
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-12" />
    </div>
  );
}
