from src.agents.routing import STAGES, coerce_stage, keyword_route


def test_keyword_routes_allergies_to_baseline():
    assert keyword_route("I have a peanut allergy") == "BASELINE"


def test_keyword_routes_pain_to_triage():
    assert keyword_route("sharp chest pain since morning") == "TRIAGE"


def test_keyword_routes_visit_prep():
    assert keyword_route("help me prepare my visit") == "VISIT_PREP"


def test_keyword_routes_care_side_effect():
    assert keyword_route("possible side effect after the new pill") == "CARE"


def test_keyword_routes_pattern():
    assert keyword_route("why do I always get headaches after coffee") == "PATTERN"


def test_keyword_routes_recovery():
    assert keyword_route("feeling better this week") == "RECOVERY"


def test_keyword_returns_none_for_ambiguous():
    assert keyword_route("hello") is None


def test_coerce_stage_extracts_label():
    assert coerce_stage("I think TRIAGE is right") == "TRIAGE"


def test_coerce_stage_falls_back_to_last_then_triage():
    assert coerce_stage("nope", last_stage="CARE") == "CARE"
    assert coerce_stage("nope") == "TRIAGE"


def test_six_journey_stages():
    assert STAGES == (
        "BASELINE",
        "TRIAGE",
        "VISIT_PREP",
        "CARE",
        "PATTERN",
        "RECOVERY",
    )
