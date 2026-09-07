"""
Mitmproxy Addon zur automatischen Erfassung von Bring!-API-Tokens (SSL/HTTPS).

Lauscht auf Requests und Responses an Bring!-Endpunkte (z.B. production.bringapi.app)
und extrahiert:
  - BRING_AUTH_TOKEN
  - BRING_API_KEY
  - BRING_USER_UUID

Speichert gefundene Keys direkt in:
  - tokens_backup.env (im Repository-Root)
  - tools/crawler/.env
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from mitmproxy import ctx, http

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logger = logging.getLogger("bring-capture")

# Basis-Pfade finden
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
CRAWLER_DIR = SCRIPT_DIR.parent

DEFAULT_TARGET_ENV_FILES = [
    REPO_ROOT / "tokens_backup.env",
    CRAWLER_DIR / ".env",
]


def decode_jwt_exp(token: str) -> str | None:
    """Liest das Ablaufdatum (exp) aus einem JWT-Token, falls möglich."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        # Base64url padding auffüllen
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        payload = json.loads(payload_json)
        if "exp" in payload:
            exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc).astimezone()
            return exp_dt.strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        pass
    return None


def read_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    try:
        content = path.read_text(encoding="utf-8")
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                data[k.strip()] = v.strip().strip("'\"")
    except Exception as exc:
        logger.warning(f"Konnte {path} nicht lesen: {exc}")
    return data


def update_env_file(path: Path, updates: dict[str, str]) -> None:
    existing_lines: list[str] = []
    keys_written = set()

    if path.is_file():
        try:
            content = path.read_text(encoding="utf-8")
            existing_lines = content.splitlines()
        except Exception:
            existing_lines = []

    new_lines: list[str] = []
    for line in existing_lines:
        match = re.match(r"^([A-Za-z0-9_]+)\s*=", line.strip())
        if match:
            key = match.group(1)
            if key in updates:
                new_lines.append(f"{key}={updates[key]}")
                keys_written.add(key)
                continue
        new_lines.append(line)

    for k, v in updates.items():
        if k not in keys_written:
            new_lines.append(f"{k}={v}")

    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    temp_path.replace(path)


class BringTokenCapture:
    def __init__(
        self,
        target_files: list[Path] | None = None,
        auto_exit: bool = True,
    ) -> None:
        self.target_files = target_files if target_files is not None else DEFAULT_TARGET_ENV_FILES
        self.auto_exit = auto_exit
        self.auth_token: str | None = None
        self.api_key: str | None = None
        self.user_uuid: str | None = None
        self.captured_live: set[str] = set()
        self._load_existing_tokens()

    def _load_existing_tokens(self) -> None:
        for p in self.target_files:
            tokens = read_env_file(p)
            if not self.auth_token and tokens.get("BRING_AUTH_TOKEN"):
                self.auth_token = tokens["BRING_AUTH_TOKEN"].replace("Bearer ", "").strip()
            if not self.api_key and tokens.get("BRING_API_KEY"):
                self.api_key = tokens["BRING_API_KEY"]
            if not self.user_uuid and tokens.get("BRING_USER_UUID"):
                self.user_uuid = tokens["BRING_USER_UUID"]

    def _is_bring_request(self, flow: http.HTTPFlow) -> bool:
        host = flow.request.pretty_host.lower()
        if "bring" in host or "bringapi" in host:
            return True
        for h in flow.request.headers.keys():
            if h.lower().startswith("x-bring-"):
                return True
        return False

    def _save_if_updated(self) -> bool:
        if not (self.auth_token or self.api_key or self.user_uuid):
            return False

        updates: dict[str, str] = {}
        if self.auth_token:
            updates["BRING_AUTH_TOKEN"] = self.auth_token
        if self.api_key:
            updates["BRING_API_KEY"] = self.api_key
        if self.user_uuid:
            updates["BRING_USER_UUID"] = self.user_uuid

        changed = False
        for p in self.target_files:
            existing = read_env_file(p)
            needs_update = False
            for k, v in updates.items():
                if existing.get(k) != v:
                    needs_update = True
                    break
            if needs_update or not p.exists():
                update_env_file(p, updates)
                changed = True

        if changed or ("auth_token" in self.captured_live):
            print("\n" + "=" * 60)
            print("[Bring-Capture] KEYS ERFASST / AKTUALISIERT!")
            print("=" * 60)
            if self.auth_token:
                masked = self.auth_token[:12] + "..." + self.auth_token[-8:] if len(self.auth_token) > 24 else self.auth_token
                status = "(LIVE ERFASST)" if "auth_token" in self.captured_live else "(aus Datei)"
                print(f"  [+] BRING_AUTH_TOKEN: {masked} {status}")
                exp = decode_jwt_exp(self.auth_token)
                if exp:
                    print(f"      Token-Ablaufdatum: {exp}")
            if self.api_key:
                status = "(LIVE ERFASST)" if "api_key" in self.captured_live else "(aus Datei)"
                print(f"  [+] BRING_API_KEY:    {self.api_key} {status}")
            if self.user_uuid:
                status = "(LIVE ERFASST)" if "user_uuid" in self.captured_live else "(aus Datei)"
                print(f"  [+] BRING_USER_UUID:  {self.user_uuid} {status}")

            print("  [>] Gespeichert in:")
            for p in self.target_files:
                print(f"     - {p}")
            print("=" * 60)

            # Prüfe, ob alle 3 Keys vorhanden sind und mindestens das Auth-Token live erfasst wurde
            all_present = bool(self.auth_token and self.api_key and self.user_uuid)
            if all_present and ("auth_token" in self.captured_live or not self.target_files):
                print("\n[Bring-Capture] [OK] Alle 3 Bring!-Tokens vollstaendig erfasst und gespeichert!")
                if self.auto_exit:
                    print("[Bring-Capture] [->] Beende mitmproxy automatisch...\n")
                    if hasattr(ctx, "master") and ctx.master:
                        ctx.master.shutdown()
            else:
                missing = []
                if not self.auth_token or "auth_token" not in self.captured_live:
                    missing.append("BRING_AUTH_TOKEN")
                if not self.api_key:
                    missing.append("BRING_API_KEY")
                if not self.user_uuid:
                    missing.append("BRING_USER_UUID")
                if missing:
                    print(f"  [i] Warten auf verbleibende Tokens: {', '.join(missing)}\n")

        return changed

    def _get_header(self, headers, name: str) -> str:
        val = headers.get(name)
        if val:
            return val
        val = headers.get(name.lower())
        if val:
            return val
        lower_name = name.lower()
        for k, v in headers.items():
            if k.lower() == lower_name:
                return v
        return ""

    def request(self, flow: http.HTTPFlow) -> None:
        if not self._is_bring_request(flow):
            return

        headers = flow.request.headers

        # Auth Token
        auth = self._get_header(headers, "authorization")
        if auth:
            token = re.sub(r"^Bearer\s+", "", auth, flags=re.IGNORECASE).strip()
            if token:
                self.auth_token = token
                self.captured_live.add("auth_token")

        # API Key
        for k in ["x-bring-api-key", "x-api-key"]:
            key = self._get_header(headers, k)
            if key and key.strip():
                self.api_key = key.strip()
                self.captured_live.add("api_key")

        # User UUID
        for k in ["x-bring-user-uuid", "x-user-uuid"]:
            uuid = self._get_header(headers, k)
            if uuid and uuid.strip():
                self.user_uuid = uuid.strip()
                self.captured_live.add("user_uuid")

        self._save_if_updated()

    def response(self, flow: http.HTTPFlow) -> None:
        if not self._is_bring_request(flow):
            return

        # Prüfe auf JSON Response (z.B. bei /login oder Token Refresh)
        content_type = flow.response.headers.get("content-type", "") if flow.response else ""
        if "application/json" in content_type and flow.response and flow.response.content:
            try:
                data = json.loads(flow.response.content.decode("utf-8", errors="ignore"))
                if isinstance(data, dict):
                    # access_token
                    token = data.get("access_token") or data.get("accessToken") or data.get("token")
                    if isinstance(token, str) and token.strip():
                        self.auth_token = token.strip()
                        self.captured_live.add("auth_token")

                    # userUuid
                    uuid = data.get("userUuid") or data.get("uuid") or data.get("user_uuid")
                    if isinstance(uuid, str) and uuid.strip():
                        self.user_uuid = uuid.strip()
                        self.captured_live.add("user_uuid")

                    # apiKey
                    api_key = data.get("apiKey") or data.get("api_key")
                    if isinstance(api_key, str) and api_key.strip():
                        self.api_key = api_key.strip()
                        self.captured_live.add("api_key")

                    self._save_if_updated()
            except Exception:
                pass


addons = [BringTokenCapture()]
