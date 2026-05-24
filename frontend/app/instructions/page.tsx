import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

export const metadata = { title: "How It Works — ADA PDF Analyzer" };

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-slate-900 mt-12 mb-4 pb-2 border-b border-slate-200 scroll-mt-6">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-800 mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}

function Badge({ color, children }: { color: "red" | "amber" | "slate" | "indigo"; children: React.ReactNode }) {
  const cls = {
    red:    "bg-red-100 text-red-700",
    amber:  "bg-amber-100 text-amber-700",
    slate:  "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700",
  }[color];
  return <span className={`inline text-xs font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{children}</span>;
}

function CheckEntry({
  name, standard, severity, autofix, weight, children,
}: {
  name: string; standard: string; severity: "critical" | "major" | "minor";
  autofix: boolean; weight: number; children: React.ReactNode;
}) {
  const sev = { critical: "red", major: "amber", minor: "slate" } as const;
  return (
    <div className="mb-8 rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-800 text-sm">{name}</span>
        <Badge color={sev[severity]}>{severity}</Badge>
        <span className="text-xs text-slate-400 font-mono">{standard}</span>
        {autofix && <Badge color="indigo">auto-fixable</Badge>}
        <span className="ml-auto text-xs text-slate-400">score weight: ×{weight}</span>
      </div>
      <div className="px-4 py-3 text-sm text-slate-600 space-y-2">{children}</div>
    </div>
  );
}

export default function InstructionsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-3xl font-extrabold text-slate-900 mb-1">How It Works</h1>
      <p className="text-slate-500 mb-2 text-sm">
        Technical methodology, check-by-check breakdown, and scoring explanation.
      </p>
      <nav className="text-xs text-indigo-600 space-x-3 mb-10">
        <a href="#workflow" className="hover:underline">Workflow</a>
        <a href="#scoring" className="hover:underline">Scoring</a>
        <a href="#checks" className="hover:underline">Checks</a>
        <a href="#remediation" className="hover:underline">Remediation</a>
        <a href="#limitations" className="hover:underline">Limitations</a>
      </nav>

      {/* ── Workflow ─────────────────────────────────────────────────────────── */}
      <H2 id="workflow">Workflow</H2>
      <P>
        The tool follows a five-step pipeline. Each step is discrete — you can stop after
        getting a report, or continue all the way through remediation and re-analysis.
      </P>
      <ol className="space-y-4 mb-6">
        {[
          ["Upload", "Drag one PDF (≤ 80 MB) onto the home page. A project record is auto-created to track this document over time. For batch analysis, select up to 10 files — each is analyzed independently."],
          ["Analyze", "GET /api/report/{session_id} is called, which opens the PDF with PyMuPDF and pikepdf, runs 13 checks in sequence, and caches the full report as JSON. Subsequent loads return the cached result instantly."],
          ["Review", "The report groups findings by category (Metadata, Structure, Images, Text, …). Each failing check shows the exact page, infringing element or text, and a specific recommended fix. Expand any check to see all findings."],
          ["Remediate", "Checks with automated fixes show an Approve Fix button. Approve fixes, supply custom values (title, language, alt text), then click Apply Fixes. The backend writes a new PDF in a single pass using pikepdf."],
          ["Re-analyze", "Click Re-analyze to run all 13 checks against the remediated PDF and see a before/after score comparison. The new score is stored in the project revision history."],
        ].map(([title, body], i) => (
          <li key={i} className="flex gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-0.5">{title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* ── Scoring ──────────────────────────────────────────────────────────── */}
      <H2 id="scoring">Scoring methodology</H2>
      <P>
        Each check has a severity weight. The score is a weighted ratio of points earned
        to points possible, expressed as an integer 0–100.
      </P>
      <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Outcome</th>
              <th className="text-left px-4 py-2.5">Points earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="px-4 py-2.5">Pass</td><td className="px-4 py-2.5">Full weight</td></tr>
            <tr><td className="px-4 py-2.5">Warning (unvalidated)</td><td className="px-4 py-2.5">½ weight</td></tr>
            <tr><td className="px-4 py-2.5">Warning (manually validated)</td><td className="px-4 py-2.5">Full weight — score can reach 100</td></tr>
            <tr><td className="px-4 py-2.5">Fail</td><td className="px-4 py-2.5">0</td></tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Severity</th>
              <th className="text-left px-4 py-2.5">Weight</th>
              <th className="text-left px-4 py-2.5">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="px-4 py-2.5 font-medium text-red-600">Critical</td><td className="px-4 py-2.5">×3</td><td className="px-4 py-2.5">Blocks all or most AT access (no tags, no text layer)</td></tr>
            <tr><td className="px-4 py-2.5 font-medium text-orange-600">Major</td><td className="px-4 py-2.5">×2</td><td className="px-4 py-2.5">Significantly degrades AT experience (missing alt text, form labels)</td></tr>
            <tr><td className="px-4 py-2.5 font-medium text-slate-600">Minor</td><td className="px-4 py-2.5">×1</td><td className="px-4 py-2.5">Degrades experience for some users or specific AT (bookmarks, links)</td></tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Grade</th>
              <th className="text-left px-4 py-2.5">Score range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="px-4 py-2.5 font-bold text-emerald-600">A</td><td className="px-4 py-2.5">90–100</td></tr>
            <tr><td className="px-4 py-2.5 font-bold text-blue-600">B</td><td className="px-4 py-2.5">75–89</td></tr>
            <tr><td className="px-4 py-2.5 font-bold text-amber-600">C</td><td className="px-4 py-2.5">55–74</td></tr>
            <tr><td className="px-4 py-2.5 font-bold text-orange-600">D</td><td className="px-4 py-2.5">35–54</td></tr>
            <tr><td className="px-4 py-2.5 font-bold text-red-600">F</td><td className="px-4 py-2.5">0–34</td></tr>
          </tbody>
        </table>
      </div>

      {/* ── Checks ───────────────────────────────────────────────────────────── */}
      <H2 id="checks">Check methodology</H2>
      <P>
        All 13 checks run against the original uploaded PDF. Analysis uses{" "}
        <strong>PyMuPDF (fitz)</strong> for text/image extraction and{" "}
        <strong>pikepdf</strong> for PDF structure inspection. Each check is independent
        — a failure in one does not affect others.
      </P>

      <CheckEntry name="Document Title" standard="WCAG 2.4.2" severity="major" autofix weight={2}>
        <p><strong>What it checks:</strong> The <code className="bg-slate-100 px-1 rounded text-xs">/Title</code> entry in the PDF&apos;s Info dictionary (and optionally the XMP metadata stream).</p>
        <p><strong>Method:</strong> <code className="bg-slate-100 px-1 rounded text-xs">pikepdf.Pdf.open() → pdf.docinfo[&quot;/Title&quot;]</code>. Fails if the key is absent or its value is an empty string after stripping whitespace.</p>
        <p><strong>Auto-fix:</strong> The approved title is written to <code className="bg-slate-100 px-1 rounded text-xs">/Info /Title</code> using pikepdf. The inline editor on the report page lets you type the value before applying.</p>
      </CheckEntry>

      <CheckEntry name="Document Language" standard="WCAG 3.1.1" severity="major" autofix weight={2}>
        <p><strong>What it checks:</strong> The <code className="bg-slate-100 px-1 rounded text-xs">/Lang</code> entry on the document catalog (root object).</p>
        <p><strong>Method:</strong> <code className="bg-slate-100 px-1 rounded text-xs">pdf.Root.get(&quot;/Lang&quot;)</code>. Fails if absent or empty. Common valid values: <code className="bg-slate-100 px-1 rounded text-xs">en-US</code>, <code className="bg-slate-100 px-1 rounded text-xs">fr-CA</code>, <code className="bg-slate-100 px-1 rounded text-xs">es</code>.</p>
        <p><strong>Auto-fix:</strong> Sets <code className="bg-slate-100 px-1 rounded text-xs">pdf.Root[&quot;/Lang&quot;] = pikepdf.String(&quot;en-US&quot;)</code> (or the user-supplied value).</p>
      </CheckEntry>

      <CheckEntry name="Tagged PDF / Structure Tree" standard="PDF/UA-1" severity="critical" autofix={false} weight={3}>
        <p><strong>What it checks:</strong> The presence of <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code> in the document catalog and <code className="bg-slate-100 px-1 rounded text-xs">/MarkInfo &lt;&lt;/Marked true&gt;&gt;</code>.</p>
        <p><strong>Method:</strong> <code className="bg-slate-100 px-1 rounded text-xs">&quot;/StructTreeRoot&quot; in pdf.Root</code>. Fails hard if absent — without a structure tree, screen readers have no semantic roadmap for the document.</p>
        <p><strong>No auto-fix</strong> — structure tagging requires authoring-time decisions about element roles. Use the <strong>Tagging Wizard</strong> (Tag This PDF button) to assign roles interactively and inject a <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code>.</p>
      </CheckEntry>

      <CheckEntry name="Image Alternative Text" standard="WCAG 1.1.1" severity="major" autofix weight={2}>
        <p><strong>What it checks:</strong> Every XObject image referenced across all pages. For each image, the check looks for an <code className="bg-slate-100 px-1 rounded text-xs">/Alt</code> entry on the corresponding Figure structure element.</p>
        <p><strong>Method:</strong> PyMuPDF iterates page images via <code className="bg-slate-100 px-1 rounded text-xs">page.get_images()</code>. For each image, the structure tree is queried for a matching Figure element. If <code className="bg-slate-100 px-1 rounded text-xs">/Alt</code> is missing or empty, a finding is recorded with the image index and page number.</p>
        <p><strong>Auto-fix:</strong> Writes <code className="bg-slate-100 px-1 rounded text-xs">/Alt</code> strings to Figure elements in the structure tree using pikepdf. Supply alt text in the inline editors, or click <strong>Generate with AI</strong> to use Claude Vision (requires <code className="bg-slate-100 px-1 rounded text-xs">ANTHROPIC_API_KEY</code>). AI-generated suggestions use <code className="bg-slate-100 px-1 rounded text-xs">claude-haiku-4-5-20251001</code> with a cropped page image as context.</p>
      </CheckEntry>

      <CheckEntry name="Heading Hierarchy" standard="WCAG 1.3.1" severity="major" autofix={false} weight={2}>
        <p><strong>What it checks:</strong> The sequence of H1–H6 elements in the structure tree for skipped heading levels (e.g. H1 → H3 with no H2) and for documents with no H1 at all.</p>
        <p><strong>Method:</strong> Traverses <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code> depth-first via pikepdf, collecting all <code className="bg-slate-100 px-1 rounded text-xs">/S</code> (subtype) values that match <code className="bg-slate-100 px-1 rounded text-xs">H[1-6]</code>. Compares consecutive heading levels — a jump of more than +1 is flagged. Falls back to font-size heuristics if no structure tree is present.</p>
        <p><strong>No auto-fix</strong> — heading structure is a document authoring decision. Fix at the source document and re-export, or reassign roles in the Tagging Wizard.</p>
      </CheckEntry>

      <CheckEntry name="Table Headers" standard="WCAG 1.3.1" severity="major" autofix={false} weight={2}>
        <p><strong>What it checks:</strong> Table elements in the structure tree for the presence of TH (header) cells with <code className="bg-slate-100 px-1 rounded text-xs">/Scope</code> attributes (<code className="bg-slate-100 px-1 rounded text-xs">Row</code>, <code className="bg-slate-100 px-1 rounded text-xs">Column</code>, or <code className="bg-slate-100 px-1 rounded text-xs">Both</code>).</p>
        <p><strong>Method:</strong> Finds all <code className="bg-slate-100 px-1 rounded text-xs">Table</code> structure elements, walks their children for <code className="bg-slate-100 px-1 rounded text-xs">TR → TH</code> elements, checks each TH for a <code className="bg-slate-100 px-1 rounded text-xs">/A</code> attributes dictionary containing <code className="bg-slate-100 px-1 rounded text-xs">/Scope</code>. Fails if any table has no TH elements, or any TH lacks a Scope.</p>
        <p><strong>No auto-fix</strong> — scope attribute assignment requires knowledge of table semantics. Fix in the authoring tool or add via Acrobat Pro&apos;s Table Editor.</p>
      </CheckEntry>

      <CheckEntry name="Form Field Labels" standard="WCAG 1.3.1" severity="major" autofix={false} weight={2}>
        <p><strong>What it checks:</strong> All AcroForm field dictionaries for accessible names — specifically the <code className="bg-slate-100 px-1 rounded text-xs">/TU</code> (tooltip/alternate description) entry, which is what screen readers read for form fields.</p>
        <p><strong>Method:</strong> Opens <code className="bg-slate-100 px-1 rounded text-xs">pdf.Root[&quot;/AcroForm&quot;][&quot;/Fields&quot;]</code>, recursively flattens all field dictionaries, checks each for <code className="bg-slate-100 px-1 rounded text-xs">/TU</code>. The partial name (<code className="bg-slate-100 px-1 rounded text-xs">/T</code>) is used as a fallback label in the finding. Only interactive form fields (not signatures or pushbuttons without labels) are checked.</p>
        <p><strong>No auto-fix</strong> — accessible names must be meaningful text supplied by the document author.</p>
      </CheckEntry>

      <CheckEntry name="Bookmarks / Navigation" standard="PDF/UA-1" severity="minor" autofix weight={1}>
        <p><strong>What it checks:</strong> The presence of an <code className="bg-slate-100 px-1 rounded text-xs">/Outlines</code> (bookmark tree) for documents with more than one page.</p>
        <p><strong>Method:</strong> <code className="bg-slate-100 px-1 rounded text-xs">&quot;/Outlines&quot; in pdf.Root</code> combined with a page count check. Single-page documents pass automatically. Multi-page documents without bookmarks fail.</p>
        <p><strong>Auto-fix:</strong> Builds a flat bookmark tree from the structure tree&apos;s H1/H2 elements (if present) or from page labels. Writes <code className="bg-slate-100 px-1 rounded text-xs">/Outlines</code> to the catalog. If no heading structure exists, generates one entry per page.</p>
      </CheckEntry>

      <CheckEntry name="Descriptive Link Text" standard="WCAG 2.4.4" severity="minor" autofix={false} weight={1}>
        <p><strong>What it checks:</strong> All Link annotations across every page for non-descriptive link text — phrases like &quot;click here&quot;, &quot;here&quot;, &quot;more&quot;, &quot;read more&quot;, &quot;this link&quot;, or bare URLs used as visible text.</p>
        <p><strong>Method:</strong> PyMuPDF extracts link annotations via <code className="bg-slate-100 px-1 rounded text-xs">page.get_links()</code> and the surrounding text via <code className="bg-slate-100 px-1 rounded text-xs">page.get_textbox(rect)</code>. Each link&apos;s visible text is compared against a blocklist of known non-descriptive strings (case-insensitive). Bare <code className="bg-slate-100 px-1 rounded text-xs">http://</code> URLs used as link text are also flagged.</p>
        <p><strong>No auto-fix</strong> — descriptive text requires human judgment about context.</p>
      </CheckEntry>

      <CheckEntry name="Font Embedding" standard="PDF/UA-1" severity="minor" autofix={false} weight={1}>
        <p><strong>What it checks:</strong> Every font referenced in page resource dictionaries for an embedded font program (<code className="bg-slate-100 px-1 rounded text-xs">/FontFile</code>, <code className="bg-slate-100 px-1 rounded text-xs">/FontFile2</code>, or <code className="bg-slate-100 px-1 rounded text-xs">/FontFile3</code> in <code className="bg-slate-100 px-1 rounded text-xs">/FontDescriptor</code>).</p>
        <p><strong>Method:</strong> Iterates <code className="bg-slate-100 px-1 rounded text-xs">page.Resources[&quot;/Font&quot;]</code> for each page. For each font, resolves the indirect object and inspects <code className="bg-slate-100 px-1 rounded text-xs">/FontDescriptor</code>. Standard 14 PDF fonts (Helvetica, Times, Courier, etc.) are excluded from the check as they are universally available in AT. Composite fonts (Type0) with <code className="bg-slate-100 px-1 rounded text-xs">/DescendantFonts</code> are unwrapped before inspection.</p>
        <p><strong>No auto-fix</strong> — font subsetting/embedding must be done at export time from the authoring tool.</p>
      </CheckEntry>

      <CheckEntry name="Color Contrast" standard="WCAG 1.4.3" severity="critical" autofix={false} weight={3}>
        <p><strong>What it checks:</strong> Text spans with foreground colors that may be too light to meet the 4.5:1 contrast ratio requirement against a white background.</p>
        <p><strong>Method (heuristic):</strong> PyMuPDF extracts all text spans via <code className="bg-slate-100 px-1 rounded text-xs">page.get_text(&quot;dict&quot;)</code>, which returns each span&apos;s color as a 24-bit RGB integer. Luminance is computed as <code className="bg-slate-100 px-1 rounded text-xs">0.299R + 0.587G + 0.114B</code>. Spans with luminance &gt; 210 (out of 255) are flagged as potentially low-contrast. Each finding shows the exact text snippet and hex color code.</p>
        <p><strong>Limitation:</strong> This is a luminance heuristic, not a true contrast ratio calculation. It cannot read the background color from the PDF content stream without rendering the page. False positives are possible for dark-background designs. Always verify flagged colors manually with a contrast checker.</p>
        <p><strong>No auto-fix</strong> — color changes require source document edits.</p>
      </CheckEntry>

      <CheckEntry name="Logical Reading Order" standard="WCAG 1.3.2" severity="critical" autofix={false} weight={3}>
        <p><strong>What it checks:</strong> Whether a structure tree exists (pass path) and whether content-stream order matches visual reading order (warning path).</p>
        <p><strong>Method:</strong> If no <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code> is present: <strong>Fail</strong> — reading order is entirely undefined and screen readers fall back to raw content-stream order. If a structure tree is present: <strong>Warning</strong> — the structure tree defines reading order semantically, but automated tools cannot fully verify that the tree order matches the visual layout without rendering each page and comparing bounding boxes.</p>
        <p><strong>Manual validation:</strong> Expand this check in the report and click <strong>Mark Validation Complete</strong> after verifying with Adobe Acrobat Pro&apos;s Reading Order panel or PAC 2024. When validated, this check earns full score weight and the document can reach 100/100.</p>
        <p><strong>No auto-fix</strong> — reading order correctness is a structural property of the PDF content stream.</p>
      </CheckEntry>

      <CheckEntry name="Encryption / Security" standard="WCAG 4.1.1" severity="critical" autofix={false} weight={3}>
        <p><strong>What it checks:</strong> The <code className="bg-slate-100 px-1 rounded text-xs">/Encrypt</code> dictionary in the PDF trailer for permission flags that restrict assistive technology access.</p>
        <p><strong>Method:</strong> pikepdf exposes encryption state via <code className="bg-slate-100 px-1 rounded text-xs">pdf.is_encrypted</code> and permission flags via <code className="bg-slate-100 px-1 rounded text-xs">pdf.allow</code>. Specifically checks <code className="bg-slate-100 px-1 rounded text-xs">allow.accessibility</code> — if this flag is false, screen readers are legally blocked by the DRM layer. Also checks for open-password protection, which prevents AT from opening the file at all.</p>
        <p><strong>No auto-fix</strong> — removing encryption requires the owner password and a deliberate decision about document security posture.</p>
      </CheckEntry>

      {/* ── Remediation ──────────────────────────────────────────────────────── */}
      <H2 id="remediation">Remediation pipeline</H2>
      <P>
        When you click <strong>Apply Fixes</strong>, the backend runs{" "}
        <code className="bg-slate-100 px-1 rounded text-xs">remediator.apply_fixes()</code> which processes
        all approved fix IDs in a single pikepdf pass:
      </P>
      <ol className="space-y-2 mb-6 list-decimal list-inside text-sm text-slate-600">
        <li>Opens the original uploaded PDF (never mutates it)</li>
        <li>Applies metadata fixes (title, language, PDF/UA identifier)</li>
        <li>Writes alt text strings to Figure structure elements</li>
        <li>Builds or replaces the bookmark tree from structure headings</li>
        <li>Saves the result to <code className="bg-slate-100 px-1 rounded text-xs">storage/remediated/{"{"}session_id{"}"}.pdf</code></li>
      </ol>
      <P>
        The original PDF is preserved at{" "}
        <code className="bg-slate-100 px-1 rounded text-xs">storage/uploads/{"{"}session_id{"}"}/original.pdf</code>.
        You can re-run remediation with different selections — each run overwrites the previous remediated output.
      </P>

      {/* ── Structure tree wizard ────────────────────────────────────────────── */}
      <H3>Structure tree tagging wizard</H3>
      <P>
        For PDFs that lack any structure tree, the <strong>Tag This PDF</strong> button opens an
        interactive wizard. The backend runs{" "}
        <code className="bg-slate-100 px-1 rounded text-xs">element_extractor.extract_elements()</code>{" "}
        which uses PyMuPDF to enumerate every text block and image per page, computing:
      </P>
      <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 mb-4">
        <li>Bounding box, font size, and bold/italic flags for text blocks</li>
        <li>An auto-suggested semantic role based on font-size percentile ranking (largest = H1, next = H2, body-size = P)</li>
        <li>Image dimensions and position for Figure elements</li>
      </ul>
      <P>
        You review and correct the role assignments, then submit. The backend calls{" "}
        <code className="bg-slate-100 px-1 rounded text-xs">structure_builder.build_structure_tree()</code>{" "}
        which injects a <code className="bg-slate-100 px-1 rounded text-xs">/StructTreeRoot</code> with correctly typed child elements
        (H1–H6, P, Figure, Table, L, Artifact) and writes <code className="bg-slate-100 px-1 rounded text-xs">/MarkInfo &lt;&lt;/Marked true&gt;&gt;</code>.
      </P>

      {/* ── Limitations ──────────────────────────────────────────────────────── */}
      <H2 id="limitations">Known limitations</H2>
      <ul className="space-y-3 text-sm text-slate-600 mb-8">
        {[
          ["Color contrast is heuristic", "Luminance threshold (>210/255) approximates likely contrast failures but is not a true WCAG ratio calculation. Background color cannot be read from the PDF content stream without rendering. Use a dedicated contrast checker (e.g. Colour Contrast Analyser) to confirm."],
          ["Structure tree without MCID linkage", "The tagging wizard injects /StructTreeRoot but does not add Marked Content ID (MCID) markers into the content stream. PAC 2024 and Acrobat's accessibility checker will pass; real AT navigation to specific elements may still be limited until MCIDs are added."],
          ["Scanned PDFs", "Image-only PDFs with no text layer cannot be checked for most criteria. The scanned-image check detects this and reports it, but the tool cannot perform OCR. Use Adobe Acrobat Pro, ABBYY FineReader, or Tesseract to add a text layer first."],
          ["Complex table structures", "The table header check detects TH elements and Scope attributes but cannot verify that ID/Headers associations are semantically correct for irregular merged-cell tables. Verify complex tables with a screen reader."],
          ["File-based storage", "All data is stored as JSON files on disk. This is suitable for single-user or small-team use; concurrent writes from multiple users to the same session are not safe without a locking layer."],
        ].map(([title, body]) => (
          <li key={String(title)} className="flex gap-3">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
            <div>
              <span className="font-semibold text-slate-700">{title}: </span>
              {body}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
          <Upload className="w-4 h-4" /> Upload a PDF
        </Link>
      </div>
    </div>
  );
}
