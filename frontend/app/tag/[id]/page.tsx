"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { extractElements, buildStructureTree } from "@/lib/api";
import type { PageElement, PageElements, ElementAssignment } from "@/lib/types";
import { ArrowLeft, Tag, Check, Loader2, ChevronDown, Download } from "lucide-react";

const ROLES = ["H1", "H2", "H3", "H4", "P", "Figure", "Table", "Caption", "List", "Artifact"];

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export default function TagWizardPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [step, setStep] = useState<"loading" | "assign" | "building" | "done">("loading");
  const [pages, setPages] = useState<PageElements[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, string>>({});   // element_id → role
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});         // element_id → alt text
  const [taggedCount, setTaggedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!sessionId) return;
    extractElements(sessionId)
      .then((data) => {
        setPages(data.pages);
        setTotalElements(data.total_elements);
        // Pre-populate assignments from suggested roles
        const init: Record<string, string> = {};
        for (const page of data.pages) {
          for (const el of page.elements) {
            init[el.id] = el.suggested_role;
          }
        }
        setAssignments(init);
        setStep("assign");
      })
      .catch((e) => {
        setError(e.message);
        setStep("assign");
      });
  }, [sessionId]);

  const handleRoleChange = useCallback((elemId: string, role: string) => {
    setAssignments((prev) => ({ ...prev, [elemId]: role }));
  }, []);

  const handleAltTextChange = useCallback((elemId: string, text: string) => {
    setAltTexts((prev) => ({ ...prev, [elemId]: text }));
  }, []);

  const handleBuild = async () => {
    setStep("building");
    const assignmentList: ElementAssignment[] = Object.entries(assignments).map(([id, role]) => ({
      element_id: id,
      role,
      alt_text: altTexts[id] ?? undefined,
    }));
    try {
      const result = await buildStructureTree(sessionId, assignmentList);
      setTaggedCount(result.elements_tagged);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Build failed.");
      setStep("assign");
    }
  };

  const totalPages = pages.length;
  const currentPageData = pages.find((p) => p.page_number === currentPage);

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="font-medium">Extracting page elements…</p>
      </div>
    );
  }

  if (step === "building") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="font-medium">Building structure tree…</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Structure Tree Built</h2>
        <p className="text-slate-500 mb-6">
          {taggedCount} element{taggedCount !== 1 ? "s" : ""} tagged with semantic roles and written to the PDF.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/report/${sessionId}`}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Report
          </Link>
          <a
            href={`/api/download/${sessionId}`}
            download
            className="inline-flex items-center justify-center gap-2 bg-white border border-emerald-300 text-emerald-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>
        </div>
        <p className="text-xs text-slate-400 mt-6">
          Re-analyze the report to see the updated accessibility score.
        </p>
      </div>
    );
  }

  // Step: assign
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link href={`/report/${sessionId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Report
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-600" />
            Tag PDF Elements
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Assign semantic roles to each element. Roles are pre-filled based on font size — adjust anything that looks wrong.
          </p>
        </div>
        <button
          onClick={handleBuild}
          className="flex-shrink-0 inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Check className="w-4 h-4" /> Build Structure Tree
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-5 text-sm text-slate-500">
        <span>{totalElements} elements across {totalPages} page{totalPages !== 1 ? "s" : ""}</span>
        <span className="text-slate-300">·</span>
        <span>{Object.values(assignments).filter((r) => r !== "Artifact").length} will be tagged</span>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex gap-1 flex-wrap mb-4">
          {pages.map((p) => (
            <button
              key={p.page_number}
              onClick={() => setCurrentPage(p.page_number)}
              className={cx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                currentPage === p.page_number
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              )}
            >
              Page {p.page_number}
              <span className={cx("ml-1.5 text-xs", currentPage === p.page_number ? "text-indigo-200" : "text-slate-400")}>
                {p.elements.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Elements table */}
      {currentPageData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Page {currentPageData.page_number} — {currentPageData.elements.length} element{currentPageData.elements.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-24">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Content Preview</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-16">Size</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-36">Assigned Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentPageData.elements.map((el) => (
                  <ElementRow
                    key={el.id}
                    element={el}
                    role={assignments[el.id] ?? el.suggested_role}
                    altText={altTexts[el.id] ?? ""}
                    onRoleChange={handleRoleChange}
                    onAltTextChange={handleAltTextChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom action */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleBuild}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Check className="w-4 h-4" /> Build Structure Tree
        </button>
      </div>
    </div>
  );
}

function ElementRow({
  element,
  role,
  altText,
  onRoleChange,
  onAltTextChange,
}: {
  element: PageElement;
  role: string;
  altText: string;
  onRoleChange: (id: string, role: string) => void;
  onAltTextChange: (id: string, text: string) => void;
}) {
  const isImage = element.element_type === "image";
  const isArtifact = role === "Artifact";

  return (
    <tr className={cx("align-top", isArtifact && "opacity-40")}>
      <td className="px-4 py-2.5">
        <span className={cx(
          "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
          isImage ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
        )}>
          {isImage ? "Image" : "Text"}
        </span>
      </td>
      <td className="px-4 py-2.5 max-w-xs">
        {isImage ? (
          <div className="space-y-1">
            <span className="text-slate-400 italic text-xs">Image / Figure</span>
            {!isArtifact && (
              <input
                type="text"
                value={altText}
                placeholder="Alt text for this image…"
                onChange={(e) => onAltTextChange(element.id, e.target.value)}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            )}
          </div>
        ) : (
          <span className="text-slate-700 line-clamp-2 text-xs leading-relaxed" title={element.text}>
            {element.text}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
        {element.font_size ? `${element.font_size}pt` : "—"}
      </td>
      <td className="px-4 py-2.5">
        <div className="relative">
          <select
            value={role}
            onChange={(e) => onRoleChange(element.id, e.target.value)}
            className={cx(
              "w-full text-xs border rounded-lg px-2 py-1.5 appearance-none pr-6 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors",
              role === "H1" || role === "H2" ? "border-indigo-200 bg-indigo-50 text-indigo-700" :
              role === "H3" || role === "H4" ? "border-blue-200 bg-blue-50 text-blue-700" :
              role === "Figure" ? "border-purple-200 bg-purple-50 text-purple-700" :
              role === "Artifact" ? "border-slate-200 bg-slate-50 text-slate-400" :
              "border-slate-200 bg-white text-slate-700"
            )}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>
      </td>
    </tr>
  );
}
