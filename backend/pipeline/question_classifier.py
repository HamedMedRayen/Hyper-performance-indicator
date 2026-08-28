"""
HPI RAG — Stage 1B: Question Classifier
=========================================
Uses a fast Groq model to classify the user question into one of six
predefined categories. This classification helps the SQL generator
produce more targeted queries.
"""

import logging
from enum import Enum

from rag_config import get_groq_client, CLASSIFICATION_MODEL

log = logging.getLogger("hpi.rag.classifier")


class QuestionType(str, Enum):
    PERFORMANCE_ANALYSIS = "PERFORMANCE_ANALYSIS"
    RECOMMENDATION = "RECOMMENDATION"
    COMPARISON = "COMPARISON"
    TREND_PROGRESS = "TREND_PROGRESS"
    ADHERENCE_BEHAVIOR = "ADHERENCE_BEHAVIOR"
    GENERAL_OTHER = "GENERAL_OTHER"


_CLASSIFICATION_PROMPT = """You are a question classifier for a fitness/gym recommendation database.

Classify the following question into EXACTLY ONE of these categories:

- PERFORMANCE_ANALYSIS: Questions analyzing BMI, weight, height, age statistics, distributions, or member metrics
- RECOMMENDATION: Questions asking for a workout plan, exercise routine, diet/meal plan, or equipment recommendations
- COMPARISON: Questions comparing groups (e.g., male vs female, diabetic vs non-diabetic, different BMI levels)
- TREND_PROGRESS: Questions about patterns, distributions, counts, or trends across the dataset
- ADHERENCE_BEHAVIOR: Questions about what equipment, exercises, or programs members actually use/follow
- GENERAL_OTHER: Questions that don't fit any above category, or are casual/conversational

Respond with ONLY the category label, nothing else. No explanation, no punctuation.

Question: {question}
Category:"""


def classify_question(question: str) -> QuestionType:
    """
    Classify a user question into a QuestionType using Groq.

    Uses a fast model (llama-3.1-8b-instant) for minimal latency.
    Defaults to GENERAL_OTHER on any parse failure.
    """
    try:
        client = get_groq_client()
        from services.llm_service import create_groq_chat_completion
        completion = create_groq_chat_completion(
            client=client,
            model=CLASSIFICATION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": _CLASSIFICATION_PROMPT.format(question=question),
                }
            ],
            temperature=0.0,
            max_tokens=150,
        )

        raw = completion.choices[0].message.content.strip().upper()
        # Clean up any extra text
        raw = raw.replace(" ", "_").split("\n")[0].strip(".:*`'\"")

        if not raw:
            log.warning(f"[CLASSIFIER] Empty response from model, defaulting to RECOMMENDATION")
            return QuestionType.RECOMMENDATION

        # Try to match to enum
        try:
            result = QuestionType(raw)
            log.info(f"[CLASSIFIER] '{question[:60]}...' → {result.value}")
            return result
        except ValueError:
            # Try partial match (ensure raw is non-empty)
            for qt in QuestionType:
                if (qt.value in raw) or (len(raw) >= 4 and raw in qt.value):
                    log.info(
                        f"[CLASSIFIER] Partial match '{raw}' → {qt.value}"
                    )
                    return qt

            log.warning(
                f"[CLASSIFIER] Could not parse '{raw}', defaulting to GENERAL_OTHER"
            )
            return QuestionType.GENERAL_OTHER

    except Exception as e:
        log.error(f"[CLASSIFIER] Groq call failed: {e}")
        return QuestionType.GENERAL_OTHER
