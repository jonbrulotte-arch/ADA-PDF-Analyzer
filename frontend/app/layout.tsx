import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import SettingsButton from "@/components/SettingsButton";

export const metadata: Metadata = {
  title: "ADA PDF Analyzer",
  description: "Analyze and remediate PDF accessibility for ADA / WCAG compliance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">ADA PDF Analyzer</h1>
              <p className="text-xs text-slate-500 leading-tight">WCAG 2.1 · PDF/UA Accessibility Checker</p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Nav links */}
            <Link
              href="/projects"
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
            >
              Projects
            </Link>
            <Link
              href="/instructions"
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
            >
              How It Works
            </Link>
            <Link
              href="/api-docs"
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
            >
              API
            </Link>

            {/* Settings button */}
            <SettingsButton />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          Checks against WCAG 2.1 AA and PDF/UA-1 standards. Always verify results with assistive technology.
        </footer>
      </body>
    </html>
  );
}
