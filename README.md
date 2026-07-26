# AetherCare — Healthcare Deep Memory Agents

**Pure Python** vertical agents for healthcare with multi-layer deep memory.

- Zero agentic frameworks (no LangChain, CrewAI, AutoGen, Mem0…)
- Fully local & free (Ollama + SQLite + sentence-transformers)
- Privacy-first: data never leaves your machine
- Modern minimalist UI with light/dark mode, parallax & water-drop interactions

> **Disclaimer**: Educational / research prototype only. Never use for real medical decisions. Always consult qualified clinicians.

---

## Live Frontend

Modern UI lives in `/web`:

- Minimalist + futuristic design
- Light / Dark mode toggle (persisted)
- Smooth parallax scroll
- Water-drop press feel on buttons (scale + ripple)
- Interactive demo chat (simulated replies for static hosting)

### Deploy options

#### Option A — GitHub Pages (static, free)
1. Go to repo **Settings → Pages**
2. Source: Deploy from a branch
3. Branch: `main` → folder `/web` (or root if you prefer)
4. Save. Site will be at `https://devtechedge.github.io/healthcare-deep-memory-agents/`

> Note: GitHub Pages serves the beautiful frontend + demo. Full agent memory requires the local Python backend.

#### Option B — Vercel (recommended for smoother DX)
```bash
npm i -g vercel
cd web
vercel
```
Or connect the repo in the Vercel dashboard and set **Root Directory** to `web`.

Vercel handles the static UI perfectly and makes future API routes easy if you later add a small backend.

---

## Architecture

### Memory Layers
1. **Session / Working** – recent turns
2. **Episodic** – timestamped events, symptoms, visits
3. **Semantic** – vector long-term facts (allergies, meds, history)
4. **Knowledge** – local RAG over guidelines
5. **Insights** – synthesized patterns (human-verified)

### Vertical Agents
- TriageAgent
- MedicationSafetyAgent
- ChronicCare / SymptomTracker
- HistorySummarizer
- GuidelineRetriever
- Orchestrator

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

## Project Structure

```
healthcare-deep-memory-agents/
├── README.md
├── requirements.txt
├── .gitignore
├── run_agent.py
├── src/
│   ├── memory/deep_memory.py
│   └── agents/base_agent.py
├── web/                     ← modern UI (GitHub Pages / Vercel)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                    ← local DB (gitignored)
└── knowledge/               ← drop free guidelines here
```

---

## Roadmap

- [x] Core DeepMemory (SQLite + vectors)
- [x] Base HealthcareAgent
- [x] Modern frontend (light/dark, parallax, water-drop)
- [ ] Multi-agent Orchestrator
- [ ] FastAPI bridge so UI talks to real local agent
- [ ] Medication safety tools
- [ ] Insight consolidator + verification
- [ ] Knowledge RAG loader

---

## License

MIT (code). Any medical content you add keeps its original license.
