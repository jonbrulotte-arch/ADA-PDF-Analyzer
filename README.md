# ADA PDF Analyzer

A self-hosted web application for analyzing, remediating, and tracking PDF accessibility compliance against WCAG 2.1 AA, Section 508, and PDF/UA-1 standards.

---

## Features

- **13-point accessibility analysis** — title, language, tagging, alt text, headings, tables, forms, bookmarks, links, fonts, color contrast, reading order, encryption
- **Automated remediation** — one-click fixes for title, language, alt text, bookmarks, and PDF/UA identifier
- **Per-instance findings** — each issue shows the exact page, infringing element/text, and a specific recommended fix
- **Project management** — every upload auto-creates a project; track multiple revisions over time with labels, notes, and assignees
- **Score trend** — sparkline across revisions shows improvement over iterations
- **Batch upload** — analyze up to 10 PDFs in one request
- **Structure tree tagging wizard** — guided UI to inject a `/StructTreeRoot` into untagged PDFs
- **AI alt text generation** — Claude Vision generates alt text suggestions when `ANTHROPIC_API_KEY` is set
- **HTML report export** — self-contained HTML report for sharing
- **Full REST API** — machine-readable JSON for every operation; interactive Swagger UI at `/docs`

---

## Quick start (Docker)

```bash
cp backend/.env.example .env        # optional: add ANTHROPIC_API_KEY for AI features
docker compose up --build -d
```

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:3010      |
| Backend API | http://localhost:8085   |
| Swagger UI  | http://localhost:8085/docs |
| ReDoc       | http://localhost:8085/redoc |

> **Note:** Use `docker compose` (with a space) — the legacy `docker-compose` binary is not supported.

To pick up code changes:

```bash
docker compose down && docker compose build --no-cache && docker compose up -d
```

---

## Local development

### Backend (FastAPI + Python 3.11+)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js 14)

```bash
cd frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000  
API docs: http://localhost:8000/docs

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enable AI alt text via Claude Vision (`claude-haiku-4-5-20251001`) |
| `MAX_UPLOAD_MB` | `80` | Upload size limit in megabytes |
| `STORAGE_DIR` | `./storage` | Root path for uploads, reports, and project JSON files |
| `BACKEND_URL` | `http://backend:8000` | Backend URL used by the Next.js server-side proxy |

---

## REST API overview

The backend exposes a versioned REST API. All responses are JSON. Interactive docs at `/docs` (Swagger UI) and `/redoc`.

### Core workflow

```
POST   /api/upload                          # upload PDF → { session_id, project_id }
GET    /api/report/{session_id}             # run / retrieve accessibility report
POST   /api/remediate/{session_id}          # apply approved fixes → { download_url }
GET    /api/download/{session_id}           # stream remediated PDF
POST   /api/session/{session_id}/reanalyze  # re-check remediated PDF
GET    /api/session/{session_id}/export-html
```

#### Upload parameters

| Parameter | Location | Description |
|---|---|---|
| `file` | multipart body | PDF file |
| `project_id` | query string (optional) | Append to an existing project instead of creating one |

### Projects & revisions

```
GET    /api/projects                                          # list (search, status, assignee, sort, limit, offset)
POST   /api/projects                                          # create → 201
GET    /api/projects/{project_id}                             # full project + revisions
PATCH  /api/projects/{project_id}                             # update name, description, assignee, status, tags
PUT    /api/projects/{project_id}                             # full replace
DELETE /api/projects/{project_id}                             # 204

GET    /api/projects/{project_id}/revisions
GET    /api/projects/{project_id}/revisions/{session_id}
PATCH  /api/projects/{project_id}/revisions/{session_id}     # update label / notes
DELETE /api/projects/{project_id}/revisions/{session_id}     # 204
```

Project status values: `active` · `in_review` · `remediated` · `approved` · `archived`

### Batch upload

```
POST   /api/batch/upload    # multipart, field name: files (up to 10 PDFs)
GET    /api/batch/{batch_id}
```

### Structure tree tagging

```
GET    /api/session/{session_id}/elements              # extract page elements with suggested roles
POST   /api/session/{session_id}/build-structure-tree  # inject /StructTreeRoot
```

### Session state & AI

```
GET    /api/session/{session_id}/state
PATCH  /api/session/{session_id}/state
POST   /api/session/{session_id}/generate-alt-text     # requires ANTHROPIC_API_KEY
```

### Misc

```
GET    /api/history                 # global log (limit, offset)
DELETE /api/history/{session_id}
GET    /api/settings
PATCH  /api/settings
GET    /health
```

---

## Project data model

```json
{
  "project_id": "uuid",
  "name": "Annual Report 2024",
  "description": "Accessibility review for board approval",
  "assignee": "jane.doe@example.com",
  "status": "in_review",
  "tags": ["annual-report", "priority"],
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-20T14:30:00Z",
  "revisions": [
    {
      "session_id": "uuid",
      "filename": "annual-report.pdf",
      "label": "v1",
      "score": 42,
      "grade": "F",
      "page_count": 24,
      "file_size_kb": 1820,
      "created_at": "2024-01-15T10:00:00Z",
      "notes": ""
    },
    {
      "session_id": "uuid",
      "filename": "annual-report-v2.pdf",
      "label": "v2",
      "score": 78,
      "grade": "C",
      "page_count": 24,
      "file_size_kb": 1795,
      "created_at": "2024-01-20T14:00:00Z",
      "notes": "Applied title, language, and alt text fixes"
    }
  ]
}
```

Storage is file-based JSON at `{STORAGE_DIR}/projects/{project_id}.json` — no external database required.

---

## Accessibility checks

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

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | FastAPI, Pydantic v2, Python 3.11+ |
| PDF analysis | PyMuPDF (fitz) |
| PDF remediation | pikepdf |
| AI alt text | Anthropic Claude Vision (`claude-haiku-4-5-20251001`) |
| Containerization | Docker Compose |

---

## Limitations

- **Color contrast** is heuristic — flags light-colored text but cannot compute contrast ratios without background color data. Manual verification required.
- **Structure tree tagging** injects `/StructTreeRoot` but does not add MCID markers to the content stream. Automated checkers will pass; real AT navigation may still be limited.
- **Storage** is file-based JSON — not designed for concurrent multi-user production workloads without a shared filesystem.
- Automated fixes improve compliance but are not a substitute for expert manual review.
