---
name: create_fastapi_endpoint
description: Instructions and architectural patterns for creating new FastAPI REST or SSE streaming endpoints in Whimsync.
---
# Skill: Create FastAPI Endpoint

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

Use this skill whenever you need to add a new HTTP REST endpoint or Server-Sent Events (SSE) stream to the Whimsync Fast-Core API (`/src/api/` or `/src/main_api.py`).

## 1. Define Request & Response Pydantic v2 Schemas
All endpoints MUST use Pydantic v2 models for input request bodies and output responses. Do not use raw dictionaries.
```python
from pydantic import BaseModel, Field

class MemoryAddRequest(BaseModel):
    space_id: str = Field(..., description="Target cognitive space ID")
    text: str = Field(..., min_length=1, description="Raw experience text to ingest")
    namespace_path: str = Field(default="/general", description="POSIX container path")

class MemoryAddResponse(BaseModel):
    status: str = "success"
    fact_ids: list[str]
    latency_ms: float
```

## 2. Inject Space-Scoped DB Connection & OpenTelemetry Tracing
Every endpoint that touches SQLite must acquire a space-scoped connection from the pool and wrap execution in a span:
```python
from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace
from src.shared.db import get_space_db

router = APIRouter(prefix="/api/v1/memory", tags=["memory"])
tracer = trace.get_tracer(__name__)

@router.post("/add", response_model=MemoryAddResponse)
async def add_memory(payload: MemoryAddRequest, db = Depends(get_space_db)):
    with tracer.start_as_current_span("api.memory.add") as span:
        span.set_attribute("space_id", payload.space_id)
        # 1. Check Fast-Path regex filter
        # 2. Check LSH novelty index
        # 3. Insert to SQLite & push to Redis Stream
        return MemoryAddResponse(fact_ids=["f_123"], latency_ms=4.2)
```

## 3. Ensure Zero Heavy Compute on the Sync Path
Check your endpoint logic against this checklist:
- [ ] Does it make an outgoing LLM API call? If yes, CANCEL. Move it to the async Deep-Brain worker or use a local SLM/fast-path.
- [ ] Does it execute a long table scan without an index? If yes, add a compound B-tree index.
- [ ] Does it return within the sub-15ms p50 SLA target?

## 4. Add Automated Route Test
Create a test in `/tests/test_api.py` using FastAPI's `TestClient` or `AsyncClient` verifying status code 200, schema compliance, and sub-15ms response SLA target.
