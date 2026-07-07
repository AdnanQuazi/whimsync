"""
Integration tests for Whimsync Space-Scoped SQLite Manager.
"""

from pathlib import Path

from whimsync.shared.db import get_space_db, init_space_db


def test_init_space_db_and_wal_mode(tmp_path: Path):
    """Verify schema initialization and mandatory WAL pragma enforcement."""
    conn = init_space_db("test_wal_space", data_dir=tmp_path)
    cursor = conn.cursor()

    # Check journal mode
    cursor.execute("PRAGMA journal_mode;")
    mode = cursor.fetchone()[0]
    assert mode.lower() == "wal", f"Expected WAL mode, got {mode}"

    # Check tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' OR type='table' AND sql LIKE '%VIRTUAL%';")
    tables = {row[0] for row in cursor.fetchall()}
    expected_tables = {
        "episodes",
        "facts",
        "fact_embeddings",
        "facts_fts",
        "edges",
        "wiki_sections",
        "identity",
    }
    assert expected_tables.issubset(tables), f"Missing core tables: {expected_tables - tables}"

    conn.close()


def test_sqlite_vec_extension(tmp_path: Path):
    """Verify sqlite-vec virtual table accepts 1536-dim vectors and computes distance."""
    conn = init_space_db("test_vec_space", data_dir=tmp_path)
    cursor = conn.cursor()

    # Create dummy 1536-dim vector string: "[0.1, 0.1, ...]"
    dummy_vec = "[" + ", ".join(["0.1"] * 1536) + "]"

    cursor.execute("INSERT INTO fact_embeddings (fact_id, embedding) VALUES (?, ?);", ("fact_1", dummy_vec))
    conn.commit()

    # Query using vec_distance_cosine
    cursor.execute(
        """
        SELECT fact_id, vec_distance_cosine(embedding, ?) as dist
        FROM fact_embeddings
        WHERE fact_id = 'fact_1';
    """,
        (dummy_vec,),
    )
    row = cursor.fetchone()
    assert row["fact_id"] == "fact_1"
    assert abs(row["dist"]) < 1e-5, "Distance between identical vectors should be ~0"

    conn.close()


def test_concurrent_wal_read_write(tmp_path: Path):
    """Verify WAL allows concurrent reader and writer without lock errors."""
    init_space_db("test_concurrent", data_dir=tmp_path)

    # Open two simultaneous connections to the exact same space DB
    writer_conn = get_space_db("test_concurrent", data_dir=tmp_path)
    reader_conn = get_space_db("test_concurrent", data_dir=tmp_path)

    # Writer starts transaction
    w_cursor = writer_conn.cursor()
    w_cursor.execute("BEGIN IMMEDIATE;")
    w_cursor.execute("""
        INSERT INTO facts (id, space_id, subject, predicate, object, confidence)
        VALUES ('f_1', 'test_concurrent', 'User', 'prefers', 'SQLite', 0.99);
    """)

    # Meanwhile, reader should be able to read facts without raising sqlite3.OperationalError: database is locked
    r_cursor = reader_conn.cursor()
    r_cursor.execute("SELECT count(*) FROM facts;")
    count = r_cursor.fetchone()[0]
    assert count >= 0

    # Commit writer and verify read updates
    writer_conn.commit()
    r_cursor.execute("SELECT subject, predicate, object FROM facts WHERE id = 'f_1';")
    fact = r_cursor.fetchone()
    assert fact["subject"] == "User"
    assert fact["object"] == "SQLite"

    writer_conn.close()
    reader_conn.close()
