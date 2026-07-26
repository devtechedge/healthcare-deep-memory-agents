"""
Base HealthcareAgent – pure Python, no frameworks.
Uses local Ollama + shared DeepMemory.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import ollama

from src.memory.deep_memory import DeepMemory


class HealthcareAgent:
    def __init__(
        self,
        name: str,
        system_prompt: str,
        memory: DeepMemory,
        model: str = "llama3.1",
        tools: Optional[Dict] = None,
    ):
        self.name = name
        self.system_prompt = system_prompt
        self.memory = memory
        self.model = model
        self.tools = tools or {}
        self.history: List[Dict[str, str]] = []

    def _build_context(self, patient_id: str, user_msg: str) -> str:
        semantic = self.memory.search_semantic(user_msg, patient_id=patient_id, top_k=6)
        episodic = self.memory.recent_episodic(patient_id, limit=8)

        parts = []
        if semantic:
            parts.append("Relevant long-term memory:")
            for item in semantic:
                parts.append(f"- {item['content']} (score={item['score']:.2f})")

        if episodic:
            parts.append("\nRecent events:")
            for e in episodic:
                parts.append(f"- [{e['ts'][:19]}] {e['event_type']}: {e['content']}")

        return "\n".join(parts) if parts else "No prior memory for this patient."

    def think(self, patient_id: str, user_msg: str) -> str:
        context = self._build_context(patient_id, user_msg)

        messages = [
            {
                "role": "system",
                "content": (
                    f"{self.system_prompt}\n\n"
                    f"You are assisting for patient_id={patient_id}.\n"
                    f"{context}\n\n"
                    "Rules: Never give definitive diagnoses. "
                    "Always recommend consulting a qualified clinician for medical decisions. "
                    "Be concise, careful, and cite memory when relevant."
                ),
            },
            *self.history[-10:],
            {"role": "user", "content": user_msg},
        ]

        response = ollama.chat(model=self.model, messages=messages)
        answer = response["message"]["content"]

        # Update short-term + episodic memory
        self.history.append({"role": "user", "content": user_msg})
        self.history.append({"role": "assistant", "content": answer})

        self.memory.add_episodic(
            patient_id=patient_id,
            event_type="conversation",
            content=f"User: {user_msg}\n{self.name}: {answer}",
        )

        return answer

    def remember_fact(
        self, patient_id: str, fact: str, tags: Optional[List[str]] = None, importance: float = 0.8
    ) -> None:
        """Explicitly store an important long-term fact."""
        self.memory.add_semantic(patient_id, fact, tags=tags, importance=importance)
