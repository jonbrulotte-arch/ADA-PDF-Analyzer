"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPdf } from "@/lib/api";
import {
  FileText,
  Upload,
  CheckCircle,
  AlertTriangle,
  Shield,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please select a PDF file.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const resp = await uploadPdf(file);
        router.push(`/report/${resp.session_id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
        setUploading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-5">
          <Shield className="w-4 h-4" />
          WCAG 2.1 AA · PDF/UA-1 Compliance
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Make Your PDFs<br />
          <span className="text-indigo-600">ADA Accessible</span>
        </h2>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Upload any PDF document. Get a detailed accessibility report, approve recommended fixes, and download a remediated file — all in minutes.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
            : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={onInputChange}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">Uploading &amp; Analyzing…</p>
              <p className="text-sm text-slate-400 mt-1">Running 13 accessibility checks</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${dragging ? "bg-indigo-200" : "bg-slate-100"}`}>
              <Upload className={`w-8 h-8 transition-colors ${dragging ? "text-indigo-600" : "text-slate-400"}`} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">
                {dragging ? "Drop your PDF here" : "Drag & drop your PDF"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or <span className="text-indigo-600 font-medium">click to browse</span> · up to 50 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Feature Grid */}
      <div className="grid sm:grid-cols-3 gap-4 mt-14">
        {[
          {
            icon: <FileText className="w-5 h-5 text-indigo-600" />,
            title: "13 Accessibility Checks",
            body: "Document tags, alt text, headings, contrast, forms, bookmarks, and more.",
          },
          {
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            title: "One-Click Fixes",
            body: "Approve automated remediation suggestions and apply them instantly.",
          },
          {
            icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
            title: "Download Remediated PDF",
            body: "Get an improved, more accessible PDF ready to publish or share.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center mb-3">
              {f.icon}
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">{f.title}</h3>
            <p className="text-sm text-slate-500">{f.body}</p>
          </div>
        ))}
      </div>

      {/* Standards */}
      <div className="mt-10 text-center">
        <p className="text-xs text-slate-400">
          Checks against <strong>WCAG 2.1 AA</strong> · <strong>Section 508</strong> · <strong>PDF/UA-1 (ISO 14289)</strong>
        </p>
      </div>
    </div>
  );
}
