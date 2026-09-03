from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from chainforge.providers import provider


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "z-ai/glm-5.3-flash"
SCHEMA_FILENAME = "recipe-suggestion-response.schema.json"

# Custom provider scripts are copied into ChainForge's provider cache. Keep a
# cache-safe fallback here so the provider does not depend on the cached
# script's __file__ location.
EMBEDDED_RESPONSE_SCHEMA: dict[str, Any] = {
    "title": "Recipe suggestion response",
    "type": "object",
    "additionalProperties": False,
    "required": ["schema_version", "meals"],
    "properties": {
        "schema_version": {"const": 1},
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
                    "source": {"enum": ["catalog", "template", "model_generated"]},
                    "recipe_id": {
                        "anyOf": [
                            {"type": "string", "minLength": 1},
                            {"type": "null"},
                        ]
                    },
                    "servings": {"type": "integer", "minimum": 1},
                    "used_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["inventory_item_id", "quantity", "unit"],
                            "properties": {
                                "inventory_item_id": {
                                    "type": "string",
                                    "minLength": 1,
                                },
                                "quantity": {"type": "number", "exclusiveMinimum": 0},
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
                    "notes": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}


def _schema_candidates() -> list[Path]:
    candidates: list[Path] = []
    configured_path = os.environ.get("FAM_RECIPE_SCHEMA_PATH")
    if configured_path:
        candidates.append(Path(configured_path).expanduser())

    # ChainForge caches provider scripts in its Python environment. Its process
    # working directory remains the verification project from which it starts.
    candidates.append(Path.cwd() / "promptfoo" / "schemas" / SCHEMA_FILENAME)

    # Supports importing and testing this source file directly from the repo.
    candidates.append(
        Path(__file__).resolve().parents[1]
        / "promptfoo"
        / "schemas"
        / SCHEMA_FILENAME
    )

    unique_candidates: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in unique_candidates:
            unique_candidates.append(resolved)
    return unique_candidates


def _load_response_schema() -> dict[str, Any]:
    attempted_paths: list[str] = []
    for schema_path in _schema_candidates():
        attempted_paths.append(str(schema_path))
        try:
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            continue
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(
                f"Kanonisches Rezeptvorschlags-Schema ist ungültig: {schema_path}"
            ) from error

        if not isinstance(schema, dict):
            raise RuntimeError(
                f"Kanonisches Rezeptvorschlags-Schema muss ein JSON-Objekt sein: {schema_path}"
            )
        return schema

    # ChainForge executes a cached copy of this script, where repository-based
    # paths are unavailable. The embedded schema keeps that copy functional.
    return EMBEDDED_RESPONSE_SCHEMA


def _messages(
    prompt: str, chat_history: list[dict[str, Any]] | None
) -> list[dict[str, Any]]:
    messages = list(chat_history or [])
    messages.append({"role": "user", "content": prompt})
    return messages


def _response_text(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("OpenRouter-Antwort enthält keinen Modelltext.") from error

    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        return json.dumps(content, ensure_ascii=False)
    raise RuntimeError("OpenRouter-Antwort enthält ein unbekanntes Inhaltsformat.")


@provider(
    name="OpenRouter Rezeptvorschlag",
    emoji="R",
    models=[OPENROUTER_MODEL],
    rate_limit="sequential",
)
def openrouter_recipe_suggestion(
    prompt: str,
    model: str | None = None,
    chat_history: list[dict[str, Any]] | None = None,
    **_: Any,
) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY ist nicht gesetzt.")

    schema = _load_response_schema()
    request_payload = {
        "model": model or OPENROUTER_MODEL,
        "messages": _messages(prompt, chat_history),
        "temperature": 0,
        "top_p": 1,
        "seed": 0,
        "max_tokens": 8192,
        "reasoning": {"effort": "low"},
        "provider": {"require_parameters": True},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recipe_suggestion_response",
                "strict": True,
                "schema": schema,
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
