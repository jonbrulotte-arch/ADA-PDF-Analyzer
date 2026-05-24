"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadPdf, batchUpload } from "@/lib/api";
import { Upload, AlertTriangle, History, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (pdfs.length === 0) { setError("Please select one or more PDF files."); return; }
      if (pdfs.length !== files.length) { setError("Only PDF files are accepted. Non-PDF files were ignored."); return; }
      setError(null);
      setUploading(true);
      try {
        if (pdfs.length > 1) {
          const resp = await batchUpload(pdfs);
          router.push(`/batch/${resp.batch_id}`);
        } else {
          const resp = await uploadPdf(pdfs[0]);
          router.push(`/report/${resp.session_id}`);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
        setUploading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16">
        <div className="w-full max-w-2xl">
          {/* Wordmark */}
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold tracking-widest text-indigo-600 uppercase mb-4">
              WCAG 2.1 AA · Section 508 · PDF/UA-1
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
              PDF Accessibility<br />
              <span className="text-indigo-600">Analysis &amp; Remediation</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">
              Upload a PDF to get a scored accessibility report, approve automated fixes, and download a remediated file.
            </p>
          </div>

          {/* Upload Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
              ${dragging ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"}
              ${uploading ? "pointer-events-none opacity-60" : ""}
            `}
            onClick={() => !uploading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} />

            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700">Uploading &amp; analyzing…</p>
                <p className="text-sm text-slate-400">Running 13 accessibility checks</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${dragging ? "bg-indigo-200" : "bg-slate-100"}`}>
                  <Upload className={`w-6 h-6 transition-colors ${dragging ? "text-indigo-600" : "text-slate-400"}`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">
                    {dragging ? "Drop your PDFs here" : "Drag & drop one or more PDFs"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    or <span className="text-indigo-600 font-medium">click to browse</span> · up to 10 files · 80 MB each
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Utility links */}
          <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
            <Link href="/history" className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
              <History className="w-4 h-4" /> View History
            </Link>
            <Link href="/instructions" className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
              How it works <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* How it works — compact strip */}
      <div className="border-t border-slate-100 bg-slate-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Upload", body: "Drop any PDF — single file or batch up to 10." },
              { step: "02", title: "Review", body: "Get a scored report across 13 WCAG & PDF/UA checks." },
              { step: "03", title: "Remediate", body: "Approve fixes, edit inline, download a better PDF." },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs font-bold text-indigo-400 tracking-widest mb-1">{s.step}</div>
                <div className="text-sm font-semibold text-slate-800 mb-1">{s.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Standards footer strip */}
      <div className="py-4 text-center bg-white border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Checks against <strong>WCAG 2.1 AA</strong> · <strong>Section 508</strong> · <strong>PDF/UA-1 (ISO 14289)</strong>
        </p>
      </div>
    </div>
  );
}
