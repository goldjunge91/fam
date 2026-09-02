from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from unittest import TestCase, main, mock


PROVIDER_PATH = Path(__file__).with_name("openrouter_provider_v2.py")
SPEC = importlib.util.spec_from_file_location("recipe_openrouter_provider_v2", PROVIDER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Provider konnte nicht geladen werden: {PROVIDER_PATH}")
PROVIDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROVIDER)


class FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


class OpenRouterProviderV2Test(TestCase):
    def test_exposes_the_complete_model_matrix(self) -> None:
        self.assertEqual(
            PROVIDER.OPENROUTER_MODELS,
            [
                "ibm-granite/granite-4.2-8b",
                "google/gemma-4-26b-a4b-it",
                "qwen/qwen3.8-flash",
                "z-ai/glm-5.3-flash",
                "google/gemma-4-31b-it",
                "minimax/minimax-m3:free",
            ],
        )

    def test_request_enforces_embedded_structured_output_contract(self) -> None:
        captured: dict[str, object] = {}

        def fake_urlopen(request: object, timeout: int) -> FakeResponse:
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse(
                {
                    "choices": [
                        {
                            "message": {
                                "content": '{"schema_version":1,"meals":[]}'
                            }
                        }
                    ]
                }
            )

        with mock.patch.dict(
            os.environ, {"OPENROUTER_API_KEY": "test-key"}, clear=False
        ), mock.patch.object(PROVIDER.urllib.request, "urlopen", fake_urlopen):
            result = PROVIDER.OpenRouterRecipeSuggestionV2("test prompt")

        request = captured["request"]
        payload = json.loads(request.data.decode("utf-8"))
        response_format = payload["response_format"]

        self.assertEqual(result, '{"schema_version":1,"meals":[]}')
        self.assertEqual(payload["model"], PROVIDER.OPENROUTER_MODEL)
        self.assertEqual(payload["temperature"], 0)
        self.assertEqual(payload["reasoning"], {"effort": "low"})
        self.assertEqual(payload["provider"], {"require_parameters": True})
        self.assertEqual(response_format["type"], "json_schema")
        self.assertTrue(response_format["json_schema"]["strict"])
        self.assertEqual(
            response_format["json_schema"]["schema"],
            PROVIDER.RECIPE_SUGGESTION_RESPONSE_SCHEMA,
        )
        self.assertEqual(captured["timeout"], 120)

    def test_missing_api_key_fails_before_network_request(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(
            PROVIDER.urllib.request, "urlopen"
        ) as urlopen:
            with self.assertRaisesRegex(RuntimeError, "OPENROUTER_API_KEY"):
                PROVIDER.OpenRouterRecipeSuggestionV2("test prompt")

        urlopen.assert_not_called()


if __name__ == "__main__":
    main()
