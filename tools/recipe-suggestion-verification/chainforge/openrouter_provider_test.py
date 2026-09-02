"""Offline contract tests for the ChainForge OpenRouter provider."""

import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest import mock


PROVIDER_PATH = Path(__file__).with_name("openrouter_provider.py")
SPEC = importlib.util.spec_from_file_location("recipe_openrouter_provider", PROVIDER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Provider-Modul konnte nicht geladen werden: {PROVIDER_PATH}")
PROVIDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROVIDER)


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def getcode(self):
        return self.status

    def read(self):
        content = {
            "schema_version": 1,
            "meals": [
                {
                    "title": "Tomatenpasta",
                    "source": "catalog",
                    "recipe_id": "recipe-tomato-pasta",
                    "servings": 2,
                    "used_items": [],
                    "additional_ingredients": [],
                    "steps": ["Pasta kochen."],
                    "notes": [],
                }
            ],
        }
        return json.dumps(
            {"choices": [{"message": {"content": json.dumps(content)}}]}
        ).encode("utf-8")


class OpenRouterProviderTest(unittest.TestCase):
    def test_request_enforces_the_canonical_structured_output_contract(self):
        captured = {}

        def fake_urlopen(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse()

        with mock.patch.dict(
            os.environ,
            {"OPENROUTER_API_KEY": "test-key"},
            clear=True,
        ), mock.patch.object(PROVIDER.urllib.request, "urlopen", fake_urlopen):
            result = PROVIDER.openrouter_recipe_suggestion(
                "Erzeuge einen Rezeptvorschlag.",
                model=None,
                chat_history=[{"role": "system", "content": "Nur JSON."}],
            )

        request = captured["request"]
        payload = json.loads(request.data.decode("utf-8"))
        expected_schema = json.loads(
            (PROVIDER_PATH.parent.parent / "promptfoo" / "schemas" / PROVIDER.SCHEMA_FILENAME).read_text(
                encoding="utf-8"
            )
        )

        self.assertEqual(request.full_url, "https://openrouter.ai/api/v1/chat/completions")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(captured["timeout"], 120)
        self.assertEqual(payload["model"], PROVIDER.OPENROUTER_MODEL)
        self.assertEqual(payload["temperature"], 0)
        self.assertEqual(payload["top_p"], 1)
        self.assertEqual(payload["seed"], 0)
        self.assertEqual(payload["max_tokens"], 1536)
        self.assertEqual(payload["reasoning"], {"effort": "low"})
        self.assertEqual(payload["provider"], {"require_parameters": True})
        self.assertEqual(
            payload["messages"],
            [
                {"role": "system", "content": "Nur JSON."},
                {"role": "user", "content": "Erzeuge einen Rezeptvorschlag."},
            ],
        )
        self.assertEqual(
            payload["response_format"],
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "recipe_suggestion_response",
                    "strict": True,
                    "schema": expected_schema,
                },
            },
        )
        self.assertEqual(json.loads(result)["schema_version"], 1)

    def test_schema_falls_back_when_cached_provider_has_no_repository_paths(self):
        with mock.patch.object(PROVIDER, "_schema_candidates", return_value=[Path("missing-schema.json")]):
            schema = PROVIDER._load_response_schema()

        self.assertEqual(schema, PROVIDER.EMBEDDED_RESPONSE_SCHEMA)

        repository_schema = json.loads(
            (PROVIDER_PATH.parent.parent / "promptfoo" / "schemas" / PROVIDER.SCHEMA_FILENAME).read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(schema, repository_schema)

    def test_missing_api_key_fails_before_a_network_request(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(
            PROVIDER.urllib.request,
            "urlopen",
        ) as urlopen:
            with self.assertRaisesRegex(RuntimeError, "OPENROUTER_API_KEY"):
                PROVIDER.openrouter_recipe_suggestion("test")

        urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
