"""
HPI — Centralized LLM Service
==============================
Provides robust, fault-tolerant Groq LLM completion helper with automatic token budget 
management, message trimming, and seamless model fallbacks (handling HTTP 413 / TPM rate limits).
"""

import os
import logging
from typing import List, Dict, Any, Optional

log = logging.getLogger("hpi.llm")

# Primary default model on Groq
DEFAULT_GROQ_MODEL = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")

# Verified active models on Groq environment
FALLBACK_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound",
    "groq/compound-mini",
    "qwen/qwen3.6-27b",
]


import re

def strip_emojis(text: str) -> str:
    """Strips all emoji characters, symbols, and zero-width joiners from LLM responses."""
    if not text:
        return text
    pattern = re.compile(
        r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\ufe00-\ufe0f\u200d\u200c]+"
    )
    cleaned = pattern.sub("", text)
    cleaned = re.sub(r" +", " ", cleaned)
    return cleaned.strip()


def trim_messages_for_token_limit(messages: List[Dict[str, Any]], max_chars: int = 12000) -> List[Dict[str, Any]]:
    """
    Ensures message list stays strictly within ~3000 tokens (12,000 chars).
    Preserves system messages and the latest user message.
    Truncates intermediate chat history if total text exceeds max_chars.
    """
    if not messages:
        return messages

    total_chars = sum(len(str(m.get("content", ""))) for m in messages)
    if total_chars <= max_chars:
        return messages

    log.info(f"[LLM] Trimming messages (total chars {total_chars} > {max_chars}) for 8k TPM compliance")

    system_msgs = [m for m in messages if m.get("role") == "system"]
    non_system = [m for m in messages if m.get("role") != "system"]

    if not non_system:
        return messages

    latest_msg = non_system[-1]
    history = non_system[:-1]

    # Calculate remaining character budget
    system_chars = sum(len(str(m.get("content", ""))) for m in system_msgs)
    latest_chars = len(str(latest_msg.get("content", "")))
    budget = max(1500, max_chars - system_chars - latest_chars)

    trimmed_history = []
    for m in reversed(history):
        msg_len = len(str(m.get("content", "")))
        if budget - msg_len >= 0:
            trimmed_history.insert(0, m)
            budget -= msg_len
        else:
            break

    result = system_msgs + trimmed_history + [latest_msg]
    log.info(f"[LLM] Message list trimmed from {len(messages)} to {len(result)} items ({sum(len(str(m.get('content',''))) for m in result)} chars)")
    return result


def create_groq_chat_completion(
    client,
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    response_format: Optional[Dict[str, Any]] = None,
    **kwargs
):
    """
    Executes a Groq chat completion call with token limit prevention, automatic model fallbacks,
    and automatic emoji removal across all LLM responses.
    """
    env_model = os.getenv("GROQ_CHAT_MODEL", DEFAULT_GROQ_MODEL)
    requested_model = model or env_model

    # Build unique candidate models list
    candidate_models = [requested_model]
    for fb in FALLBACK_GROQ_MODELS:
        if fb not in candidate_models:
            candidate_models.append(fb)

    current_messages = trim_messages_for_token_limit(messages, max_chars=12000)
    last_exception = None

    for attempt, m_name in enumerate(candidate_models):
        try:
            params = {
                "model": m_name,
                "messages": current_messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            if response_format is not None:
                params["response_format"] = response_format
            
            # Pass any extra kwargs
            for k, v in kwargs.items():
                if k not in params:
                    params[k] = v

            completion = client.chat.completions.create(**params)
            
            # Sanitize completion output to remove all emojis
            if completion and hasattr(completion, "choices") and completion.choices:
                for choice in completion.choices:
                    if hasattr(choice, "message") and choice.message and getattr(choice.message, "content", None):
                        choice.message.content = strip_emojis(choice.message.content)
                        
            return completion

        except Exception as ex:
            err_str = str(ex).lower()
            last_exception = ex
            log.warning(f"[LLM] Model '{m_name}' call failed: {ex}")

            is_token_or_rate_error = any(
                k in err_str for k in [
                    "413", "rate_limit_exceeded", "tpm", "tokens", "request too large", "limit 8000", "limit"
                ]
            )

            if is_token_or_rate_error:
                # Aggressively trim messages for subsequent retries to 7000 chars (~1750 tokens)
                current_messages = trim_messages_for_token_limit(current_messages, max_chars=7000)

            if attempt == len(candidate_models) - 1:
                log.error(f"[LLM] All candidate models ({candidate_models}) exhausted. Final error: {ex}")
                raise last_exception
