"""
Whimsync Gate 1: Low-Entropy Regex Bypass Filter.

Intercepts trivial conversational chatter (<1ms SLA target) before it ever burns
LLM embedding tokens or SQLite write transactions.
"""

import math
import re

from pydantic import BaseModel, Field

# Pre-compiled regex patterns for lightning-fast matching (<0.1ms)
TRIVIAL_CHATTER_REGEX = re.compile(
    r"^(?:hi|hello|hey|yo|greetings|bye|goodbye|see\s+ya|morning|night|"
    r"ok|okay|k|yes|yep|yeah|no|nope|sure|right|got\s+it|sounds\s+good|cool|"
    r"thanks|thank\s+you|thx|perfect|awesome|great|nice|understood|roger|ack|"
    r"test|ping|pong|foo|bar|test\s+123|testing|hm|hmm|hmmm|uh|um|er|ah|oh)"
    r"[\s\!\.\,\;\:\-\?]*$",
    re.IGNORECASE,
)


class FastPathResult(BaseModel):
    """Result of the Fast-Path regex heuristic filter."""

    should_process: bool = Field(..., description="Whether the input contains valid information for fact extraction.")
    reason: str = Field(..., description="Reason for acceptance or rejection.")
    entropy_score: float = Field(..., description="Calculated Shannon entropy score of the text.")


def calculate_shannon_entropy(text: str) -> float:
    """Calculate the Shannon entropy of a string in bits per character."""
    if not text:
        return 0.0
    length = len(text)
    counts = {}
    for char in text:
        counts[char] = counts.get(char, 0) + 1

    entropy = 0.0
    for count in counts.values():
        prob = count / length
        entropy -= prob * math.log2(prob)
    return entropy


def should_process(raw_text: str) -> FastPathResult:
    """
    Evaluate raw input text against Gate 1 heuristic rules.
    Returns FastPathResult indicating whether to proceed to LSH and Fact Extraction.
    """
    if not raw_text or not raw_text.strip():
        return FastPathResult(should_process=False, reason="empty_input", entropy_score=0.0)

    text = raw_text.strip()
    entropy = calculate_shannon_entropy(text)

    # Rule 1: Very short inputs <= 2 chars without numbers (e.g. "ok", "k", "hi")
    if len(text) <= 2 and not any(c.isdigit() for c in text):
        return FastPathResult(should_process=False, reason="too_short", entropy_score=entropy)

    # Rule 2: Pre-compiled regex match for trivial conversational acknowledgments/greetings
    if TRIVIAL_CHATTER_REGEX.match(text):
        return FastPathResult(should_process=False, reason="trivial_chatter", entropy_score=entropy)

    # Rule 3: Low Shannon entropy / repetitive character spam (e.g., "oooooooookkkkk")
    # Natural English text typically has Shannon entropy between 3.5 and 5.0 bits/char.
    if len(text) > 6 and entropy < 1.8:
        return FastPathResult(should_process=False, reason="low_entropy_repeats", entropy_score=entropy)

    # Rule 4: Word count check - single trivial words or filler without entity-relation substance
    words = [w for w in text.split() if any(c.isalnum() for c in w)]
    if len(words) < 2 and not any(c.isdigit() for c in text):
        # A single word that didn't match chatter regex might still be just an exclamation or filler
        # We check if it looks like a meaningful entity (capitalized or code term > 4 chars)
        if len(text) < 5:
            return FastPathResult(should_process=False, reason="insufficient_word_density", entropy_score=entropy)

    return FastPathResult(should_process=True, reason="valid_content", entropy_score=entropy)
