"""
Unit tests for Whimsync Perception Gate 1 (Fast-Path) and Gate 2 (LSH Novelty).
"""

from whimsync.perception.fast_path import should_process
from whimsync.perception.lsh_novelty import check_and_register_novelty, clear_space_lsh


def test_fast_path_rejections():
    """Verify Gate 1 immediately rejects low-entropy chatter, filler, and empty text."""
    # Empty / whitespace
    res = should_process("   \n\t  ")
    assert not res.should_process
    assert res.reason == "empty_input"

    # Very short inputs
    res = should_process("k")
    assert not res.should_process
    assert res.reason == "too_short"

    # Trivial conversational acknowledgments and greetings
    for chatter in ["hello", "hi!", "okay...", "thanks", "got it", "sounds good", "ping", "roger"]:
        res = should_process(chatter)
        assert not res.should_process, f"Expected '{chatter}' to be rejected"
        assert res.reason == "trivial_chatter"

    # Low Shannon entropy / repetitive spam
    res = should_process("oooooooooookkkkkkkk")
    assert not res.should_process
    assert res.reason == "low_entropy_repeats"


def test_fast_path_acceptance():
    """Verify Gate 1 accepts meaningful sentences containing entity-relationship substance."""
    valid_sentences = [
        "User prefers Python 3.12 for async API development.",
        "We decided to use SQLite WAL mode to prevent locking.",
        "The project database directory is located at /data/spaces.",
    ]
    for text in valid_sentences:
        res = should_process(text)
        assert res.should_process, f"Expected '{text}' to be accepted"
        assert res.reason == "valid_content"


def test_lsh_novelty_deduplication():
    """Verify Gate 2 catches exact and near-duplicate semantic statements via MinHash LSH."""
    space_id = "test_lsh_dedup"
    clear_space_lsh(space_id)

    stmt_1 = "I prefer using Python 3.12 for building asynchronous APIs."
    res = check_and_register_novelty(space_id, stmt_1, key_id="fact_100", threshold=0.75)
    assert res.is_novel, "First statement must be novel"
    assert len(res.matched_ids) == 0

    # Exact duplicate check
    res_exact = check_and_register_novelty(space_id, stmt_1, key_id="fact_101", threshold=0.75)
    assert not res_exact.is_novel, "Exact statement must be caught as duplicate"
    assert "fact_100" in res_exact.matched_ids

    # Near-duplicate check (slight rephrasing / extra words)
    stmt_near = "I prefer using Python 3.12 for building asynchronous API services."
    res_near = check_and_register_novelty(space_id, stmt_near, key_id="fact_102", threshold=0.75)
    assert not res_near.is_novel, f"Near-duplicate should be caught by LSH: {res_near}"
    assert "fact_100" in res_near.matched_ids

    # Completely novel statement
    stmt_novel = "We configured SQLite with WAL mode and a 5000 millisecond busy timeout."
    res_novel = check_and_register_novelty(space_id, stmt_novel, key_id="fact_103", threshold=0.75)
    assert res_novel.is_novel, "Distinct topic must be flagged as novel"

    clear_space_lsh(space_id)


def test_lsh_space_isolation():
    """Verify LSH indexes are strictly isolated between different cognitive spaces."""
    space_a = "space_alpha"
    space_b = "space_beta"
    clear_space_lsh(space_a)
    clear_space_lsh(space_b)

    shared_stmt = "The database architecture relies on SQLite in-memory caching."

    # Register in Space Alpha
    res_a = check_and_register_novelty(space_a, shared_stmt, key_id="fact_alpha_1")
    assert res_a.is_novel

    # Same statement checked in Space Beta should STILL be novel!
    res_b = check_and_register_novelty(space_b, shared_stmt, key_id="fact_beta_1")
    assert res_b.is_novel, "Statement in separate space must not be rejected as duplicate"

    clear_space_lsh(space_a)
    clear_space_lsh(space_b)
