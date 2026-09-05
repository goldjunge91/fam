"""Self-contained ChainForge provider for recipe-suggestion verification."""

from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.request
from email.utils import parsedate_to_datetime
from typing import Any

from chainforge.providers import provider


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "z-ai/glm-5.2:free",
    "upstage/solar-pro4",
    "z-ai/glm-5.3-flash",
]
OPENROUTER_MODEL = "z-ai/glm-5.3-flash"
MAX_RATE_LIMIT_RETRIES = 2
MAX_RETRY_WAIT_SECONDS = 60

# Embedded deliberately: ChainForge caches uploaded provider scripts outside the
# project, so provider execution must not depend on repository-relative files.
RECIPE_SUGGESTION_RESPONSE_SCHEMA: dict[str, Any] = json.loads(r"""
{
  "title": "Recipe suggestion response",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "meals"],
  "properties": {
    "schema_version": {
      "const": 1
    },
    "meals": {
      "type": "array",
      "minItems": 1,
      "maxItems": 3,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "title",
          "source",
          "recipe_id",
          "servings",
          "used_items",
          "additional_ingredients",
          "steps",
          "notes"
        ],
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1
          },
          "source": {
            "enum": ["catalog", "template", "model_generated"]
          },
          "recipe_id": {
            "anyOf": [
              {
                "type": "string",
                "minLength": 1
              },
              {
                "type": "null"
              }
            ]
          },
          "servings": {
            "type": "integer",
            "minimum": 1
          },
          "used_items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["inventory_item_id", "quantity", "unit"],
              "properties": {
                "inventory_item_id": {
                  "type": "string",
                  "minLength": 1
                },
                "quantity": {
                  "type": "number",
                  "exclusiveMinimum": 0
                },
                "unit": {
                  "type": "string",
                  "minLength": 1
                }
              }
            }
          },
          "additional_ingredients": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "steps": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "notes": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    }
  }
}
""")


def _resolve_model(model: str | None) -> str:
    # ChainForge passes only the segment after the last slash in a custom model.
    if not model:
        return OPENROUTER_MODEL
    for candidate in OPENROUTER_MODELS:
        if model in (candidate, candidate.rsplit("/", 1)[-1]):
            return candidate
    raise RuntimeError(f"Unbekanntes Testmodell: {model}")


def _messages(
    prompt: str, chat_history: list[dict[str, Any]] | None
) -> list[dict[str, Any]]:
    messages = list(chat_history or [])
    messages.append({"role": "user", "content": prompt})
    return messages


def _response_text(response_payload: dict[str, Any]) -> str:
    provider_error = response_payload.get("error")
    choices = response_payload.get("choices")
    choice = choices[0] if isinstance(choices, list) and choices else None
    if isinstance(choice, dict):
        provider_error = provider_error or choice.get("error")
    if provider_error:
        code = provider_error.get("code", "unknown") if isinstance(provider_error, dict) else "unknown"
        raise RuntimeError(f"OpenRouter meldet einen Provider-Fehler (code={code}).")
    try:
        message = choice["message"]
        content = message["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("OpenRouter-Antwort enthält keinen Modelltext.") from error

    finish_reason = choice.get("finish_reason")
    if finish_reason == "length":
        raise RuntimeError("OpenRouter-Antwort am Tokenlimit abgebrochen (finish_reason=length).")
    if message.get("refusal"):
        raise RuntimeError("OpenRouter hat die Anfrage abgelehnt (refusal).")
    if finish_reason not in (None, "stop"):
        raise RuntimeError(f"OpenRouter-Antwort nicht abgeschlossen (finish_reason={finish_reason}).")
    if content is None or (isinstance(content, str) and not content.strip()):
        raise RuntimeError(f"OpenRouter lieferte leeren Modelltext (finish_reason={finish_reason}).")
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        return json.dumps(content, ensure_ascii=False)
    raise RuntimeError("OpenRouter-Antwort enthält ein unbekanntes Inhaltsformat.")


def _retry_after_seconds(error: urllib.error.HTTPError, body: str, attempt: int) -> float:
    values = [error.headers.get("Retry-After") if error.headers else None]
    try:
        metadata = json.loads(body)["error"]["metadata"]
        values.append(metadata.get("retry_after_seconds"))
        headers = metadata.get("headers", {})
        values.append(headers.get("Retry-After", headers.get("retry-after")))
    except (json.JSONDecodeError, KeyError, TypeError, AttributeError):
        pass

    for value in values:
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            continue
        try:
            seconds = float(value)
        except (ValueError, OverflowError):
            try:
                seconds = max(0, parsedate_to_datetime(value).timestamp() - time.time())
            except (ValueError, TypeError, OverflowError):
                continue
        if math.isfinite(seconds) and seconds >= 0:
            return seconds
    return 5 * (2 ** attempt)


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

    resolved_model = _resolve_model(model)
    request_payload = {
        "model": resolved_model,
        "messages": _messages(prompt, chat_history),
        "temperature": 0,
        "top_p": 1,
        "max_tokens": 8192,
        "reasoning": (
            {"effort": "low"} if resolved_model == "z-ai/glm-5.3-flash"
            else {"enabled": False}
        ),
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
    # Solar supports strict JSON Schema, but its endpoints do not support seed.
    if resolved_model != "upstage/solar-pro4":
        request_payload["seed"] = 0
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
        for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    response_payload = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as error:
                body = error.read().decode("utf-8", errors="replace")
                error.close()
                if error.code == 429 and attempt < MAX_RATE_LIMIT_RETRIES:
                    delay = _retry_after_seconds(error, body, attempt)
                    # Never retry earlier than requested or wait indefinitely.
                    if delay <= MAX_RETRY_WAIT_SECONDS:
                        time.sleep(delay)
                        continue
                raise RuntimeError(
                    f"OpenRouter-Anfrage ist mit HTTP {error.code} "
                    f"nach {attempt + 1} Versuch(en) fehlgeschlagen: {body}"
                ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"OpenRouter konnte nicht erreicht werden: {error.reason}") from error
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("OpenRouter-Antwort konnte nicht gelesen werden.") from error

    if not isinstance(response_payload, dict):
        raise RuntimeError("OpenRouter-Antwort muss ein JSON-Objekt sein.")
    return _response_text(response_payload)
