"""
Persistence layer for session states, app settings, history, and batch manifests.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .models import AppSettings, BatchManifest, HistoryEntry, SessionState

# ---------------------------------------------------------------------------
# Storage root
# ---------------------------------------------------------------------------

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./storage"))

_SETTINGS_PATH = STORAGE_DIR / "settings.json"
_HISTORY_PATH = STORAGE_DIR / "history.json"
_SESSION_STATES_DIR = STORAGE_DIR / "session_states"
_BATCHES_DIR = STORAGE_DIR / "batches"


def _ensure_dirs() -> None:
    for d in (_SESSION_STATES_DIR, _BATCHES_DIR):
        d.mkdir(parents=True, exist_ok=True)


_ensure_dirs()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def load_settings() -> AppSettings:
    try:
        if _SETTINGS_PATH.exists():
            return AppSettings.model_validate_json(_SETTINGS_PATH.read_text())
    except Exception:
        pass
    return AppSettings()


def save_settings(s: AppSettings) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    _SETTINGS_PATH.write_text(s.model_dump_json(indent=2))


# ---------------------------------------------------------------------------
# Session State
# ---------------------------------------------------------------------------

def _state_path(session_id: str) -> Path:
    return _SESSION_STATES_DIR / f"{session_id}.json"


def load_state(session_id: str) -> SessionState | None:
    p = _state_path(session_id)
    try:
        if p.exists():
            return SessionState.model_validate_json(p.read_text())
    except Exception:
        pass
    return None


def get_or_create_state(session_id: str) -> SessionState:
    existing = load_state(session_id)
    if existing is not None:
        return existing
    state = SessionState(
        session_id=session_id,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    save_state(state)
    return state


def save_state(state: SessionState) -> None:
    _SESSION_STATES_DIR.mkdir(parents=True, exist_ok=True)
    state.updated_at = datetime.now(timezone.utc).isoformat()
    _state_path(state.session_id).write_text(state.model_dump_json(indent=2))


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

def load_history() -> list[HistoryEntry]:
    try:
        if _HISTORY_PATH.exists():
            data = json.loads(_HISTORY_PATH.read_text())
            return [HistoryEntry.model_validate(entry) for entry in data]
    except Exception:
        pass
    return []


def _save_history(entries: list[HistoryEntry]) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    _HISTORY_PATH.write_text(
        json.dumps([e.model_dump() for e in entries], indent=2)
    )


def append_history(entry: HistoryEntry) -> None:
    """Deduplicate by session_id, insert at front (most recent first)."""
    entries = load_history()
    entries = [e for e in entries if e.session_id != entry.session_id]
    entries.insert(0, entry)
    _save_history(entries)


def delete_history_entry(session_id: str) -> bool:
    """Remove a single entry by session_id. Returns True if found and removed."""
    entries = load_history()
    new_entries = [e for e in entries if e.session_id != session_id]
    if len(new_entries) == len(entries):
        return False
    _save_history(new_entries)
    return True


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------

def _batch_path(batch_id: str) -> Path:
    return _BATCHES_DIR / f"{batch_id}.json"


def save_batch(manifest: BatchManifest) -> None:
    _BATCHES_DIR.mkdir(parents=True, exist_ok=True)
    _batch_path(manifest.batch_id).write_text(manifest.model_dump_json(indent=2))


def load_batch(batch_id: str) -> BatchManifest | None:
    p = _batch_path(batch_id)
    try:
        if p.exists():
            return BatchManifest.model_validate_json(p.read_text())
    except Exception:
        pass
    return None
