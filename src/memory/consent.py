"""
Consent grants for clinician access to patient memory packets.
Pure Python + SQLite. No frameworks.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

VALID_SCOPES = {"profile", "timeline", "visit_brief", "note_source"}


class ConsentStore:
    def __init__(self, db_path: str = "data/healthcare_memory.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.db_path)
        self.db.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS consent_grants (
                grant_id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                clinician_id TEXT NOT NULL,
                scopes TEXT NOT NULL,
                purpose TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                status TEXT NOT NULL,
                packet_snapshot TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_grants_patient ON consent_grants(patient_id);
            CREATE INDEX IF NOT EXISTS idx_grants_clinician ON consent_grants(clinician_id);

            CREATE TABLE IF NOT EXISTS consent_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                grant_id TEXT,
                actor TEXT,
                action TEXT NOT NULL,
                detail TEXT,
                ts TEXT NOT NULL
            );
            """
        )
        self.db.commit()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _audit(self, grant_id: Optional[str], actor: str, action: str, detail: str = "") -> None:
        self.db.execute(
            "INSERT INTO consent_audit (grant_id, actor, action, detail, ts) VALUES (?,?,?,?,?)",
            (grant_id, actor, action, detail, self._now().isoformat()),
        )
        self.db.commit()

    def create_grant(
        self,
        patient_id: str,
        clinician_id: str,
        scopes: Set[str],
        purpose: str = "",
        hours_valid: int = 72,
        packet_snapshot: Optional[Dict[str, Any]] = None,
    ) -> str:
        scopes = {s for s in scopes if s in VALID_SCOPES}
        if not scopes:
            raise ValueError("At least one valid scope required")

        grant_id = str(uuid.uuid4())
        now = self._now()
        expires = now + timedelta(hours=hours_valid)

        self.db.execute(
            "INSERT INTO consent_grants "
            "(grant_id, patient_id, clinician_id, scopes, purpose, created_at, expires_at, status, packet_snapshot) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                grant_id,
                patient_id,
                clinician_id,
                json.dumps(sorted(scopes)),
                purpose,
                now.isoformat(),
                expires.isoformat(),
                "active",
                json.dumps(packet_snapshot) if packet_snapshot is not None else None,
            ),
        )
        self.db.commit()
        self._audit(grant_id, patient_id, "create", f"scopes={sorted(scopes)} hours={hours_valid}")
        return grant_id

    def revoke(self, grant_id: str, actor: str) -> bool:
        row = self.get_grant(grant_id, refresh_expiry=False)
        if not row:
            return False
        self.db.execute(
            "UPDATE consent_grants SET status='revoked' WHERE grant_id=?",
            (grant_id,),
        )
        self.db.commit()
        self._audit(grant_id, actor, "revoke")
        return True

    def _mark_expired(self, grant_id: str) -> None:
        self.db.execute(
            "UPDATE consent_grants SET status='expired' WHERE grant_id=? AND status='active'",
            (grant_id,),
        )
        self.db.commit()
        self._audit(grant_id, "system", "expire")

    def get_grant(self, grant_id: str, refresh_expiry: bool = True) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            "SELECT * FROM consent_grants WHERE grant_id=?", (grant_id,)
        ).fetchone()
        if not row:
            return None
        data = dict(row)
        data["scopes"] = set(json.loads(data["scopes"] or "[]"))
        if data.get("packet_snapshot"):
            data["packet_snapshot"] = json.loads(data["packet_snapshot"])

        if refresh_expiry and data["status"] == "active":
            exp = datetime.fromisoformat(data["expires_at"])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if self._now() > exp:
                self._mark_expired(grant_id)
                data["status"] = "expired"
        return data

    def is_allowed(
        self,
        grant_id: str,
        clinician_id: str,
        required_scope: str,
    ) -> bool:
        g = self.get_grant(grant_id)
        if not g:
            return False
        if g["status"] != "active":
            return False
        if g["clinician_id"] != clinician_id:
            return False
        if required_scope not in g["scopes"]:
            return False
        return True

    def access(
        self,
        grant_id: str,
        clinician_id: str,
        required_scope: str,
        actor_detail: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Authorize and return grant; logs audit on success."""
        if not self.is_allowed(grant_id, clinician_id, required_scope):
            self._audit(grant_id, clinician_id, "deny", required_scope)
            return None
        g = self.get_grant(grant_id)
        self._audit(grant_id, clinician_id, "access", f"{required_scope} {actor_detail}".strip())
        return g

    def list_grants(self, patient_id: str) -> List[Dict[str, Any]]:
        rows = self.db.execute(
            "SELECT grant_id, clinician_id, scopes, purpose, created_at, expires_at, status "
            "FROM consent_grants WHERE patient_id=? ORDER BY created_at DESC",
            (patient_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["scopes"] = json.loads(d["scopes"] or "[]")
            out.append(d)
        return out

    def close(self) -> None:
        self.db.close()
