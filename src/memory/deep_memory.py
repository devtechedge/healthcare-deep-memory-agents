"""
Deep multi-layer memory for healthcare agents.
Pure Python + SQLite + sentence-transformers.
No agent frameworks.
"""

from __future__ import annotations

import hashlib
import json
import pickle
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer


class DeepMemory:
    def __init__(
        self,
        db_path: str = "data/healthcare_memory.db",
        vectors_path: str = "data/vectors.pkl",
        emb_model: str = "sentence-transformers/all-MiniLM-L6-v2",
    ):
        self.db_path = Path(db_path)
        self.vectors_path = Path(vectors_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = sqlite3.connect(self.db_path)
        self.db.row_factory = sqlite3.Row
        self._init_schema()

        self.embedder = SentenceTransformer(emb_model)
        self.vectors: Dict[str, np.ndarray] = {}
        self._load_vectors()

    def _init_schema(self) -> None:
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS episodic (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                event_type TEXT NOT NULL,
                content TEXT NOT NULL,
                meta TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_episodic_patient ON episodic(patient_id);

            CREATE TABLE IF NOT EXISTS semantic (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                importance REAL DEFAULT 0.7,
                last_accessed TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_semantic_patient ON semantic(patient_id);

            CREATE TABLE IF NOT EXISTS insights (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                pattern TEXT NOT NULL,
                evidence TEXT,
                verified INTEGER DEFAULT 0,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS session_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id TEXT,
                role TEXT,
                content TEXT,
                ts TEXT
            );
            """
        )
        self.db.commit()

    # ---------- Episodic ----------
    def add_episodic(
        self,
        patient_id: str,
        event_type: str,
        content: str,
        meta: Optional[Dict[str, Any]] = None,
    ) -> str:
        eid = hashlib.sha256(
            f"{patient_id}{datetime.now(timezone.utc).isoformat()}{content}".encode()
        ).hexdigest()[:16]
        self.db.execute(
            "INSERT INTO episodic (id, patient_id, ts, event_type, content, meta) VALUES (?,?,?,?,?,?)",
            (
                eid,
                patient_id,
                datetime.now(timezone.utc).isoformat(),
                event_type,
                content,
                json.dumps(meta or {}),
            ),
        )
        self.db.commit()
        return eid

    def recent_episodic(self, patient_id: str, limit: int = 12) -> List[Dict]:
        rows = self.db.execute(
            "SELECT event_type, content, ts, meta FROM episodic "
            "WHERE patient_id=? ORDER BY ts DESC LIMIT ?",
            (patient_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ---------- Semantic (vector) ----------
    def add_semantic(
        self,
        patient_id: str,
        content: str,
        tags: Optional[List[str]] = None,
        importance: float = 0.7,
    ) -> str:
        sid = hashlib.sha256(f"{patient_id}:{content}".encode()).hexdigest()[:16]
        emb = self.embedder.encode(content, normalize_embeddings=True)
        self.vectors[sid] = emb

        self.db.execute(
            "INSERT OR REPLACE INTO semantic (id, patient_id, content, tags, importance, last_accessed) "
            "VALUES (?,?,?,?,?,?)",
            (
                sid,
                patient_id,
                content,
                json.dumps(tags or []),
                importance,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self.db.commit()
        self._save_vectors()
        return sid

    def search_semantic(
        self, query: str, patient_id: Optional[str] = None, top_k: int = 6
    ) -> List[Dict]:
        if not self.vectors:
            return []

        q_emb = self.embedder.encode(query, normalize_embeddings=True)
        scored = []

        for sid, emb in self.vectors.items():
            row = self.db.execute(
                "SELECT patient_id, content, tags, importance FROM semantic WHERE id=?",
                (sid,),
            ).fetchone()
            if not row:
                continue
            if patient_id and row["patient_id"] != patient_id:
                continue
            score = float(np.dot(q_emb, emb)) * float(row["importance"])
            scored.append((score, sid, row))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, sid, row in scored[:top_k]:
            results.append(
                {
                    "id": sid,
                    "content": row["content"],
                    "tags": json.loads(row["tags"] or "[]"),
                    "score": score,
                }
            )
            # touch last_accessed
            self.db.execute(
                "UPDATE semantic SET last_accessed=? WHERE id=?",
                (datetime.now(timezone.utc).isoformat(), sid),
            )
        self.db.commit()
        return results

    # ---------- Insights (stub for later) ----------
    def add_insight(
        self, patient_id: str, pattern: str, evidence: str, verified: bool = False
    ) -> str:
        iid = hashlib.sha256(pattern.encode()).hexdigest()[:16]
        self.db.execute(
            "INSERT OR REPLACE INTO insights (id, patient_id, pattern, evidence, verified, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (
                iid,
                patient_id,
                pattern,
                evidence,
                1 if verified else 0,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self.db.commit()
        return iid

    # ---------- Persistence helpers ----------
    def _save_vectors(self) -> None:
        with open(self.vectors_path, "wb") as f:
            pickle.dump(self.vectors, f)

    def _load_vectors(self) -> None:
        if self.vectors_path.exists():
            with open(self.vectors_path, "rb") as f:
                self.vectors = pickle.load(f)

    def close(self) -> None:
        self.db.close()
