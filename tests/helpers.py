"""Test doubles. Keep CI free of torch / sentence-transformers / ollama."""

from __future__ import annotations

import hashlib

import numpy as np


class DummyEmbedder:
    def encode(self, text, normalize_embeddings=True):
        digest = hashlib.sha256(str(text).encode("utf-8")).digest()
        vec = np.frombuffer(digest, dtype=np.uint8).astype(np.float32)
        if normalize_embeddings:
            n = float(np.linalg.norm(vec)) or 1.0
            vec = vec / n
        return vec
