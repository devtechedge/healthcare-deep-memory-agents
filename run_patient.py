#!/usr/bin/env python3
"""
Cadence Patient Journey runner.
Pure Python · local Ollama · shared DeepMemory.

Usage:
    python run_patient.py
    python run_patient.py --stage TRIAGE
"""

from __future__ import annotations

import argparse

from src.agents.patient_agents import PatientOrchestrator
from src.memory.deep_memory import DeepMemory


def main() -> None:
    parser = argparse.ArgumentParser(description="Cadence Patient Journey")
    parser.add_argument(
        "--stage",
        choices=["BASELINE", "TRIAGE", "VISIT_PREP", "CARE", "PATTERN", "RECOVERY"],
        default=None,
        help="Force a journey stage (skip auto-route)",
    )
    parser.add_argument("--model", default="llama3.1", help="Ollama model name")
    parser.add_argument("--patient", default=None, help="patient_id")
    args = parser.parse_args()

    print("=" * 60)
    print("Cadence · Patient Journey")
    print("Stages: BASELINE → TRIAGE → VISIT_PREP → CARE → PATTERN → RECOVERY")
    print("Type 'quit' to exit. Prefix with /stage NAME to force a stage.")
    print("=" * 60)

    memory = DeepMemory()
    orch = PatientOrchestrator(memory=memory, model=args.model)

    patient_id = args.patient or input("patient_id [demo]: ").strip() or "demo"
    print(f"\nSession for patient_id={patient_id}\n")

    force = args.stage

    while True:
        try:
            user_msg = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if user_msg.lower() in {"quit", "exit", "q"}:
            print("Memory persisted in data/.")
            break
        if not user_msg:
            continue

        if user_msg.startswith("/stage "):
            force = user_msg.split(None, 1)[1].strip().upper()
            print(f"(forced stage → {force})")
            continue

        reply = orch.chat(patient_id, user_msg, force_stage=force)
        # clear one-shot force after use unless user keeps setting it via flag
        if args.stage is None:
            force = None
        print(f"\n{reply}\n")

    memory.close()


if __name__ == "__main__":
    main()
