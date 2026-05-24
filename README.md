# ADA PDF Analyzer

A web application that analyzes PDF documents for ADA / WCAG 2.1 AA accessibility compliance, generates a detailed report, recommends automated fixes, applies approved changes, and provides a remediated PDF for download.

## What it checks

| Check | Standard | Auto-fix |
|-------|----------|----------|
| Document title | WCAG 2.4.2 | ✅ |
| Document language | WCAG 3.1.1 | ✅ |
| Tagged PDF / structure tree | PDF/UA-1 | — |
| Image alternative text | WCAG 1.1.1 | ✅ (placeholder) |
| Heading hierarchy | WCAG 1.3.1 | — |
| Table headers | WCAG 1.3.1 | — |
| Form field labels | WCAG 1.3.1 | — |
| Bookmarks / navigation | PDF/UA-1 | ✅ |
| Descriptive link text | WCAG 2.4.4 | — |
| Font embedding | PDF/UA-1 | — |
| Color contrast (heuristic) | WCAG 1.4.3 | — |
| Logical reading order | WCAG 1.3.2 | — |
| Encryption / security | WCAG 4.1.1 | — |

## Quick start (Docker)

```bash
cp backend/.env.example .env          # optional: add ANTHROPIC_API_KEY for AI features
docker-compose up --build
```

Open **http://localhost:3000** in your browser.

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000  
API docs: http://localhost:8000/docs

## AI-powered features (optional)

Set `ANTHROPIC_API_KEY` in your environment to enable:
- AI-generated alt text suggestions for images
- Smart document title extraction

Without the key, the tool still performs all accessibility checks and applies fixable remediation — alt text placeholders are inserted with instructions for manual completion.

## Tech stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: FastAPI, PyMuPDF, pikepdf
- **Containerization**: Docker + Docker Compose
