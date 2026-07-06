---
name: add_sqlite_table
description: Step-by-step instructions for adding a new table or modifying SQLite database schema in Whimsync space databases.
---
# Skill: Add SQLite Table / Modify Schema

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

Use this skill whenever you need to add a new table, virtual table, or column to Whimsync space databases (`/data/spaces/{space_id}.db`).

## 1. Verify Table Ownership Contract
Before defining the DDL, determine which process owns writes to this table:
- **Fast-Core API Only:** For high-throughput ingestion tables (like `episodes`, `raw` facts).
- **Deep-Brain Worker Only:** For synthesized cognitive tables (like `insights`, `edges`, `wiki_sections`).
Document the write owner in a SQL comment above the table definition.

## 2. Define the DDL in `/src/shared/db.py` (or Schema Migrator)
Add your `CREATE TABLE IF NOT EXISTS` statement inside the schema initialization function.
Follow these formatting rules:
- Always define a primary key (`id TEXT PRIMARY KEY` or `INTEGER PRIMARY KEY AUTOINCREMENT`).
- Include `created_at TEXT DEFAULT (datetime('now', 'utc'))` for auditing.
- If the table stores text searches, also define a matching FTS5 virtual table (`CREATE VIRTUAL TABLE IF NOT EXISTS {name}_fts USING fts5(...)`).
- If the table stores vector embeddings, define a `sqlite-vec` virtual table (`CREATE VIRTUAL TABLE IF NOT EXISTS {name}_vec USING vec0(embedding float[1536])`).

## 3. Create Compound Indexes for Fast Namespace Retrieval
If queries will filter by memory container or namespace path, add a compound B-tree index:
```sql
CREATE INDEX IF NOT EXISTS idx_{table_name}_namespace 
ON {table_name} (namespace_path, is_latest, confidence DESC);
```

## 4. Define Matching Pydantic v2 Model
Go to the corresponding domain folder (`/src/storage/models.py` or similar) and create the Pydantic v2 model:
```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class MyNewModel(BaseModel):
    id: str
    namespace_path: str = Field(default="/general")
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
```

## 5. Verify Verification Test
Run unit/integration tests to ensure the new table initializes cleanly on an empty `{space_id}.db` without throwing WAL lock contention errors.
