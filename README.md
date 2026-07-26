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
- Minimalist futuristic UI (light/dark, parallax, water-drop interactions)

---

## Quick Start (Local Agent)

```bash
# 1. Ollama
ollama pull llama3.1

# 2. Python
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Run CLI agent
python run_agent.py
```

Memory is stored in `data/` and survives restarts.

---

## Architecture

### Memory Layers
1. **Session / Working** – recent turns  
2. **Episodic** – timestamped events, symptoms, visits  
3. **Semantic** – vector long-term facts  
4. **Knowledge** – local RAG over guidelines  
5. **Insights** – synthesized patterns (human-verified)

### Vertical Agents
- Triage
- Medication Safety
- Chronic Care
- History Summarizer
- Guideline Retriever
- Orchestrator

---

## Project Structure

```
healthcare-deep-memory-agents/
├── README.md
├── requirements.txt
├── run_agent.py
├── src/
│   ├── memory/deep_memory.py
│   └── agents/base_agent.py
├── web/                     # Cadence UI
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── favicon.svg
├── data/                    # local DB (gitignored)
└── knowledge/
```

---

## Releases

### v0.1.0 — Initial public release
- Core `DeepMemory` (SQLite + vector semantic layer)
- Base `HealthcareAgent` (Ollama)
- Interactive CLI runner
- Cadence web UI (minimalist, light/dark, parallax, water-drop)
- Deployed frontend on Vercel

---

## Roadmap

- [x] Core DeepMemory
- [x] Base HealthcareAgent
- [x] Cadence frontend
- [ ] Multi-agent Orchestrator
- [ ] FastAPI bridge (UI ↔ local agent)
- [ ] Medication safety tools
- [ ] Insight consolidator
- [ ] Knowledge RAG loader

---

## License

MIT (code). Any medical content you add keeps its original license.
