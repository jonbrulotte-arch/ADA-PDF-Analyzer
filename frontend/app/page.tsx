"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPdf, batchUpload } from "@/lib/api";
import { Upload, AlertTriangle } from "lucide-react";

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
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">

        {/* Upload zone */}
        <div
          className={[
            "relative rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer select-none",
            dragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-white hover:border-slate-400",
            uploading ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={onInputChange}
          />

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
                <div className={[
                  "w-12 h-12 rounded-lg flex items-center justify-center transition-colors",
                  dragging ? "bg-indigo-100" : "bg-slate-100",
                ].join(" ")}>
                  <Upload className={["w-5 h-5 transition-colors", dragging ? "text-indigo-600" : "text-slate-400"].join(" ")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {dragging ? "Drop to analyze" : "Drop a PDF here to analyze"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    or{" "}
                    <span className="text-indigo-600 font-medium">click to browse</span>
                    {" "}· up to 10 files · 80 MB each
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Compliance tags */}
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {["WCAG 2.1 AA", "Section 508", "PDF/UA-1"].map((s) => (
            <span key={s} className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">
              {s}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
