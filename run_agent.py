#!/usr/bin/env python3
"""
Simple interactive runner for the healthcare deep-memory agent.
Usage:
    python run_agent.py
"""

from src.memory.deep_memory import DeepMemory
from src.agents.base_agent import HealthcareAgent


def main():
    print("=" * 60)
    print("Healthcare Deep Memory Agent (pure Python, local)")
    print("Type 'quit' or 'exit' to stop.")
    print("=" * 60)

    memory = DeepMemory()
    agent = HealthcareAgent(
        name="TriageAssistant",
        system_prompt=(
            "You are a careful, privacy-respecting medical triage and information assistant. "
            "You help patients organize symptoms, history, and questions for their doctor. "
            "You never diagnose or prescribe. You always encourage professional medical care."
        ),
        memory=memory,
        model="llama3.1",  # change if you pulled a different model
    )

    patient_id = input("Enter patient_id (or press Enter for 'demo'): ").strip() or "demo"
    print(f"\nSession started for patient_id={patient_id}\n")

    while True:
        try:
            user_msg = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if user_msg.lower() in {"quit", "exit", "q"}:
            print("Session ended. Memory persisted in data/.")
            break

        if not user_msg:
            continue

        answer = agent.think(patient_id, user_msg)
        print(f"\n{agent.name}: {answer}\n")

    memory.close()


if __name__ == "__main__":
    main()
