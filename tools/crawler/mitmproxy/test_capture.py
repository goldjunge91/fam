"""
Unit tests for BringTokenCapture mitmproxy addon.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

from capture_bring import BringTokenCapture, decode_jwt_exp, update_env_file, read_env_file


def test_env_file_operations():
    with tempfile.TemporaryDirectory() as tmpdir:
        env_file = Path(tmpdir) / "test.env"
        # Initial write
        update_env_file(env_file, {"FOO": "bar", "BRING_API_KEY": "123"})
        data = read_env_file(env_file)
        assert data["FOO"] == "bar"
        assert data["BRING_API_KEY"] == "123"

        # Update without losing existing keys
        update_env_file(env_file, {"BRING_API_KEY": "456", "BRING_USER_UUID": "abc"})
        data2 = read_env_file(env_file)
        assert data2["FOO"] == "bar"
        assert data2["BRING_API_KEY"] == "456"
        assert data2["BRING_USER_UUID"] == "abc"


def test_bring_request_capture():
    with tempfile.TemporaryDirectory() as tmpdir:
        env_file = Path(tmpdir) / "test.env"
        capture = BringTokenCapture(target_files=[env_file])

        mock_flow = MagicMock()
        mock_flow.request.pretty_host = "production.bringapi.app"
        mock_flow.request.headers = {
            "Authorization": "Bearer secret_test_auth_token",
            "X-BRING-API-KEY": "secret_test_api_key",
            "X-BRING-USER-UUID": "secret_test_user_uuid",
        }

        capture.request(mock_flow)

        assert capture.auth_token == "secret_test_auth_token"
        assert capture.api_key == "secret_test_api_key"
        assert capture.user_uuid == "secret_test_user_uuid"

        # Verify saved in env file
        data = read_env_file(env_file)
        assert data["BRING_AUTH_TOKEN"] == "secret_test_auth_token"
        assert data["BRING_API_KEY"] == "secret_test_api_key"
        assert data["BRING_USER_UUID"] == "secret_test_user_uuid"


def test_bring_response_json_capture():
    with tempfile.TemporaryDirectory() as tmpdir:
        env_file = Path(tmpdir) / "test.env"
        capture = BringTokenCapture(target_files=[env_file])

        mock_flow = MagicMock()
        mock_flow.request.pretty_host = "production.bringapi.app"
        mock_flow.request.headers = {}
        mock_flow.response.headers = {"content-type": "application/json"}
        mock_flow.response.content = json.dumps({
            "access_token": "token_from_json_login",
            "userUuid": "uuid_from_json_login",
        }).encode("utf-8")

        capture.response(mock_flow)

        assert capture.auth_token == "token_from_json_login"
        assert capture.user_uuid == "uuid_from_json_login"

        data = read_env_file(env_file)
        assert data["BRING_AUTH_TOKEN"] == "token_from_json_login"
        assert data["BRING_USER_UUID"] == "uuid_from_json_login"


if __name__ == "__main__":
    test_env_file_operations()
    test_bring_request_capture()
    test_bring_response_json_capture()
    print("All capture_bring tests passed successfully!")
