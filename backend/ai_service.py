"""
AI financial advice service using Google Gemini API.
"""

import os
import warnings
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (parent of backend/) or current working directory
_project_root = Path(__file__).resolve().parent.parent
for _env_path in (_project_root / ".env", Path.cwd() / ".env"):
    if _env_path.exists():
        load_dotenv(_env_path)
        break

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Primary model; override with GEMINI_MODEL in .env (see https://ai.google.dev/gemini-api/docs/models)
DEFAULT_MODEL = "gemini-3-flash-preview"
MODEL_NAME = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"]


def _is_quota_exhausted(exc: Exception) -> bool:
    s = str(exc).upper()
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "QUOTA" in s


def get_ai_advice(transaction_summary: str) -> str:
    """
    Send spending summary to Gemini and return financial advice.
    On 429 (quota exceeded), tries fallback models. Raises ValueError if API key is missing.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment.")

    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)

    system_prompt = (
        "You are a friendly financial advisor for everyday people. "
        "Use simple, everyday English and avoid financial jargon. "
        "Give short, direct advice that a 12-year-old could understand. "
        "Answer in at most 5 bullet points, each 1–2 short sentences. "
        "Use Indian Rupee (₹) where relevant and be practical and actionable."
    )
    user_prompt = (
        "Analyze the following spending data and give clear, minimal advice:\n"
        "1. 1–2 key spending insights\n"
        "2. 1–2 simple savings suggestions\n"
        "3. 0–1 short risk warnings (only if really needed)\n\n"
        "Keep the whole answer under about 120 words.\n\n"
        "Data:\n"
        f"{transaction_summary}"
    )
    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    models_to_try = [MODEL_NAME] + [m for m in FALLBACK_MODELS if m != MODEL_NAME]
    last_error = None

    for model in models_to_try:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)  # suppress "non-text parts" warning
                response = client.models.generate_content(
                    model=model,
                    contents=full_prompt,
                )
                text = getattr(response, "text", None)
                if not text and getattr(response, "candidates", None):
                    try:
                        cand = response.candidates[0]
                        content = getattr(cand, "content", None)
                        parts = getattr(content, "parts", []) if content else []
                        text = "".join(
                            getattr(p, "text", "") or "" for p in parts
                        ).strip() or None
                    except (IndexError, AttributeError, TypeError):
                        pass
            if not text:
                raise ValueError("Gemini returned an empty response.")
            return text.strip()
        except Exception as e:
            last_error = e
            if _is_quota_exhausted(e):
                if model != models_to_try[-1]:
                    continue
                raise RuntimeError(
                    "Gemini API quota exceeded (429). "
                    "Wait a minute and try again, or set GEMINI_MODEL in .env to another model (e.g. gemini-1.5-flash). "
                    f"See https://ai.google.dev/gemini-api/docs/rate-limits. Original error: {e}"
                ) from e
            raise RuntimeError(
                f"Gemini API request failed: {e}. "
                "Check GEMINI_API_KEY in .env, network, and model name."
            ) from e
