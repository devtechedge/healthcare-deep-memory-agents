# Healthcare Deep Memory Agents

**Pure Python** vertical agents for the healthcare industry with multi-layer deep memory.

- Zero agentic frameworks (no LangChain, CrewAI, AutoGen, Mem0, etc.)
- Fully local & free (Ollama + SQLite + sentence-transformers / FAISS)
- Privacy-first: all data stays on your machine
- Designed for incremental growth

> **Disclaimer**: This is a research / educational prototype. Never use for real medical advice or clinical decisions. Always consult qualified healthcare professionals.

## Architecture

### Memory Layers
1. **Session / Working** – recent conversation turns
2. **Episodic** – timestamped events, symptoms, visits
3. **Semantic** – vector-searchable long-term facts (allergies, meds, preferences, history)
4. **Knowledge** – RAG over local medical guidelines / documents
5. **Insights** – synthesized patterns (human-verified before permanent)

### Vertical Agents (planned / growing)
- TriageAgent
- SymptomTracker / ChronicCareAgent
- MedicationSafetyAgent
- HistorySummarizer (doctor handoff)
- GuidelineRetriever
- Orchestrator (routes requests)

## Quick Start (Local)

### 1. Prerequisites
```bash
# Install Ollama → https://ollama.com
ollama pull llama3.1          # or any medical-tuned model
# optional: ollama pull nomic-embed-text
```

### 2. Python env
```bash
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run the basic agent loop
```bash
python run_agent.py
```

You will get an interactive CLI. Type patient messages. Memory persists across runs in `data/`.

## Project Structure (current)
```
healthcare-deep-memory-agents/
├── README.md
├── requirements.txt
├── .gitignore
├── src/
│   ├── memory/
│   │   └── deep_memory.py
│   ├── agents/
│   │   └── base_agent.py
│   └── utils/
├── data/                  # local SQLite + vectors (gitignored)
├── knowledge/             # place free medical texts / guidelines here
└── run_agent.py
```

## Development Roadmap (incremental)
- [x] Core DeepMemory (SQLite + embeddings)
- [x] Base HealthcareAgent
- [ ] Multi-agent Orchestrator
- [ ] Medication safety tools (local JSON)
- [ ] Streamlit / simple web UI
- [ ] Insight consolidator + human verification
- [ ] Knowledge RAG loader
- [ ] Evaluation harness

## License
MIT (code). Medical content you add remains under its original licenses.
