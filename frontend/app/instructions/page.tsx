import Link from "next/link";
import { ArrowLeft, Upload, FileText, Wrench, Download, RefreshCw, Tag } from "lucide-react";

export const metadata = { title: "How It Works — ADA PDF Analyzer" };

const steps = [
  {
    icon: Upload,
    title: "Upload your PDF",
    body: "Drag and drop one PDF (or up to 10 for batch analysis) onto the home page. Files up to 80 MB are supported. The original file is never modified.",
  },
  {
    icon: FileText,
    title: "Review the accessibility report",
    body: "The analyzer runs 13 checks covering WCAG 2.1 AA, Section 508, and PDF/UA-1 standards — document title, language, tagging, heading structure, alt text, color contrast, form labels, links, fonts, bookmarks, reading order, encryption, and scanned-image detection. Each check shows its page-level findings, the infringing element, and a specific recommended fix.",
  },
  {
    icon: Wrench,
    title: "Approve and customize fixes",
    body: "Checks with automated fixes show an \"Approve Fix\" button. For issues like missing alt text or document title, inline editors let you type your own value before applying. Non-automatable issues can be acknowledged with a note.",
  },
  {
    icon: Tag,
    title: "Tag unstructured PDFs (optional)",
    body: "If the PDF lacks a structure tree, the \"Tag This PDF\" button opens a guided wizard. Each page element is listed with its text and an auto-suggested role (H1, H2, Paragraph, Figure, etc.). Adjust any assignments, then build the structure tree — no specialized software required.",
  },
  {
    icon: Download,
    title: "Download the remediated PDF",
    body: "Click \"Apply Fixes\" to generate an improved PDF. Approved fixes are applied in one pass — titles, language tags, alt text, bookmarks, and structure tree. Download the result with one click.",
  },
  {
    icon: RefreshCw,
    title: "Re-analyze to confirm",
    body: "After downloading, click \"Re-analyze\" to run all 13 checks against the remediated PDF and see a before/after score comparison.",
  },
];

export default function InstructionsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Upload
      </Link>

      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">How It Works</h1>
      <p className="text-slate-500 mb-10">
        A step-by-step guide to analyzing and remediating PDF accessibility with this tool.
      </p>

      <ol className="space-y-8">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mt-0.5">
              <s.icon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-indigo-400 tracking-widest">0{i + 1}</span>
                <h2 className="font-semibold text-slate-900">{s.title}</h2>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <strong>Note:</strong> Automated fixes improve accessibility significantly but are not a substitute for manual review by an accessibility expert. Always verify the remediated PDF with assistive technology before publishing.
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload a PDF
        </Link>
      </div>
    </div>
  );
}
