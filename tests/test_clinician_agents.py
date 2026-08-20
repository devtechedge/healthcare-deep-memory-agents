from __future__ import annotations

from pathlib import Path

import pytest

from src.agents.clinician_agents import NoteDraftAgent, VisitBriefAgent, build_packet_snapshot
from src.memory.consent import ConsentStore
from src.memory.deep_memory import DeepMemory
from tests.helpers import DummyEmbedder


@pytest.fixture
def ctx(tmp_path: Path):
    memory = DeepMemory(
        db_path=str(tmp_path / "mem.db"),
        vectors_path=str(tmp_path / "vectors.pkl"),
        embedder=DummyEmbedder(),
    )
    consent = ConsentStore(db_path=str(tmp_path / "mem.db"))
    memory.add_semantic("demo", "allergic to penicillin", tags=["allergy"])
    memory.add_episodic("demo", "symptom", "migraine after skipped meals")
    memory.add_insight("demo", "meals correlate with migraine", "episodic", verified=False)
    yield memory, consent
    consent.close()
    memory.close()


def test_brief_denied_without_grant(ctx):
    memory, consent = ctx
    out = VisitBriefAgent(memory, consent).build("no-such-grant", "dr_lee")
    assert out["error"] == "not_authorized"


def test_brief_from_snapshot_scopes(ctx):
    memory, consent = ctx
    snap = build_packet_snapshot(memory, "demo")
    assert any("penicillin" in p for p in snap["profile"])
    gid = consent.create_grant(
        "demo",
        "dr_lee",
        scopes={"visit_brief", "profile", "timeline"},
        packet_snapshot=snap,
    )
    brief = VisitBriefAgent(memory, consent).build(gid, "dr_lee")
    assert "error" not in brief
    assert "Visit Brief" in brief["markdown"]
    assert "penicillin" in brief["markdown"]
    assert "Educational packet" in brief["markdown"]


def test_note_denied_without_note_or_brief_scope(ctx):
    memory, consent = ctx
    gid = consent.create_grant("demo", "dr_lee", scopes={"profile"})
    out = NoteDraftAgent(memory, consent).draft(gid, "dr_lee")
    assert out["error"] == "not_authorized"


def test_note_draft_has_soap_and_disclaimer(ctx):
    memory, consent = ctx
    snap = build_packet_snapshot(memory, "demo")
    gid = consent.create_grant(
        "demo",
        "dr_lee",
        scopes={"note_source", "visit_brief"},
        packet_snapshot=snap,
    )
    note = NoteDraftAgent(memory, consent).draft(
        gid, "dr_lee", clinician_bullets=["follow up in 2 weeks"]
    )
    md = note["markdown"]
    assert "## S — Subjective" in md
    assert "## O — Objective" in md
    assert "do not invent vitals" in md
    assert "follow up in 2 weeks" in md
    assert "Not a legal medical record" in md
