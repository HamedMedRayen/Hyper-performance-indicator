"""
HPI — RAG Retrieval Layer Configuration
========================================
Loads Qdrant + Groq credentials from .env and exposes singleton clients
plus all constants used by the retrieval pipeline.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

log = logging.getLogger("hpi.rag")

# ── Load .env ──────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).parent
_ROOT = _BACKEND_DIR.parent
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=True)

# ── Constants ──────────────────────────────────────────────────
EXCEL_PATH = str(_ROOT / "RAG" / "gym_recommendation.xlsx")
QDRANT_COLLECTION = "hpi_vectors"
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
TEXT_COLUMNS = ["Exercises", "Equipment", "Diet", "Recommendation"]
DUCKDB_TABLE = "gym_data"

# Groq models
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")
CLASSIFICATION_MODEL = os.getenv("CLASSIFICATION_MODEL", "openai/gpt-oss-20b")   # fast, active — classification
SQL_GENERATION_MODEL = os.getenv("SQL_GENERATION_MODEL", GROQ_CHAT_MODEL)          # accurate — SQL generation

# ── Environment variables ──────────────────────────────────────
QDRANT_URL = os.getenv("CLUSTER_ENDPOINT", "")
QDRANT_API_KEY = os.getenv("CLUSTER_API", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ── Singleton clients (lazy-initialized) ───────────────────────
_qdrant_client = None
_groq_client = None


def get_qdrant_client():
    """Return a cached QdrantClient instance."""
    global _qdrant_client
    if _qdrant_client is None:
        if not QDRANT_URL or not QDRANT_API_KEY:
            raise RuntimeError(
                "CLUSTER_ENDPOINT and CLUSTER_API must be set in .env"
            )
        from qdrant_client import QdrantClient
        _qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        log.info(f"[RAG] Qdrant client connected to {QDRANT_URL[:40]}...")
    return _qdrant_client


def get_groq_client():
    """Return a cached Groq client instance."""
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY must be set in .env")
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        log.info("[RAG] Groq client initialized")
    return _groq_client
