from __future__ import annotations

import importlib.util
import io
import json
import os
from email.message import Message
from email.utils import formatdate
from pathlib import Path
from unittest import TestCase, main, mock
from urllib.error import HTTPError


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


def http_error(
    code: int = 429, retry_after: str | None = None, body: str = "{}"
) -> HTTPError:
    headers = Message()
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return HTTPError(
        PROVIDER.OPENROUTER_URL, code, "Provider error", headers,
        io.BytesIO(body.encode("utf-8")),
    )


class OpenRouterProviderV2Test(TestCase):
    def test_response_errors_are_not_reported_as_unknown_content(self) -> None:
        cases = [
            ({"choices": [{"finish_reason": "length", "message": {"content": None}}]}, "Tokenlimit.*length"),
            ({"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}, "Tokenlimit"),
            ({"choices": [{"finish_reason": "content_filter", "message": {"content": None}}]}, "content_filter"),
            ({"choices": [{"message": {"content": None, "refusal": "refused"}}]}, "abgelehnt"),
            ({"choices": [{"finish_reason": "stop", "message": {"content": "  "}}]}, "leeren Modelltext"),
            ({"choices": [{"finish_reason": "stop", "message": {"content": None}}]}, "leeren Modelltext"),
            ({"error": {"code": 429, "message": "upstream"}}, "Provider-Fehler.*429"),
            ({"choices": [{"error": {"code": 502}, "message": {"content": None}}]}, "Provider-Fehler.*502"),
            ({"choices": []}, "keinen Modelltext"),
            ({"choices": [{"message": {"content": []}}]}, "unbekanntes Inhaltsformat"),
        ]
        for payload, message in cases:
            with self.subTest(payload=payload), self.assertRaisesRegex(RuntimeError, message):
                PROVIDER._response_text(payload)

    def test_response_text_is_never_repaired_or_replaced_by_reasoning(self) -> None:
        content = '{"schema_version":1,"broken":'
        self.assertEqual(PROVIDER._response_text({"choices": [{
            "finish_reason": "stop", "message": {"content": content, "reasoning": "private"},
        }]}), content)

    def test_embedded_schema_matches_promptfoo_canonical_schema(self) -> None:
        schema_path = (
            PROVIDER_PATH.parent.parent
            / "promptfoo"
            / "schemas"
            / "recipe-suggestion-response.schema.json"
        )
        self.assertEqual(
            PROVIDER.RECIPE_SUGGESTION_RESPONSE_SCHEMA,
            json.loads(schema_path.read_text(encoding="utf-8")),
        )

    def test_routes_full_and_chainforge_short_model_names(self) -> None:
        with mock.patch.dict(
            os.environ, {"OPENROUTER_API_KEY": "test-key"}, clear=False
        ), mock.patch.object(PROVIDER.urllib.request, "urlopen") as urlopen:
            urlopen.return_value = FakeResponse(
                {"choices": [{"message": {"content": "{}"}}]}
            )
            for full_name in PROVIDER.OPENROUTER_MODELS:
                for model in (full_name, full_name.rsplit("/", 1)[-1]):
                    with self.subTest(model=model):
                        PROVIDER.OpenRouterRecipeSuggestionV2("test prompt", model=model)
                        request = urlopen.call_args.args[0]
                        payload = json.loads(request.data.decode("utf-8"))
                        self.assertEqual(payload["model"], full_name)
                        self.assertEqual(payload["max_tokens"], 8192)
                        self.assertEqual(payload["reasoning"],
                            {"effort": "low"} if full_name == "z-ai/glm-5.3-flash"
                            else {"enabled": False})
                        if full_name == "upstage/solar-pro4":
                            self.assertNotIn("seed", payload)
                        else:
                            self.assertEqual(payload["seed"], 0)
                        self.assertTrue(payload["provider"]["require_parameters"])
                        self.assertTrue(payload["response_format"]["json_schema"]["strict"])

    def test_unknown_model_fails_before_network_request(self) -> None:
        with mock.patch.dict(
            os.environ, {"OPENROUTER_API_KEY": "test-key"}, clear=False
        ), mock.patch.object(PROVIDER.urllib.request, "urlopen") as urlopen:
            for model in ("unknown", "inclusionai/ling-3.0-flash", "ling-3.0-flash"):
                with self.subTest(model=model), self.assertRaisesRegex(
                    RuntimeError, "Unbekanntes Testmodell"
                ):
                    PROVIDER.OpenRouterRecipeSuggestionV2("test prompt", model=model)
        urlopen.assert_not_called()

    def test_exposes_the_complete_model_matrix(self) -> None:
        self.assertEqual(
            PROVIDER.OPENROUTER_MODELS,
            [
                "z-ai/glm-5.2:free",
                "upstage/solar-pro4",
                "z-ai/glm-5.3-flash",
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
        self.assertEqual(PROVIDER.OPENROUTER_MODEL, "z-ai/glm-5.3-flash")
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

    def test_429_retries_honor_header_then_openrouter_metadata(self) -> None:
        responses = [
            http_error(retry_after="5", body='{"error":{"metadata":{"retry_after_seconds":9}}}'),
            http_error(body='{"error":{"metadata":{"retry_after_seconds":7}}}'),
            FakeResponse({"choices": [{"message": {"content": "{}"}}]}),
        ]
        with (
            mock.patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}),
            mock.patch.object(PROVIDER.urllib.request, "urlopen", side_effect=responses) as urlopen,
            mock.patch.object(PROVIDER.time, "sleep") as sleep,
        ):
            self.assertEqual(PROVIDER.OpenRouterRecipeSuggestionV2("test prompt"), "{}")
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(sleep.call_args_list, [mock.call(5), mock.call(7)])
        first_request = urlopen.call_args_list[0].args[0]
        self.assertTrue(all(call.args[0] is first_request for call in urlopen.call_args_list))

    def test_429_stops_after_two_retries_with_bounded_fallback_backoff(self) -> None:
        with (
            mock.patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}),
            mock.patch.object(PROVIDER.urllib.request, "urlopen", side_effect=[
                http_error(body="not json") for _ in range(3)
            ]) as urlopen,
            mock.patch.object(PROVIDER.time, "sleep") as sleep,
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTP 429 nach 3 Versuch"):
                PROVIDER.OpenRouterRecipeSuggestionV2("test prompt")
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(sleep.call_args_list, [mock.call(5), mock.call(10)])

    def test_permanent_http_errors_and_excessive_waits_are_not_retried(self) -> None:
        for code, retry_after in ((401, "5"), (404, "5"), (429, "3600")):
            with (
                self.subTest(code=code),
                mock.patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}),
                mock.patch.object(PROVIDER.urllib.request, "urlopen", side_effect=
                    http_error(code, retry_after)) as urlopen,
                mock.patch.object(PROVIDER.time, "sleep") as sleep,
            ):
                with self.assertRaisesRegex(RuntimeError, f"HTTP {code} nach 1 Versuch"):
                    PROVIDER.OpenRouterRecipeSuggestionV2("test prompt")
                self.assertEqual(urlopen.call_count, 1)
                sleep.assert_not_called()

    def test_retry_after_parses_dates_and_ignores_invalid_metadata(self) -> None:
        now = 1_700_000_000
        cases = [
            (formatdate(now + 12, usegmt=True), "{}", 12),
            (formatdate(now - 12, usegmt=True), "{}", 0),
            ("0", "{}", 0),
            (None, '{"error":{"metadata":{"headers":{"Retry-After":"8"}}}}', 8),
            ("bad", '{"error":{"metadata":{"retry_after_seconds":6}}}', 6),
            (None, '{"error":{"metadata":{"retry_after_seconds":true}}}', 5),
            ("NaN", '{"error":{"metadata":null}}', 5),
            ("Infinity", '[]', 5),
            ("-1", "not json", 5),
        ]
        with mock.patch.object(PROVIDER.time, "time", return_value=now):
            for header, body, expected in cases:
                with self.subTest(header=header, body=body):
                    error = http_error(retry_after=header)
                    try:
                        self.assertEqual(PROVIDER._retry_after_seconds(error, body, 0), expected)
                    finally:
                        error.close()


if __name__ == "__main__":
    main()
