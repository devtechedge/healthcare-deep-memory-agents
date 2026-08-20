from __future__ import annotations

from pathlib import Path

import pytest

from src.memory.deep_memory import DeepMemory
from tests.helpers import DummyEmbedder


@pytest.fixture
def memory(tmp_path: Path) -> DeepMemory:
    m = DeepMemory(
        db_path=str(tmp_path / "mem.db"),
        vectors_path=str(tmp_path / "vectors.pkl"),
        embedder=DummyEmbedder(),
    )
    yield m
    m.close()


def test_episodic_is_patient_scoped(memory: DeepMemory):
    memory.add_episodic("p1", "symptom", "headache 6/10")
    memory.add_episodic("p2", "symptom", "cough")
    p1 = memory.recent_episodic("p1")
    assert len(p1) == 1
    assert p1[0]["content"] == "headache 6/10"
    assert p1[0]["event_type"] == "symptom"
    assert memory.recent_episodic("p2")[0]["content"] == "cough"


def test_semantic_search_filters_by_patient(memory: DeepMemory):
    memory.add_semantic("p1", "allergic to penicillin", tags=["allergy"], importance=0.9)
    memory.add_semantic("p2", "allergic to cats", tags=["allergy"], importance=0.9)
    hits = memory.search_semantic("penicillin allergy", patient_id="p1", top_k=4)
    assert hits
    assert all("cats" not in h["content"] for h in hits)
    assert hits[0]["tags"] == ["allergy"]


def test_insights_store_verified_flag(memory: DeepMemory):
    iid = memory.add_insight("p1", "headache after poor sleep", "3 events", verified=False)
    row = memory.db.execute("SELECT verified, pattern FROM insights WHERE id=?", (iid,)).fetchone()
    assert row["verified"] == 0
    assert "sleep" in row["pattern"]
