"""
Whimsync Gate 2: In-Memory LSH Novelty Checker.

Uses Locality-Sensitive Hashing (datasketch MinHashLSH) to detect duplicate or
near-duplicate semantic statements (<1ms SLA target) without touching SQLite or embedding APIs.
"""

import re

from datasketch import MinHash, MinHashLSH
from pydantic import BaseModel, Field


class NoveltyResult(BaseModel):
    """Result of the LSH novelty check."""

    is_novel: bool = Field(..., description="True if the statement is novel; False if duplicate or near-duplicate.")
    matched_ids: list[str] = Field(default_factory=list, description="Existing fact IDs that matched as duplicates.")
    similarity_threshold: float = Field(..., description="Jaccard similarity threshold used for LSH query.")


class SpaceLSHIndex:
    """Space-scoped LSH index managing MinHash signatures for deduplication."""

    def __init__(self, threshold: float = 0.80, num_perm: int = 128):
        self.threshold = threshold
        self.num_perm = num_perm
        self.lsh = MinHashLSH(threshold=threshold, num_perm=num_perm)
        self.signatures: dict[str, MinHash] = {}

    def _shingle(self, text: str, n: int = 3) -> set[str]:
        """Convert string to a set of lowercase character n-gram shingles."""
        cleaned = re.sub(r"\s+", " ", text.lower().strip())
        if len(cleaned) < n:
            return {cleaned}
        return {cleaned[i : i + n] for i in range(len(cleaned) - n + 1)}

    def create_minhash(self, text: str) -> MinHash:
        """Create a MinHash signature from input text shingles."""
        m = MinHash(num_perm=self.num_perm)
        for shingle in self._shingle(text):
            m.update(shingle.encode("utf-8"))
        return m

    def check_novelty(self, text: str) -> tuple[bool, list[str]]:
        """Query LSH index to check if text is novel or near-duplicate."""
        m = self.create_minhash(text)
        matches = self.lsh.query(m)
        return len(matches) == 0, matches

    def add_statement(self, key_id: str, text: str) -> None:
        """Add a statement's MinHash signature to the LSH index."""
        if key_id in self.signatures:
            return
        m = self.create_minhash(text)
        self.signatures[key_id] = m
        self.lsh.insert(key_id, m)

    def remove_statement(self, key_id: str) -> None:
        """Remove a statement signature from LSH index."""
        if key_id in self.signatures:
            self.signatures.pop(key_id)
            try:
                self.lsh.remove(key_id)
            except ValueError:
                pass


# Global in-memory registry mapping space_id -> SpaceLSHIndex
_LSH_REGISTRY: dict[str, SpaceLSHIndex] = {}


def get_space_lsh(space_id: str, threshold: float = 0.80, num_perm: int = 128) -> SpaceLSHIndex:
    """Acquire or initialize an in-memory LSH index for a specific cognitive space."""
    if space_id not in _LSH_REGISTRY:
        _LSH_REGISTRY[space_id] = SpaceLSHIndex(threshold=threshold, num_perm=num_perm)
    return _LSH_REGISTRY[space_id]


def check_and_register_novelty(
    space_id: str,
    text: str,
    key_id: str | None = None,
    threshold: float = 0.80,
    register_if_novel: bool = True,
) -> NoveltyResult:
    """
    Evaluate if an input statement is novel within a cognitive space.
    If register_if_novel is True and key_id is provided, automatically adds novel statements to index.
    """
    lsh_index = get_space_lsh(space_id, threshold=threshold)
    is_novel, matches = lsh_index.check_novelty(text)

    if is_novel and register_if_novel and key_id:
        lsh_index.add_statement(key_id, text)

    return NoveltyResult(
        is_novel=is_novel,
        matched_ids=matches,
        similarity_threshold=threshold,
    )


def clear_space_lsh(space_id: str) -> None:
    """Clear and remove the LSH index for a space (used in GDPR deletion or test cleanup)."""
    if space_id in _LSH_REGISTRY:
        del _LSH_REGISTRY[space_id]
