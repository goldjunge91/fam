"""Self-contained ChainForge provider for recipe-suggestion verification."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from chainforge.providers import provider


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "ibm-granite/granite-4.2-8b",
    "google/gemma-4-26b-a4b-it",
    "qwen/qwen3.8-flash",
    "z-ai/glm-5.3-flash",
    "google/gemma-4-31b-it",
    "minimax/minimax-m3:free",
]
OPENROUTER_MODEL = OPENROUTER_MODELS[0]

# Embedded deliberately: ChainForge caches uploaded provider scripts outside the
# project, so provider execution must not depend on repository-relative files.
RECIPE_SUGGESTION_RESPONSE_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": False,
    "required": ["schema_version", "meals"],
    "properties": {
        "schema_version": {"type": "integer", "const": 1},
        "meals": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "title",
                    "source",
                    "recipe_id",
                    "servings",
                    "used_items",
                    "additional_ingredients",
                    "steps",
                    "notes",
                ],
                "properties": {
                    "title": {"type": "string", "minLength": 1},
                    "source": {
                        "type": "string",
                        "enum": ["catalog", "template", "model_generated"],
                    },
                    "recipe_id": {
                        "anyOf": [
                            {"type": "string", "minLength": 1},
                            {"type": "null"},
                        ]
                    },
                    "servings": {"type": "integer", "minimum": 1},
                    "used_items": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["inventory_item_id", "quantity", "unit"],
                            "properties": {
                                "inventory_item_id": {
                                    "type": "string",
                                    "minLength": 1,
                                },
                                "quantity": {
                                    "type": "number",
                                    "exclusiveMinimum": 0,
                                },
                                "unit": {"type": "string", "minLength": 1},
                            },
                        },
                    },
                    "additional_ingredients": {
                        "type": "array",
                        "items": {"type": "string", "minLength": 1},
                    },
                    "steps": {
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "string", "minLength": 1},
                    },
                    "notes": {
                        "type": "array",
                        "items": {"type": "string", "minLength": 1},
                    },
                },
            },
        },
    },
}


def _messages(
    prompt: str, chat_history: list[dict[str, Any]] | None
) -> list[dict[str, Any]]:
    messages = list(chat_history or [])
    messages.append({"role": "user", "content": prompt})
    return messages


def _response_text(response_payload: dict[str, Any]) -> str:
    try:
        content = response_payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("OpenRouter-Antwort enthält keinen Modelltext.") from error

    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        return json.dumps(content, ensure_ascii=False)
    raise RuntimeError("OpenRouter-Antwort enthält ein unbekanntes Inhaltsformat.")


@provider(
    name="OpenRouter Rezeptvorschlag v2",
    emoji="R2",
    models=OPENROUTER_MODELS,
    rate_limit="sequential",
)
def OpenRouterRecipeSuggestionV2(
    prompt: str,
    model: str | None = None,
    chat_history: list[dict[str, Any]] | None = None,
    **_: Any,
) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY ist nicht gesetzt.")

    request_payload = {
        "model": model or OPENROUTER_MODEL,
        "messages": _messages(prompt, chat_history),
        "temperature": 0,
        "top_p": 1,
        "seed": 0,
        "max_tokens": 1536,
        "reasoning": {"effort": "low"},
        "provider": {"require_parameters": True},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recipe_suggestion_response",
                "strict": True,
                "schema": RECIPE_SUGGESTION_RESPONSE_SCHEMA,
            },
        },
    }
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "fam recipe suggestion verification",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"OpenRouter-Anfrage ist mit HTTP {error.code} fehlgeschlagen: {body}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"OpenRouter konnte nicht erreicht werden: {error.reason}") from error
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("OpenRouter-Antwort konnte nicht gelesen werden.") from error

    if not isinstance(response_payload, dict):
        raise RuntimeError("OpenRouter-Antwort muss ein JSON-Objekt sein.")
    return _response_text(response_payload)
