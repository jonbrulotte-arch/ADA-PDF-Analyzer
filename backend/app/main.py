import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .alt_text_generator import generate_alt_texts
from .analyzer import analyze_pdf
from .element_extractor import extract_elements
from .structure_builder import build_structure_tree
from .models import (
    AccessibilityReport,
    AltTextResponse,
    AppSettings,
    AppSettingsResponse,
    BatchManifest,
    BatchSessionSummary,
    BatchUploadResponse,
    CreateProjectRequest,
    HistoryEntry,
    LinkSessionRequest,
    PatchProjectRequest,
    PatchRevisionRequest,
    PatchStateRequest,
    Project,
    ProjectListResponse,
    ProjectRevision,
    ProjectStatus,
    ProjectSummary,
    ReanalyzeResponse,
    RemediateRequest,
    RemediateResponse,
    SessionState,
    UploadResponse,
)
from .project_store import (
    add_revision,
    create_project,
    delete_project as delete_project_record,
    list_projects,
    load_project,
    remove_revision,
    save_project,
    update_revision,
)
from .remediator import apply_fixes
from .report_exporter import render_html_report
from .session_store import (
    append_history,
    delete_history_entry,
    get_or_create_state,
    load_batch,
    load_history,
    load_settings,
    load_state,
    save_batch,
    save_settings,
    save_state,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./storage"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

for _d in ("uploads", "reports", "remediated", "session_states", "batches"):
    (STORAGE_DIR / _d).mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

_DESCRIPTION = """
## ADA PDF Analyzer — REST API

Analyze, remediate, and manage PDF accessibility compliance across your document library.

### Core workflow

1. **Upload** a PDF → receive a `session_id` and auto-created `project_id`
2. **GET report** to run all 13 accessibility checks (WCAG 2.1 AA · Section 508 · PDF/UA-1)
3. **Remediate** — approve selected fixes, supply custom alt text, download the improved PDF
4. **Re-analyze** the remediated PDF to see score improvement

### Checks performed

| Check | Standard | Auto-fix |
|---|---|---|
| Document title | WCAG 2.4.2 | ✅ |
| Document language | WCAG 3.1.1 | ✅ |
| Tagged PDF / structure tree | PDF/UA-1 | — |
| Image alternative text | WCAG 1.1.1 | ✅ |
| Heading hierarchy | WCAG 1.3.1 | — |
| Table headers | WCAG 1.3.1 | — |
| Form field labels | WCAG 1.3.1 | — |
| Bookmarks / navigation | PDF/UA-1 | ✅ |
| Descriptive link text | WCAG 2.4.4 | — |
| Font embedding | PDF/UA-1 | — |
| Color contrast (heuristic) | WCAG 1.4.3 | — |
| Logical reading order | WCAG 1.3.2 | — |
| Encryption / security | WCAG 4.1.1 | — |

### Project management

Every upload is automatically linked to a **Project**. Projects track multiple PDF revisions
over time — useful for iterative remediation workflows. Projects are queryable by assignee,
status, and free-text search.

**Project statuses:** `active` · `in_review` · `remediated` · `approved` · `archived`

### AI features

Set `ANTHROPIC_API_KEY` to enable AI-generated alt text suggestions via Claude Vision
(`claude-haiku-4-5-20251001`). All other checks run without an API key.

### Interactive docs
- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI schema: `/openapi.json`
"""

app = FastAPI(
    title="ADA PDF Analyzer",
    version="2.0.0",
    description=_DESCRIPTION,
    contact={"name": "ADA PDF Analyzer", "url": "https://github.com/jonbrulotte-arch/ada-pdf-analyzer"},
    license_info={"name": "MIT"},
    openapi_tags=[
        {"name": "upload",    "description": "Upload PDFs and trigger analysis"},
        {"name": "report",    "description": "Retrieve and export accessibility reports"},
        {"name": "remediate", "description": "Apply automated fixes and download remediated PDFs"},
        {"name": "projects",  "description": "Project records — track revisions across multiple analyses"},
        {"name": "session",   "description": "Per-session state, AI alt text generation, and re-analysis"},
        {"name": "batch",     "description": "Bulk upload and analyze up to 10 PDFs at once"},
        {"name": "history",   "description": "Global analysis history log"},
        {"name": "settings",  "description": "Application settings"},
        {"name": "tagging",   "description": "Guided structure tree tagging wizard"},
        {"name": "health",    "description": "Health check"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _session_dir(session_id: str) -> Path:
    d = STORAGE_DIR / "uploads" / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _report_path(session_id: str) -> Path:
    return STORAGE_DIR / "reports" / f"{session_id}.json"


def _load_report(session_id: str) -> AccessibilityReport:
    p = _report_path(session_id)
    if not p.exists():
        raise HTTPException(404, f"Report not found for session {session_id}")
    return AccessibilityReport.model_validate_json(p.read_text())


def _save_report(report: AccessibilityReport) -> None:
    _report_path(report.session_id).write_text(report.model_dump_json(indent=2))


def _get_filename(session_id: str) -> str:
    meta = _session_dir(session_id) / "meta.json"
    if meta.exists():
        return json.loads(meta.read_text()).get("filename", "document.pdf")
    return "document.pdf"


def _get_meta(session_id: str) -> dict:
    meta = _session_dir(session_id) / "meta.json"
    if meta.exists():
        return json.loads(meta.read_text())
    return {}


# ---------------------------------------------------------------------------
# Routes — Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"], summary="Health check")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Routes — Upload & Analyze
# ---------------------------------------------------------------------------

@app.post(
    "/api/upload",
    response_model=UploadResponse,
    tags=["upload"],
    summary="Upload a PDF for analysis",
    description=(
        "Upload a single PDF (≤ 80 MB). A project record is auto-created (or the file is appended "
        "to an existing project when `project_id` is supplied). Returns `session_id` and `project_id` "
        "for all subsequent operations. Analysis does **not** run at upload time — call `GET /api/report/{session_id}` to trigger it."
    ),
)
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: Optional[str] = Query(default=None, description="Existing project UUID to append this upload to as a new revision. Omit to auto-create a new project."),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")

    session_id = str(uuid.uuid4())
    sdir = _session_dir(session_id)
    dest = sdir / "original.pdf"

    size = 0
    with dest.open("wb") as f:
        chunk = await file.read(65536)
        while chunk:
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
            f.write(chunk)
            chunk = await file.read(65536)

    try:
        import fitz
        doc = fitz.open(str(dest))
        page_count = doc.page_count
        doc.close()
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, f"Could not open PDF: {e}")

    # Resolve or auto-create project
    proj: Project | None = None
    if project_id:
        proj = load_project(project_id)

    if proj is None:
        stem = Path(file.filename).stem
        now = datetime.now(timezone.utc).isoformat()
        proj = Project(
            project_id=str(uuid.uuid4()),
            name=stem,
            created_at=now,
            updated_at=now,
        )
        create_project(proj)

    # Build revision label
    next_label = f"v{len(proj.revisions) + 1}"

    revision = ProjectRevision(
        session_id=session_id,
        filename=file.filename,
        score=0,      # score not known yet — updated after analysis
        grade="?",
        page_count=page_count,
        file_size_kb=size // 1024,
        created_at=datetime.now(timezone.utc).isoformat(),
        label=next_label,
    )
    add_revision(proj.project_id, revision)

    # Persist metadata so later endpoints know the original filename and project
    (sdir / "meta.json").write_text(json.dumps({
        "filename": file.filename,
        "size_kb": size // 1024,
        "project_id": proj.project_id,
    }))

    return UploadResponse(
        session_id=session_id,
        filename=file.filename,
        page_count=page_count,
        file_size_kb=size // 1024,
        project_id=proj.project_id,
    )


@app.get(
    "/api/report/{session_id}",
    response_model=AccessibilityReport,
    tags=["report"],
    summary="Get (or run) accessibility report",
    description=(
        "Run all 13 accessibility checks against the uploaded PDF and return the full report. "
        "Results are cached — subsequent calls return the same report instantly. "
        "Also updates the linked project revision score/grade and appends to the global history log."
    ),
)
def get_report(session_id: str):
    """Analyze the uploaded PDF (cached after first run)."""
    if _report_path(session_id).exists():
        report = _load_report(session_id)
        report.project_id = _get_meta(session_id).get("project_id", "")
        return report

    pdf_path = _session_dir(session_id) / "original.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "No uploaded PDF found for this session.")

    filename = _get_filename(session_id)

    try:
        report = analyze_pdf(str(pdf_path), session_id, filename)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    _save_report(report)

    # Append to history after first successful analysis
    try:
        append_history(
            HistoryEntry(
                session_id=session_id,
                filename=report.filename,
                score=report.summary.score,
                grade=report.summary.grade,
                page_count=report.page_count,
                file_size_kb=report.file_size_kb,
                created_at=report.created_at,
            )
        )
    except Exception:
        pass  # history failure should never break the main response

    # Update project revision score/grade and inject project_id into response
    try:
        meta = _get_meta(session_id)
        pid = meta.get("project_id", "")
        report.project_id = pid
        if pid:
            proj = load_project(pid)
            if proj:
                for rev in proj.revisions:
                    if rev.session_id == session_id:
                        rev.score = report.summary.score
                        rev.grade = report.summary.grade
                        save_project(proj)
                        break
    except Exception:
        pass

    return report


# ---------------------------------------------------------------------------
# Routes — Remediate & Download
# ---------------------------------------------------------------------------

@app.post(
    "/api/remediate/{session_id}",
    response_model=RemediateResponse,
    tags=["remediate"],
    summary="Apply approved fixes and generate remediated PDF",
    description=(
        "Apply a set of approved fix IDs to the original PDF. Optionally supply custom alt text strings "
        "(`custom_alt_texts`), field values for inline editors (`finding_values`), and acknowledged-issue notes "
        "(`acknowledgments`). Returns the list of changes made and a `download_url`."
    ),
)
def remediate_pdf(session_id: str, body: RemediateRequest):
    report = _load_report(session_id)
    input_path = str(_session_dir(session_id) / "original.pdf")
    output_path = str(STORAGE_DIR / "remediated" / f"{session_id}.pdf")

    try:
        changes = apply_fixes(
            report,
            body.approved_fix_ids,
            input_path,
            output_path,
            custom_alt_texts=body.custom_alt_texts if body.custom_alt_texts else None,
            finding_values=body.finding_values if body.finding_values else None,
        )
    except Exception as e:
        raise HTTPException(500, f"Remediation failed: {e}")

    # Update session state with approved fixes and acknowledgments
    try:
        state = get_or_create_state(session_id)
        state.approved_fix_ids = list(body.approved_fix_ids)
        if body.acknowledgments:
            state.acknowledgments.update(body.acknowledgments)
        if body.custom_alt_texts:
            state.custom_alt_texts.update(body.custom_alt_texts)
        if body.finding_values:
            state.finding_values.update(body.finding_values)
        save_state(state)
    except Exception:
        pass  # state failure should not break the remediation response

    return RemediateResponse(
        session_id=session_id,
        changes_made=changes,
        download_url=f"/api/download/{session_id}",
    )


@app.get("/api/download/{session_id}", tags=["remediate"], summary="Download the remediated PDF")
def download_pdf(session_id: str):
    output_path = STORAGE_DIR / "remediated" / f"{session_id}.pdf"
    if not output_path.exists():
        raise HTTPException(404, "Remediated PDF not found. Apply fixes first.")

    filename = _get_filename(session_id)
    safe_name = filename.replace(".pdf", "-accessible.pdf")

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


# ---------------------------------------------------------------------------
# Routes — Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings", response_model=AppSettingsResponse, tags=["settings"], summary="Get application settings")
def get_settings():
    settings = load_settings()
    has_api_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    return AppSettingsResponse(
        ai_alt_text_enabled=settings.ai_alt_text_enabled,
        has_api_key=has_api_key,
    )


@app.patch("/api/settings", response_model=AppSettingsResponse, tags=["settings"], summary="Update application settings")
def patch_settings(body: dict):
    settings = load_settings()
    if "ai_alt_text_enabled" in body:
        settings.ai_alt_text_enabled = bool(body["ai_alt_text_enabled"])
    save_settings(settings)
    has_api_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    return AppSettingsResponse(
        ai_alt_text_enabled=settings.ai_alt_text_enabled,
        has_api_key=has_api_key,
    )


# ---------------------------------------------------------------------------
# Routes — Session State
# ---------------------------------------------------------------------------

@app.get("/api/session/{session_id}/state", response_model=SessionState, tags=["session"], summary="Get session state")
def get_session_state(session_id: str):
    return get_or_create_state(session_id)


@app.put("/api/session/{session_id}/state", response_model=SessionState, tags=["session"], summary="Replace session state")
def put_session_state(session_id: str, body: SessionState):
    body.session_id = session_id  # enforce consistency
    save_state(body)
    return body


@app.patch("/api/session/{session_id}/state", response_model=SessionState, tags=["session"], summary="Partially update session state")
def patch_session_state(session_id: str, body: PatchStateRequest):
    state = get_or_create_state(session_id)
    if body.approved_fix_ids is not None:
        state.approved_fix_ids = body.approved_fix_ids
    if body.custom_alt_texts is not None:
        state.custom_alt_texts = body.custom_alt_texts
    if body.acknowledgments is not None:
        state.acknowledgments = body.acknowledgments
    if body.finding_values is not None:
        state.finding_values = body.finding_values
    save_state(state)
    return state


# ---------------------------------------------------------------------------
# Routes — AI Alt Text Generation
# ---------------------------------------------------------------------------

@app.post(
    "/api/session/{session_id}/generate-alt-text",
    response_model=AltTextResponse,
    tags=["session"],
    summary="AI-generate alt text for images",
    description="Requires `ANTHROPIC_API_KEY` and AI alt text enabled in settings. Uses Claude Vision to describe each figure missing alt text.",
)
def generate_alt_text_endpoint(session_id: str, body: dict):
    check_id = body.get("check_id")
    if not check_id:
        raise HTTPException(400, "check_id is required.")

    # Check settings
    settings = load_settings()
    if not settings.ai_alt_text_enabled:
        raise HTTPException(400, "AI alt text generation is disabled. Enable it in settings.")

    if not os.getenv("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(400, "ANTHROPIC_API_KEY is not configured on the server.")

    # Load report and find the check
    report = _load_report(session_id)
    target_check = None
    for check in report.checks:
        if check.id == check_id:
            target_check = check
            break

    if target_check is None:
        raise HTTPException(404, f"Check {check_id} not found in report.")

    if not target_check.fix or not target_check.fix.fix_data:
        raise HTTPException(400, "This check has no fix data with figures to process.")

    figures_missing = target_check.fix.fix_data.get("figures_missing", [])
    if not figures_missing:
        raise HTTPException(400, "No missing figures found in fix data.")

    pdf_path = str(_session_dir(session_id) / "original.pdf")
    if not Path(pdf_path).exists():
        raise HTTPException(404, "Original PDF not found for this session.")

    # Generate alt texts
    alt_texts = generate_alt_texts(pdf_path, figures_missing)

    # Store results in session state
    try:
        state = get_or_create_state(session_id)
        state.custom_alt_texts.update(alt_texts)
        save_state(state)
    except Exception:
        pass

    return AltTextResponse(check_id=check_id, alt_texts=alt_texts)


# ---------------------------------------------------------------------------
# Routes — Re-analyze
# ---------------------------------------------------------------------------

@app.post(
    "/api/session/{session_id}/reanalyze",
    response_model=ReanalyzeResponse,
    tags=["session"],
    summary="Re-analyze the remediated PDF",
    description="Runs all 13 checks against the remediated PDF and returns before/after score comparison. Requires a remediated PDF (call `/api/remediate/{session_id}` first).",
)
def reanalyze_pdf(session_id: str):
    remediated_path = STORAGE_DIR / "remediated" / f"{session_id}.pdf"
    if not remediated_path.exists():
        raise HTTPException(404, "Remediated PDF not found. Apply fixes first before re-analyzing.")

    original_report = _load_report(session_id)
    score_before = original_report.summary.score

    filename = _get_filename(session_id)

    try:
        new_report = analyze_pdf(str(remediated_path), session_id, filename)
    except Exception as e:
        raise HTTPException(500, f"Re-analysis failed: {e}")

    # Save as v2 report
    v2_path = STORAGE_DIR / "reports" / f"{session_id}_v2.json"
    v2_path.write_text(new_report.model_dump_json(indent=2))

    score_after = new_report.summary.score

    # Update session state
    try:
        state = get_or_create_state(session_id)
        state.reanalysis_done = True
        state.score_before = score_before
        state.score_after = score_after
        save_state(state)
    except Exception:
        pass

    return ReanalyzeResponse(
        session_id=session_id,
        score_before=score_before,
        score_after=score_after,
        new_report=new_report,
    )


# ---------------------------------------------------------------------------
# Routes — HTML Export
# ---------------------------------------------------------------------------

@app.get("/api/session/{session_id}/export-html", tags=["report"], summary="Export report as HTML")
def export_html_report(session_id: str):
    report = _load_report(session_id)
    state = get_or_create_state(session_id)

    try:
        html_content = render_html_report(report, state)
    except Exception as e:
        raise HTTPException(500, f"Failed to render HTML report: {e}")

    filename = f"accessibility-report-{session_id[:8]}.html"
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Routes — Batch Upload
# ---------------------------------------------------------------------------

@app.post(
    "/api/batch/upload",
    response_model=BatchUploadResponse,
    tags=["batch"],
    summary="Batch-upload up to 10 PDFs",
    description="Upload 1–10 PDFs in a single multipart request. Each file is analyzed immediately. Returns a `batch_id` and per-file results.",
)
async def batch_upload(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files provided.")
    if len(files) > 10:
        raise HTTPException(400, "Maximum 10 files per batch upload.")

    # Validate all files are PDFs
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            raise HTTPException(400, f"File '{f.filename}' is not a PDF. Only PDF files are accepted.")

    batch_id = str(uuid.uuid4())
    sessions: list[BatchSessionSummary] = []

    for file in files:
        session_id = str(uuid.uuid4())
        sdir = _session_dir(session_id)
        dest = sdir / "original.pdf"

        try:
            # Save the file
            size = 0
            with dest.open("wb") as fp:
                chunk = await file.read(65536)
                while chunk:
                    size += len(chunk)
                    if size > MAX_UPLOAD_BYTES:
                        dest.unlink(missing_ok=True)
                        raise ValueError(f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
                    fp.write(chunk)
                    chunk = await file.read(65536)

            # Validate PDF
            import fitz
            doc = fitz.open(str(dest))
            page_count = doc.page_count
            doc.close()

            # Save meta
            (sdir / "meta.json").write_text(
                json.dumps({"filename": file.filename, "size_kb": size // 1024})
            )

            # Analyze
            report = analyze_pdf(str(dest), session_id, file.filename)
            _save_report(report)

            # Append to history
            try:
                append_history(
                    HistoryEntry(
                        session_id=session_id,
                        filename=report.filename,
                        score=report.summary.score,
                        grade=report.summary.grade,
                        page_count=report.page_count,
                        file_size_kb=report.file_size_kb,
                        created_at=report.created_at,
                    )
                )
            except Exception:
                pass

            sessions.append(
                BatchSessionSummary(
                    session_id=session_id,
                    filename=file.filename,
                    score=report.summary.score,
                    grade=report.summary.grade,
                    page_count=page_count,
                    status="done",
                )
            )

        except Exception as e:
            sessions.append(
                BatchSessionSummary(
                    session_id=session_id,
                    filename=file.filename or "unknown.pdf",
                    score=0,
                    grade="F",
                    page_count=0,
                    status="error",
                    error=str(e),
                )
            )

    manifest = BatchManifest(
        batch_id=batch_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        sessions=sessions,
    )
    save_batch(manifest)

    return BatchUploadResponse(batch_id=batch_id, sessions=sessions)


@app.get("/api/batch/{batch_id}", response_model=BatchManifest, tags=["batch"], summary="Get batch results")
def get_batch(batch_id: str):
    manifest = load_batch(batch_id)
    if manifest is None:
        raise HTTPException(404, f"Batch {batch_id} not found.")
    return manifest


# ---------------------------------------------------------------------------
# Routes — Structure Tree Tagging Wizard
# ---------------------------------------------------------------------------

@app.get(
    "/api/session/{session_id}/elements",
    tags=["tagging"],
    summary="Extract page elements for tagging wizard",
    description="Returns every text block and image on each page with an auto-suggested semantic role (H1–H6, P, Figure, etc.) based on font size and weight.",
)
def get_elements(session_id: str):
    pdf_path = _session_dir(session_id) / "original.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "No uploaded PDF found for this session.")
    try:
        result = extract_elements(str(pdf_path))
        return {"session_id": session_id, **result}
    except Exception as e:
        raise HTTPException(500, f"Element extraction failed: {e}")


@app.post(
    "/api/session/{session_id}/build-structure-tree",
    tags=["tagging"],
    summary="Build and inject a PDF structure tree",
    description=(
        "Accepts an array of `{ element_id, role, alt_text? }` assignments and injects a "
        "`/StructTreeRoot` into the PDF. Satisfies automated PDF/UA checkers. "
        "Returns element count and `download_url` for the tagged PDF."
    ),
)
def build_structure_tree_endpoint(session_id: str, body: dict):
    assignments = body.get("assignments", [])
    if not assignments:
        raise HTTPException(400, "assignments list is required.")

    pdf_path = _session_dir(session_id) / "original.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "No uploaded PDF found for this session.")

    output_path = str(STORAGE_DIR / "remediated" / f"{session_id}.pdf")

    try:
        tagged_count = build_structure_tree(str(pdf_path), output_path, assignments)
    except Exception as e:
        raise HTTPException(500, f"Structure tree build failed: {e}")

    # Update session state
    try:
        state = get_or_create_state(session_id)
        state.approved_fix_ids = list(set(state.approved_fix_ids + ["structure_tree_built"]))
        save_state(state)
    except Exception:
        pass

    return {
        "session_id": session_id,
        "elements_tagged": tagged_count,
        "download_url": f"/api/download/{session_id}",
    }


# ---------------------------------------------------------------------------
# Routes — History
# ---------------------------------------------------------------------------

@app.get("/api/history", tags=["history"], summary="List analysis history")
def get_history(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    all_entries = load_history()
    total = len(all_entries)
    page = all_entries[offset: offset + limit]
    return {"entries": page, "total": total}


@app.delete("/api/history/{session_id}", tags=["history"], summary="Remove a history entry")
def delete_history(session_id: str):
    if not delete_history_entry(session_id):
        raise HTTPException(404, f"History entry {session_id} not found.")
    return {"deleted": session_id}


# ---------------------------------------------------------------------------
# Routes — Projects
# ---------------------------------------------------------------------------

@app.get("/api/projects", response_model=ProjectListResponse, tags=["projects"], summary="List projects")
def get_projects(
    search:   Optional[str]           = Query(default=None),
    status:   Optional[ProjectStatus] = Query(default=None),
    assignee: Optional[str]           = Query(default=None),
    sort:     str                     = Query(default="updated_at"),
    order:    str                     = Query(default="desc"),
    limit:    int                     = Query(default=50, ge=1, le=200),
    offset:   int                     = Query(default=0, ge=0),
):
    projects, total = list_projects(
        search=search, status=status, assignee=assignee,
        sort=sort, order=order, limit=limit, offset=offset,
    )
    return ProjectListResponse(projects=projects, total=total)


@app.post("/api/projects", response_model=Project, status_code=201, tags=["projects"], summary="Create a project")
def post_project(body: CreateProjectRequest):
    now = datetime.now(timezone.utc).isoformat()
    project = Project(
        project_id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        assignee=body.assignee,
        status=body.status,
        tags=body.tags,
        created_at=now,
        updated_at=now,
    )
    create_project(project)
    return project


@app.get("/api/projects/{project_id}", response_model=Project, tags=["projects"], summary="Get project (with revisions)")
def get_project(project_id: str):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    return project


@app.put("/api/projects/{project_id}", response_model=Project, tags=["projects"], summary="Replace project metadata")
def put_project(project_id: str, body: CreateProjectRequest):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    project.name        = body.name
    project.description = body.description
    project.assignee    = body.assignee
    project.status      = body.status
    project.tags        = body.tags
    save_project(project)
    return project


@app.patch("/api/projects/{project_id}", response_model=Project, tags=["projects"], summary="Partially update project")
def patch_project(project_id: str, body: PatchProjectRequest):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    if body.name        is not None: project.name        = body.name
    if body.description is not None: project.description = body.description
    if body.assignee    is not None: project.assignee    = body.assignee
    if body.status      is not None: project.status      = body.status
    if body.tags        is not None: project.tags        = body.tags
    save_project(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=204, tags=["projects"], summary="Delete a project")
def del_project(project_id: str):
    if not delete_project_record(project_id):
        raise HTTPException(404, f"Project {project_id} not found.")


# ---------------------------------------------------------------------------
# Routes — Revisions
# ---------------------------------------------------------------------------

@app.get("/api/projects/{project_id}/revisions", response_model=List[ProjectRevision], tags=["projects"], summary="List revisions")
def get_revisions(project_id: str):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    return project.revisions


@app.post("/api/projects/{project_id}/revisions", response_model=ProjectRevision, status_code=201, tags=["projects"], summary="Link a session as a new revision")
def post_revision(project_id: str, body: LinkSessionRequest):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    # Load session meta for filename/score
    meta = _get_meta(body.session_id)
    filename = meta.get("filename", "unknown.pdf")
    score, grade, page_count, file_size_kb = 0, "?", 0, 0
    try:
        report = _load_report(body.session_id)
        score        = report.summary.score
        grade        = report.summary.grade
        page_count   = report.page_count
        file_size_kb = report.file_size_kb
    except Exception:
        pass
    label = body.label or f"v{len(project.revisions) + 1}"
    revision = ProjectRevision(
        session_id=body.session_id,
        filename=filename,
        score=score,
        grade=grade,
        page_count=page_count,
        file_size_kb=file_size_kb,
        created_at=datetime.now(timezone.utc).isoformat(),
        label=label,
        notes=body.notes,
    )
    add_revision(project_id, revision)
    return revision


@app.get("/api/projects/{project_id}/revisions/{session_id}", response_model=ProjectRevision, tags=["projects"], summary="Get a single revision")
def get_revision(project_id: str, session_id: str):
    project = load_project(project_id)
    if project is None:
        raise HTTPException(404, f"Project {project_id} not found.")
    for rev in project.revisions:
        if rev.session_id == session_id:
            return rev
    raise HTTPException(404, f"Revision {session_id} not found in project.")


@app.patch("/api/projects/{project_id}/revisions/{session_id}", response_model=ProjectRevision, tags=["projects"], summary="Update revision label/notes/score")
def patch_revision(project_id: str, session_id: str, body: PatchRevisionRequest):
    rev = update_revision(project_id, session_id, body.label, body.notes, body.score, body.grade)
    if rev is None:
        raise HTTPException(404, "Project or revision not found.")
    return rev


@app.delete("/api/projects/{project_id}/revisions/{session_id}", status_code=204, tags=["projects"], summary="Remove a revision from a project")
def del_revision(project_id: str, session_id: str):
    if not remove_revision(project_id, session_id):
        raise HTTPException(404, "Project or revision not found.")
