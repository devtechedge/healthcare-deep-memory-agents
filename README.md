# Cadence

**Deep-memory vertical agents for healthcare** — pure Python, fully local, zero agentic frameworks.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Ollama](https://img.shields.io/badge/LLM-Ollama-black.svg)](https://ollama.com)
[![UI](https://img.shields.io/badge/UI-Vercel-black.svg)](https://cadence-devtechedge1.vercel.app)
[![Release](https://img.shields.io/badge/release-v0.1.0-brightgreen.svg)](https://github.com/devtechedge/healthcare-deep-memory-agents/releases)

> **Disclaimer**: Educational / research prototype only. Never use for real medical decisions. Always consult qualified clinicians.

**Live UI:** [cadence-devtechedge1.vercel.app](https://cadence-devtechedge1.vercel.app)

---

## What it is

Vertical AI agents that remember — symptoms, history, preferences — across sessions.

- Multi-layer deep memory (session · episodic · semantic · knowledge · insights)
- Pure Python only (no LangChain, CrewAI, AutoGen, Mem0…)
- Fully local & free (Ollama + SQLite + sentence-transformers)
- Privacy-first: data never leaves your machine
- **Patient journey first**: Baseline → Triage → Visit Prep → Care → Pattern → Recovery

---

## Quick Start

```bash
# 1. Ollama
ollama pull llama3.1

# 2. Python
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3a. Patient journey (recommended)
python run_patient.py

# 3b. Single triage agent
python run_agent.py
```

Force a stage:

```bash
python run_patient.py --stage VISIT_PREP
```

In-session: type `/stage CARE` to switch.

Memory lives in `data/` and survives restarts.

---

## Patient journey stages

| Stage | Agent | Role |
|-------|-------|------|
| BASELINE | Baseline | Profile, allergies, meds, goals |
| TRIAGE | Triage | Symptom structure + cautious red flags |
| VISIT_PREP | VisitPrep | Questions + brief for the clinician visit |
| CARE | CareCompanion | Adherence, side effects, care-plan tasks |
| PATTERN | Pattern | Hypothesis correlations from memory |
| RECOVERY | Recovery | Milestones and “what better looks like” |

Spec: [`docs/PATIENT_JOURNEY.md`](docs/PATIENT_JOURNEY.md)

---

## Architecture

### Memory Layers
1. **Session / Working** – recent turns  
2. **Episodic** – timestamped events, symptoms, visits  
3. **Semantic** – vector long-term facts  
4. **Knowledge** – local RAG over guidelines  
5. **Insights** – synthesized patterns (human-verified)

---

## Project Structure

```
healthcare-deep-memory-agents/
├── docs/PATIENT_JOURNEY.md
├── run_patient.py           ← patient journey CLI
├── run_agent.py             ← single agent CLI
├── src/
│   ├── memory/deep_memory.py
│   └── agents/
│       ├── base_agent.py
│       └── patient_agents.py
├── web/                     ← Cadence UI
└── data/                    ← local DB (gitignored)
```

---

## Roadmap

- [x] Core DeepMemory
- [x] Base HealthcareAgent
- [x] Cadence frontend
- [x] Patient journey agents + orchestrator
- [ ] Patient web surfaces (timeline, check-in, visit brief)
- [ ] Structured symptom schema in episodic meta
- [ ] FastAPI bridge (UI ↔ local agent)
- [ ] Clinician portal (visit brief + notes)
- [ ] Insight consolidator
- [ ] Knowledge RAG loader

---

## License

MIT (code). Any medical content you add keeps its original license.
