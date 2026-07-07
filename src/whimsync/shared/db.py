"""
Whimsync Space-Scoped SQLite Database Manager.

Enforces:
1. Space-Scoped DB Paths (/data/spaces/{space_id}.db)
2. Mandatory WAL Mode & Busy Timeout (PRAGMA journal_mode = WAL, synchronous = NORMAL, busy_timeout = 5000)
3. Native sqlite-vec extension loading
4. Automatic schema migrator for core tables and compound namespace indexes
"""

import sqlite3
from pathlib import Path

import sqlite_vec

DEFAULT_DATA_DIR = Path("./data/spaces")


def get_db_path(space_id: str, data_dir: Path | None = None) -> Path:
    """Resolve the absolute path for a space database and ensure directories exist."""
    base_dir = data_dir or DEFAULT_DATA_DIR
    base_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize space_id to avoid path traversal
    safe_space_id = "".join(c for c in space_id if c.isalnum() or c in ("_", "-"))
    if not safe_space_id:
        raise ValueError("Invalid space_id provided.")

    return base_dir / f"{safe_space_id}.db"


def get_space_db(space_id: str, data_dir: Path | None = None) -> sqlite3.Connection:
    """
    Acquire a connection to a space-scoped SQLite database.
    Enforces WAL mode, synchronous normal, busy timeout, and loads sqlite-vec.
    """
    db_path = get_db_path(space_id, data_dir)
    conn = sqlite3.connect(str(db_path), timeout=5.0)
    conn.row_factory = sqlite3.Row

    # Load sqlite-vec extension for native vector search
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)

    # Mandatory SQLite PRAGMAs for concurrency defense (Layer 1)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA busy_timeout = 5000;")
    cursor.close()

    return conn


def init_space_db(space_id: str, data_dir: Path | None = None) -> sqlite3.Connection:
    """
    Initialize schema for a space database if tables do not exist.
    Creates tables: episodes, facts, fact_embeddings (vec0), facts_fts (fts5), edges, wiki_sections, identity.
    """
    conn = get_space_db(space_id, data_dir)
    cursor = conn.cursor()

    # 1. Episodes (Fast-Core API Only)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now', 'utc'))
    );
    """)

    # 2. Facts (Fast-Core writes raw; Deep-Brain writes promoted tiers)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        is_latest INTEGER DEFAULT 1,
        namespace_path TEXT DEFAULT '/general',
        insight_tier TEXT DEFAULT 'raw',
        provenance TEXT DEFAULT 'machine',
        created_at TEXT DEFAULT (datetime('now', 'utc'))
    );
    """)

    # 3. Fact Embeddings (sqlite-vec virtual table)
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fact_embeddings USING vec0(
        fact_id TEXT PRIMARY KEY,
        embedding float[1536]
    );
    """)

    # 4. Facts FTS5 (Keyword Search virtual table)
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
        fact_id UNINDEXED,
        subject,
        predicate,
        object,
        namespace_path UNINDEXED
    );
    """)

    # 5. Edges (Deep-Brain Worker Only)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'utc'))
    );
    """)

    # 6. Wiki Sections (Deep-Brain + Human Edits)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wiki_sections (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        section_key TEXT NOT NULL,
        namespace_path TEXT DEFAULT '/general',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        provenance TEXT DEFAULT 'machine',
        created_at TEXT DEFAULT (datetime('now', 'utc')),
        updated_at TEXT DEFAULT (datetime('now', 'utc'))
    );
    """)

    # 7. Identity Layer (Deep-Brain + Human Edits)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS identity (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        category TEXT NOT NULL,
        belief_statement TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        decay_rate REAL DEFAULT 0.001,
        provenance TEXT DEFAULT 'machine',
        created_at TEXT DEFAULT (datetime('now', 'utc')),
        last_reinforced_at TEXT DEFAULT (datetime('now', 'utc'))
    );
    """)

    # Compound B-tree Indexes for instant POSIX namespace isolation
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_facts_namespace
    ON facts (namespace_path, is_latest, confidence DESC);
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_wiki_namespace
    ON wiki_sections (namespace_path, version DESC);
    """)

    conn.commit()
    cursor.close()
    return conn
