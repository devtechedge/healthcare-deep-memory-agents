from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from src.memory.consent import VALID_SCOPES, ConsentStore


@pytest.fixture
def store(tmp_path: Path) -> ConsentStore:
    s = ConsentStore(db_path=str(tmp_path / "consent.db"))
    yield s
    s.close()


def test_valid_scopes_are_four():
    assert VALID_SCOPES == {"profile", "timeline", "visit_brief", "note_source"}


def test_create_grant_rejects_empty_scopes(store: ConsentStore):
    with pytest.raises(ValueError, match="valid scope"):
        store.create_grant("demo", "dr_lee", scopes={"not-a-scope"})


def test_create_grant_strips_unknown_scopes(store: ConsentStore):
    gid = store.create_grant(
        "demo",
        "dr_lee",
        scopes={"profile", "hacker"},
        purpose="visit",
        hours_valid=48,
    )
    g = store.get_grant(gid)
    assert g["scopes"] == {"profile"}
    assert g["status"] == "active"
    assert g["patient_id"] == "demo"


def test_is_allowed_checks_clinician_scope_and_status(store: ConsentStore):
    gid = store.create_grant("demo", "dr_lee", scopes={"visit_brief", "profile"})
    assert store.is_allowed(gid, "dr_lee", "visit_brief") is True
    assert store.is_allowed(gid, "dr_lee", "note_source") is False
    assert store.is_allowed(gid, "dr_other", "visit_brief") is False
    assert store.is_allowed("missing", "dr_lee", "visit_brief") is False


def test_access_audits_allow_and_deny(store: ConsentStore):
    gid = store.create_grant("demo", "dr_lee", scopes={"visit_brief"})
    allowed = store.access(gid, "dr_lee", "visit_brief")
    denied = store.access(gid, "dr_lee", "note_source")
    assert allowed is not None
    assert denied is None
    rows = store.db.execute(
        "SELECT action FROM consent_audit WHERE grant_id=? ORDER BY id", (gid,)
    ).fetchall()
    actions = [r[0] for r in rows]
    assert "create" in actions
    assert "access" in actions
    assert "deny" in actions


def test_revoke_blocks_later_access(store: ConsentStore):
    gid = store.create_grant("demo", "dr_lee", scopes={"profile"})
    assert store.revoke(gid, actor="demo") is True
    assert store.get_grant(gid)["status"] == "revoked"
    assert store.is_allowed(gid, "dr_lee", "profile") is False


def test_expired_grant_is_marked(store: ConsentStore):
    gid = store.create_grant("demo", "dr_lee", scopes={"profile"}, hours_valid=72)
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    store.db.execute("UPDATE consent_grants SET expires_at=? WHERE grant_id=?", (past, gid))
    store.db.commit()
    g = store.get_grant(gid)
    assert g["status"] == "expired"
    assert store.is_allowed(gid, "dr_lee", "profile") is False


def test_list_grants_for_patient(store: ConsentStore):
    store.create_grant("demo", "dr_lee", scopes={"profile"})
    store.create_grant("other", "dr_lee", scopes={"profile"})
    listed = store.list_grants("demo")
    assert len(listed) == 1
    assert listed[0]["clinician_id"] == "dr_lee"
