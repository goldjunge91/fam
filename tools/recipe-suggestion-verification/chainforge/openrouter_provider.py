"""ChainForge custom provider for deterministic recipe-suggestion checks."""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

from chainforge.providers import provider


DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "ibm-granite/granite-4.2-8b"
DEFAULT_REASONING_EFFORT = "low"
MAX_TOKENS = 1536
REQUEST_TIMEOUT_SECONDS = 60
SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent
    / "promptfoo"
    / "schemas"
    / "recipe-suggestion-response.schema.json"
)


def _load_response_schema() -> Dict[str, Any]:
    try:
        with SCHEMA_PATH.open("r", encoding="utf-8") as schema_file:
            schema = json.load(schema_file)
    except OSError as error:
        raise RuntimeError(
            "Kanonsches Rezeptvorschlags-Schema konnte nicht gelesen werden: "
            f"{SCHEMA_PATH}"
        ) from error
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "Kanonsches Rezeptvorschlags-Schema enthält ungültiges JSON: "
            f"{SCHEMA_PATH}"
        ) from error

    if not isinstance(schema, dict):
        raise RuntimeError(
            "Kanonsches Rezeptvorschlags-Schema muss ein JSON-Objekt sein: "
            f"{SCHEMA_PATH}"
        )
    return schema


def _messages(
    prompt: str, chat_history: Optional[List[Dict[str, Any]]]
) -> List[Dict[str, Any]]:
    if not isinstance(prompt, str):
        raise ValueError("prompt muss ein String sein.")

    if chat_history is None:
        history: List[Dict[str, Any]] = []
    elif isinstance(chat_history, list) and all(
        isinstance(message, dict) for message in chat_history
    ):
        history = [dict(message) for message in chat_history]
    else:
        raise ValueError("chat_history muss eine Liste von Nachrichtenobjekten sein.")

    history.append({"role": "user", "content": prompt})
    return history


def _effective_model(model: Optional[str]) -> str:
    if model is not None and not isinstance(model, str):
        raise ValueError("model muss ein String oder None sein.")

    selected_model = (model or os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODEL).strip()
    if not selected_model:
        raise ValueError("Kein OpenRouter-Modell konfiguriert.")
    return selected_model


def _endpoint() -> str:
    base_url = (os.environ.get("OPENROUTER_BASE_URL") or DEFAULT_BASE_URL).strip()
    if not base_url:
        raise ValueError("OPENROUTER_BASE_URL darf nicht leer sein.")
    return base_url.rstrip("/") + "/chat/completions"


def _body_text(body: bytes) -> str:
    try:
        return body.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError("OpenRouter antwortete nicht mit gültigem UTF-8-JSON.") from error


def _provider_error(payload: Any) -> Optional[str]:
    if not isinstance(payload, dict) or payload.get("error") is None:
        return None

    error = payload["error"]
    if isinstance(error, dict):
        message = error.get("message") or error.get("code")
        if message:
            return str(message)
    return str(error)


@provider(name="OpenRouter Rezeptvorschlag", emoji="🍳")
def openrouter_recipe_suggestion(
    prompt: str,
    model: Optional[str] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    **kwargs: Any,
) -> str:
    """Return a structured recipe suggestion through OpenRouter.

    ChainForge may pass provider settings through ``kwargs``. The contract
    intentionally ignores them so callers cannot override deterministic
    sampling or the canonical structured-output format.
    """
    del kwargs

    api_key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY ist nicht gesetzt.")

    payload = {
        "model": _effective_model(model),
        "messages": _messages(prompt, chat_history),
        "temperature": 0,
        "top_p": 1,
        "seed": 0,
        "max_tokens": MAX_TOKENS,
        "reasoning": {"effort": DEFAULT_REASONING_EFFORT},
        "provider": {"require_parameters": True},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recipe_suggestion_response",
                "strict": True,
                "schema": _load_response_schema(),
            },
        },
    }

    try:
        request_body = json.dumps(payload).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ValueError("OpenRouter-Anfrage enthält nicht serialisierbare JSON-Daten.") from error

    request = urllib.request.Request(
        _endpoint(),
        data=request_body,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", None) or response.getcode()
            body = response.read()
    except urllib.error.HTTPError as error:
        detail = _body_text(error.read()).strip()
        raise RuntimeError(
            f"OpenRouter HTTP-Fehler {error.code}: {detail or error.reason}"
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        reason = getattr(error, "reason", error)
        raise RuntimeError(f"OpenRouter-Anfrage fehlgeschlagen: {reason}") from error
    except OSError as error:
        raise RuntimeError(f"OpenRouter-Anfrage fehlgeschlagen: {error}") from error

    if status < 200 or status >= 300:
        raise RuntimeError(f"OpenRouter HTTP-Fehler {status}: {_body_text(body).strip()}")

    body_text = _body_text(body)
    try:
        response_payload = json.loads(body_text)
    except json.JSONDecodeError as error:
        raise RuntimeError("OpenRouter antwortete mit ungültigem JSON.") from error

    provider_error = _provider_error(response_payload)
    if provider_error is not None:
        raise RuntimeError(f"OpenRouter Provider-Fehler: {provider_error}")

    if not isinstance(response_payload, dict):
        raise RuntimeError("OpenRouter-Antwort muss ein JSON-Objekt sein.")
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("OpenRouter-Antwort enthält keine choices.")
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise RuntimeError("OpenRouter-Antwort enthält eine ungültige choice.")
    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("OpenRouter-Antwort enthält keine gültige message.")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        refusal = message.get("refusal")
        detail = f": {refusal}" if refusal else "."
        raise RuntimeError(f"OpenRouter lieferte keinen Rezeptvorschlag{detail}")

    try:
        content_payload = json.loads(content)
    except json.JSONDecodeError as error:
        raise RuntimeError("OpenRouter lieferte ungültiges JSON im Rezeptvorschlag.") from error
    if not isinstance(content_payload, dict):
        raise RuntimeError("OpenRouter lieferte kein JSON-Objekt im Rezeptvorschlag.")
    return content
