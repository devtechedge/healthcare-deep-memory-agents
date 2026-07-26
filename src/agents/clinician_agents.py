"""
Clinician-side agents: Visit Brief + Note Draft.
Read path is consent-gated. Pure Python. No frameworks.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.memory.consent import ConsentStore
from src.memory.deep_memory import DeepMemory


def _iso_short(ts: str) -> str:
    return (ts or "")[:19].replace("T", " ")


class VisitBriefAgent:
    """Assemble a visit brief from consented packet / live memory slices."""

    def __init__(self, memory: DeepMemory, consent: ConsentStore):
        self.memory = memory
        self.consent = consent

    def build(
        self,
        grant_id: str,
        clinician_id: str,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        g = self.consent.access(grant_id, clinician_id, "visit_brief")
        if not g:
            # allow brief if profile+timeline granted even without visit_brief flag
            g = self.consent.access(grant_id, clinician_id, "profile")
            if not g:
                return {"error": "not_authorized", "message": "No active grant for visit brief"}

        pid = patient_id or g["patient_id"]
        if pid != g["patient_id"]:
            return {"error": "patient_mismatch"}

        snapshot = g.get("packet_snapshot") or {}
        scopes = g["scopes"]

        profile: List[str] = []
        timeline: List[Dict[str, str]] = []
        insights: List[str] = []

        if snapshot:
            profile = snapshot.get("profile") or []
            timeline = snapshot.get("timeline") or []
            insights = snapshot.get("insights") or []
        else:
            if "profile" in scopes:
                # semantic facts as profile lines
                rows = self.memory.db.execute(
                    "SELECT content, tags FROM semantic WHERE patient_id=? ORDER BY importance DESC LIMIT 20",
                    (pid,),
                ).fetchall()
                profile = [r["content"] for r in rows]
            if "timeline" in scopes or "visit_brief" in scopes:
                timeline = [
                    {
                        "ts": _iso_short(e["ts"]),
                        "type": e["event_type"],
                        "content": e["content"],
                    }
                    for e in self.memory.recent_episodic(pid, limit=15)
                ]
            if "profile" in scopes or "visit_brief" in scopes:
                irows = self.memory.db.execute(
                    "SELECT pattern, verified FROM insights WHERE patient_id=? ORDER BY created_at DESC LIMIT 8",
                    (pid,),
                ).fetchall()
                insights = [
                    ("[confirmed] " if r["verified"] else "[hypothesis] ") + r["pattern"]
                    for r in irows
                ]

        brief = {
            "type": "visit_brief",
            "patient_id": pid,
            "grant_id": grant_id,
            "clinician_id": clinician_id,
            "purpose": g.get("purpose") or "",
            "expires_at": g.get("expires_at"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "profile": profile,
            "timeline": timeline,
            "insights": insights,
            "scopes_used": sorted(scopes),
        }
        brief["markdown"] = self._to_markdown(brief)
        return brief

    def _to_markdown(self, brief: Dict[str, Any]) -> str:
        lines = [
            "# Visit Brief",
            f"Patient: `{brief['patient_id']}`  ",
            f"Grant: `{brief['grant_id']}` · expires `{brief.get('expires_at', '')[:19]}`  ",
            f"Purpose: {brief.get('purpose') or '—'}  ",
            "",
            "## Profile snapshot",
        ]
        if brief["profile"]:
            for p in brief["profile"]:
                lines.append(f"- {p}")
        else:
            lines.append("- _(none in grant)_")

        lines.append("")
        lines.append("## Timeline")
        if brief["timeline"]:
            for t in brief["timeline"]:
                lines.append(f"- `{t.get('ts', '')}` **{t.get('type', '')}**: {t.get('content', '')}")
        else:
            lines.append("- _(none in grant)_")

        lines.append("")
        lines.append("## Patterns / insights")
        if brief["insights"]:
            for i in brief["insights"]:
                lines.append(f"- {i}")
        else:
            lines.append("- _(none)_")

        lines.append("")
        lines.append("---")
        lines.append("_Educational packet. Not a medical record. Clinician must verify._")
        return "\n".join(lines)


class NoteDraftAgent:
    """Draft a progress note from an authorized brief + optional clinician bullets."""

    def __init__(self, memory: DeepMemory, consent: ConsentStore):
        self.memory = memory
        self.consent = consent
        self.brief_agent = VisitBriefAgent(memory, consent)

    def draft(
        self,
        grant_id: str,
        clinician_id: str,
        clinician_bullets: Optional[List[str]] = None,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        g = self.consent.access(grant_id, clinician_id, "note_source")
        if not g:
            # fallback: allow draft from visit_brief scope with stronger disclaimer
            g = self.consent.access(grant_id, clinician_id, "visit_brief")
            if not g:
                return {"error": "not_authorized", "message": "Grant lacks note_source/visit_brief"}

        brief = self.brief_agent.build(grant_id, clinician_id, patient_id=patient_id)
        if brief.get("error"):
            return brief

        bullets = clinician_bullets or []
        subjective = []
        for t in brief.get("timeline") or []:
            if t.get("type") in ("symptom", "conversation", "care", "triage") or True:
                subjective.append(f"{t.get('ts', '')}: {t.get('content', '')}")

        assessment = [i for i in (brief.get("insights") or []) if i]
        plan_bits = bullets

        md_lines = [
            "# Note Draft (AI-assisted — not signed)",
            f"Sources: grant `{grant_id}` · brief generated `{brief.get('generated_at', '')[:19]}`",
            "",
            "## S — Subjective",
        ]
        if subjective:
            for s in subjective[:12]:
                md_lines.append(f"- {s}")
        else:
            md_lines.append("- _(no timeline in packet)_")

        md_lines += ["", "## O — Objective", "- _(none — do not invent vitals/labs/exam)_"]

        md_lines += ["", "## A — Assessment"]
        if assessment:
            for a in assessment:
                md_lines.append(f"- {a}")
            md_lines.append("- _Hypotheses only until clinician confirms._")
        else:
            md_lines.append("- _(clinician to complete)_")

        md_lines += ["", "## P — Plan"]
        if plan_bits:
            for p in plan_bits:
                md_lines.append(f"- {p}")
        else:
            md_lines.append("- _(clinician to complete)_")

        md_lines += [
            "",
            "---",
            "**Disclaimer:** AI-assisted draft from patient-authorized packet only. "
            "Not a legal medical record. Clinician must review, edit, and sign in their own system.",
        ]

        return {
            "type": "note_draft",
            "grant_id": grant_id,
            "patient_id": brief["patient_id"],
            "clinician_id": clinician_id,
            "markdown": "\n".join(md_lines),
            "brief_ref": {
                "generated_at": brief.get("generated_at"),
                "scopes_used": brief.get("scopes_used"),
            },
        }


def build_packet_snapshot(memory: DeepMemory, patient_id: str) -> Dict[str, Any]:
    """Freeze a shareable packet at grant time."""
    profile_rows = memory.db.execute(
        "SELECT content FROM semantic WHERE patient_id=? ORDER BY importance DESC LIMIT 20",
        (patient_id,),
    ).fetchall()
    timeline = [
        {"ts": _iso_short(e["ts"]), "type": e["event_type"], "content": e["content"]}
        for e in memory.recent_episodic(patient_id, limit=20)
    ]
    insights = memory.db.execute(
        "SELECT pattern, verified FROM insights WHERE patient_id=? ORDER BY created_at DESC LIMIT 8",
        (patient_id,),
    ).fetchall()
    return {
        "profile": [r["content"] for r in profile_rows],
        "timeline": timeline,
        "insights": [
            ("[confirmed] " if r["verified"] else "[hypothesis] ") + r["pattern"] for r in insights
        ],
        "frozen_at": datetime.now(timezone.utc).isoformat(),
    }
