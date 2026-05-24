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
    HistoryEntry,
    PatchStateRequest,
    ReanalyzeResponse,
    RemediateRequest,
    RemediateResponse,
    SessionState,
    UploadResponse,
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

app = FastAPI(title="ADA PDF Analyzer", version="1.0.0")

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

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Routes — Upload & Analyze
# ---------------------------------------------------------------------------

@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
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

    # Persist metadata so later endpoints know the original filename
    (sdir / "meta.json").write_text(json.dumps({"filename": file.filename, "size_kb": size // 1024}))

    return UploadResponse(
        session_id=session_id,
        filename=file.filename,
        page_count=page_count,
        file_size_kb=size // 1024,
    )


@app.get("/api/report/{session_id}", response_model=AccessibilityReport)
def get_report(session_id: str):
    """Analyze the uploaded PDF (cached after first run)."""
    if _report_path(session_id).exists():
        return _load_report(session_id)

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

    return report


# ---------------------------------------------------------------------------
# Routes — Remediate & Download
# ---------------------------------------------------------------------------

@app.post("/api/remediate/{session_id}", response_model=RemediateResponse)
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


@app.get("/api/download/{session_id}")
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

@app.get("/api/settings", response_model=AppSettingsResponse)
def get_settings():
    settings = load_settings()
    has_api_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    return AppSettingsResponse(
        ai_alt_text_enabled=settings.ai_alt_text_enabled,
        has_api_key=has_api_key,
    )


@app.patch("/api/settings", response_model=AppSettingsResponse)
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

@app.get("/api/session/{session_id}/state", response_model=SessionState)
def get_session_state(session_id: str):
    return get_or_create_state(session_id)


@app.put("/api/session/{session_id}/state", response_model=SessionState)
def put_session_state(session_id: str, body: SessionState):
    body.session_id = session_id  # enforce consistency
    save_state(body)
    return body


@app.patch("/api/session/{session_id}/state", response_model=SessionState)
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

@app.post("/api/session/{session_id}/generate-alt-text", response_model=AltTextResponse)
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

@app.post("/api/session/{session_id}/reanalyze", response_model=ReanalyzeResponse)
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

@app.get("/api/session/{session_id}/export-html")
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

@app.post("/api/batch/upload", response_model=BatchUploadResponse)
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


@app.get("/api/batch/{batch_id}", response_model=BatchManifest)
def get_batch(batch_id: str):
    manifest = load_batch(batch_id)
    if manifest is None:
        raise HTTPException(404, f"Batch {batch_id} not found.")
    return manifest


# ---------------------------------------------------------------------------
# Routes — Structure Tree Tagging Wizard
# ---------------------------------------------------------------------------

@app.get("/api/session/{session_id}/elements")
def get_elements(session_id: str):
    """Extract page elements for the structure tree tagging wizard."""
    pdf_path = _session_dir(session_id) / "original.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "No uploaded PDF found for this session.")
    try:
        result = extract_elements(str(pdf_path))
        return {"session_id": session_id, **result}
    except Exception as e:
        raise HTTPException(500, f"Element extraction failed: {e}")


@app.post("/api/session/{session_id}/build-structure-tree")
def build_structure_tree_endpoint(session_id: str, body: dict):
    """Build and inject a structure tree based on user element assignments."""
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

@app.get("/api/history")
def get_history(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    all_entries = load_history()
    total = len(all_entries)
    page = all_entries[offset: offset + limit]
    return {"entries": page, "total": total}


@app.delete("/api/history/{session_id}")
def delete_history(session_id: str):
    if not delete_history_entry(session_id):
        raise HTTPException(404, f"History entry {session_id} not found.")
    return {"deleted": session_id}
