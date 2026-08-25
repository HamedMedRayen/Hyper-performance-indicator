"""
HPI RAG — Stage 1C: SQL Generator
===================================
Uses Groq to generate a read-only SQL SELECT statement from a natural
language question, informed by the schema context and question type.

Safety: rejects any SQL containing DDL/DML keywords or multiple statements.
"""

import re
import logging

from rag_config import get_groq_client, SQL_GENERATION_MODEL, DUCKDB_TABLE

log = logging.getLogger("hpi.rag.sql_generator")

# Dangerous SQL patterns
_FORBIDDEN_PATTERNS = re.compile(
    r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)

_SQL_PROMPT = """You are a SQL expert. Generate a single read-only SELECT statement for DuckDB
to answer the user's question using the schema below.

{schema_context}

Question type: {question_type}
User question: {question}

Rules:
1. Output ONLY the SQL query — no explanation, no markdown, no code fences.
2. Use ONLY SELECT statements. No INSERT, UPDATE, DELETE, DROP, ALTER.
3. Column names with spaces must be double-quoted: "Fitness Goal", "Fitness Type"
4. The table name is {table_name}
5. Always include the ID column in SELECT so we can link back to members.
6. LIMIT results to 50 rows maximum unless the question asks for aggregation.
7. Use single quotes for string literals: 'Male', 'Weight Loss', 'Yes'
8. For text search in Exercises, Equipment, Diet, Recommendation columns, use ILIKE with % wildcards.

SQL:"""


def _sanitize_sql(sql: str) -> str:
    """Clean up the generated SQL, removing code fences and extra whitespace."""
    # Remove markdown code fences
    sql = re.sub(r"```sql\s*", "", sql, flags=re.IGNORECASE)
    sql = re.sub(r"```\s*", "", sql)
    # Remove leading/trailing whitespace
    sql = sql.strip()
    # Remove trailing semicolons (DuckDB doesn't need them)
    sql = sql.rstrip(";").strip()
    return sql


def _is_safe(sql: str) -> bool:
    """Check that SQL is read-only and doesn't contain dangerous operations."""
    if _FORBIDDEN_PATTERNS.search(sql):
        return False
    # Check for multiple statements (semicolons in the middle)
    if ";" in sql:
        return False
    # Must start with SELECT (after stripping)
    if not sql.strip().upper().startswith("SELECT"):
        return False
    return True


_FALLBACK_SQL = f"SELECT * FROM {DUCKDB_TABLE} LIMIT 50"


def generate_sql(
    question: str,
    schema_context: str,
    question_type: str,
) -> str:
    """
    Generate a SQL SELECT statement to answer the user question.

    Parameters
    ----------
    question : The user's natural language question
    schema_context : The formatted schema string from schema_retriever
    question_type : The classified question type label

    Returns
    -------
    A safe, read-only SELECT statement. Falls back to a generic query
    if generation fails or produces unsafe SQL.
    """
    try:
        client = get_groq_client()
        prompt = _SQL_PROMPT.format(
            schema_context=schema_context,
            question_type=question_type,
            question=question,
            table_name=DUCKDB_TABLE,
        )

        from services.llm_service import create_groq_chat_completion
        completion = create_groq_chat_completion(
            client=client,
            model=SQL_GENERATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=500,
        )

        raw_sql = completion.choices[0].message.content.strip()
        sql = _sanitize_sql(raw_sql)

        if not _is_safe(sql):
            log.warning(f"[SQL_GEN] Unsafe SQL rejected: {sql[:100]}...")
            return _FALLBACK_SQL

        log.info(f"[SQL_GEN] Generated: {sql[:120]}...")
        return sql

    except Exception as e:
        log.error(f"[SQL_GEN] Groq call failed: {e}")
        return _FALLBACK_SQL
