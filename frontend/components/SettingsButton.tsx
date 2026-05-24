"use client";

import { useEffect, useState } from "react";
import { Settings, X, AlertTriangle } from "lucide-react";
import { getSettings, patchSettings } from "@/lib/api";
import type { AppSettingsResponse } from "@/lib/types";

function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSettings()
      .then((s) => setSettings(s))
      .catch(() => {
        // If settings fetch fails, show defaults
        setSettings({ ai_alt_text_enabled: false, has_api_key: false });
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleToggle = async () => {
    if (!settings || !settings.has_api_key || toggling) return;
    setToggling(true);
    try {
      const updated = await patchSettings({ ai_alt_text_enabled: !settings.ai_alt_text_enabled });
      setSettings(updated);
    } catch {
      // revert on error — leave state unchanged
    } finally {
      setToggling(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">App Settings</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close settings"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="w-6 h-6 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : settings ? (
                <div className="space-y-4">
                  {/* Toggle row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">AI-Powered Alt Text Generation</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Uses Claude Vision to generate descriptive alt text for images. Requires{" "}
                        <code className="font-mono bg-slate-100 px-1 rounded text-xs">ANTHROPIC_API_KEY</code>.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={settings.ai_alt_text_enabled}
                      disabled={!settings.has_api_key || toggling}
                      onClick={handleToggle}
                      className={cx(
                        "relative flex-shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        !settings.has_api_key || toggling
                          ? "cursor-not-allowed opacity-50 bg-slate-200"
                          : settings.ai_alt_text_enabled
                          ? "bg-indigo-600"
                          : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cx(
                          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                          settings.ai_alt_text_enabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* API key warning */}
                  {!settings.has_api_key && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        No API key configured — set{" "}
                        <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code>{" "}
                        in your environment.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
