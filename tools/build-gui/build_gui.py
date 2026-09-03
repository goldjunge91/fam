#!/usr/bin/env python3
"""macOS GUI for the lock-aware native build workflow."""

from __future__ import annotations

import json
import os
import queue
import re
import shlex
import signal
import subprocess
import threading
import time
import tkinter as tk
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, ttk


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = PROJECT_ROOT / "native-build-lock.json"
LOG_DIR = PROJECT_ROOT / "tools" / "build-gui" / "logs"
METRICS_PATH = PROJECT_ROOT / ".build-metrics" / "gui-runs.jsonl"

STATUS_ACTION = "Lock prüfen"
RECOVER_ACTION = "Mismatch zurückführen (prüfen)"
DIFF_ACTION = "Lock-Diff anzeigen (bei Mismatch)"
DEV_ACTION = "Dev-Loop starten (schnell, expo run:*)"
REPAIR_ACTION = "Auto-Recovery: iOS Pods reparieren"
RUN_ACTION = "Simulator/Emulator starten"
RESTORE_ACTION = "Artefakt wiederherstellen"
REBUILD_ACTION = "Lokalen Release-Rebuild (explizit freigeben)"
SUBMIT_ACTION = "TestFlight hochladen"
DEPLOY_ACTION = "Build & Deploy (Rebuild + Upload)"
LATEST_EAS_ACTION = "Letzten EAS-Build prüfen"
RESTORE_LATEST_ACTION = "Letzten TestFlight-Build wiederherstellen"

LOG_FILTERS = ("Alle", "Fehler/Warnungen", "Build-Phasen", "Aktionen")
EXPO_XCODE_LOG_NAMES = ("xcodebuild-error.log", "xcodebuild.log")
AUTO_REPAIR_MARKERS = (
    "exsqlite3_",
    "sqlite_changeset_",
    "sqlite_change",
    "sqlitemodule.swift",
    "generate app.config for prebuilt constants.manifest",
    "explicit modules is enabled but the compiler was not recognized",
)


@dataclass(frozen=True)
class Target:
    label: str
    name: str
    description: str
    platform: str  # "ios" oder "android" — steuert Emulator/Simulator-Wortwahl und eas-submit-Plattform
    simulator: bool
    profile: str
    env_file: str | None = None
    submit: bool = False
    # Deckt sich mit DEV_TARGETS in scripts/native-build.ts — dort läuft der
    # Inner-Loop-Pfad (expo run:*, ccache, kein prebuild --clean bei jedem
    # Lauf), im Gegensatz zu RUN_ACTION, das nur ein bereits gelocktes
    # Artefakt installiert.
    dev_loop: bool = False


@dataclass
class RunRecord:
    action: str
    label: str
    target: str
    command: str
    log_path: Path
    started_at: datetime
    entries: list[tuple[str, str]] = field(default_factory=list)
    diagnostic_paths: list[Path] = field(default_factory=list)
    diagnostic_excerpt: list[str] = field(default_factory=list)
    elapsed_ms: int = 0
    exit_code: int | None = None


def classify_log_line(line: str) -> str:
    """Classify one subprocess line for the GUI's filtered log views."""

    normalized = line.lower()
    if any(
        marker in normalized
        for marker in (
            "error",
            "failed",
            "failure",
            "traceback",
            "non-zero",
            "operation timed out",
            "exit-code: 1",
        )
    ):
        return "error"
    if any(
        marker in normalized
        for marker in ("warning", "warn", "mismatch", "weicht", "stimmt nicht")
    ):
        return "warning"
    if line.lstrip().startswith("$") or line.startswith("Native Build Lock:"):
        return "action"
    if any(
        marker in line
        for marker in (
            "› ",
            "Planning build",
            "Executing ",
            "Copying ",
            "Installing ",
            "Opening ",
            "Metro:",
            "Build Succeeded",
        )
    ):
        return "phase"
    return "info"


def matches_log_filter(category: str, selected_filter: str) -> bool:
    if selected_filter == "Alle":
        return True
    if selected_filter == "Fehler/Warnungen":
        return category in {"error", "warning"}
    if selected_filter == "Build-Phasen":
        return category == "phase"
    if selected_filter == "Aktionen":
        return category == "action"
    return True


def format_duration(milliseconds: int) -> str:
    total_seconds = max(0, milliseconds) // 1000
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def is_auto_repairable_native_failure(output: str) -> bool:
    """Recognize local Pod/module-cache failures that are safe to repair once."""

    normalized = output.lower()
    return any(marker in normalized for marker in AUTO_REPAIR_MARKERS)


def _json_objects_in_output(output: str) -> list[object]:
    decoder = json.JSONDecoder()
    objects: list[object] = []
    for match in re.finditer(r"[\[{]", output):
        try:
            value, _ = decoder.raw_decode(output[match.start() :])
        except json.JSONDecodeError:
            continue
        objects.append(value)
    return objects


def parse_latest_eas_build(output: str) -> dict[str, str] | None:
    """Extract the newest build from either EAS JSON output shape."""

    for value in reversed(_json_objects_in_output(output)):
        candidates: list[object]
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, dict):
            builds = value.get("builds")
            candidates = builds if isinstance(builds, list) else [value]
        else:
            continue

        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            build_id = candidate.get("id")
            if not isinstance(build_id, str) or not build_id:
                continue
            result = {"id": build_id}
            for key in ("status", "platform", "profile", "createdAt", "appVersion", "buildVersion"):
                value = candidate.get(key)
                if isinstance(value, str) and value:
                    result[key] = value
            return result
    return None


def extract_xcode_error_lines(output: str, limit: int = 24) -> list[str]:
    """Return a short, deduplicated list of actionable xcodebuild lines."""

    error_lines: list[str] = []
    summary_lines: list[str] = []
    seen: set[str] = set()
    for raw_line in output.splitlines():
        line = raw_line.strip()
        normalized = line.lower()
        if re.search(r"(?:^|\s)error:\s", normalized):
            category = error_lines
        elif line in {"** BUILD FAILED **", "The following build commands failed:"}:
            category = summary_lines
        elif line.startswith("SwiftCompile ") or line.startswith("CompileC ") or line.startswith("Ld "):
            category = summary_lines
        else:
            continue
        if line and line not in seen:
            category.append(line)
            seen.add(line)
    return (error_lines + summary_lines)[:limit]


def read_recent_xcode_diagnostics(
    project_root: Path,
    started_at: datetime,
    max_lines_per_log: int = 24,
) -> list[tuple[Path, list[str]]]:
    """Read Expo's Xcode logs only when they were updated by this run."""

    diagnostics: list[tuple[Path, list[str]]] = []
    started_timestamp = started_at.timestamp()
    for log_name in EXPO_XCODE_LOG_NAMES:
        log_path = project_root / ".expo" / log_name
        try:
            stat = log_path.stat()
            if stat.st_mtime < started_timestamp - 1:
                continue
            lines = extract_xcode_error_lines(
                log_path.read_text(encoding="utf-8", errors="replace"),
                max_lines_per_log,
            )
        except OSError:
            continue
        if lines:
            diagnostics.append((log_path, lines))
    return diagnostics


def load_persisted_runs(project_root: Path, metrics_path: Path) -> list[RunRecord]:
    """Restore GUI history from JSONL without trusting paths outside the project."""

    if not metrics_path.exists():
        return []

    runs: list[RunRecord] = []
    project_root = project_root.resolve()
    try:
        metric_lines = metrics_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []

    for metric_line in metric_lines:
        try:
            row = json.loads(metric_line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        log_value = row.get("logPath")
        timestamp = row.get("ts")
        if not isinstance(log_value, str) or not isinstance(timestamp, str):
            continue
        try:
            started_at = datetime.fromisoformat(timestamp)
            log_path = (project_root / log_value).resolve()
            log_path.relative_to(project_root)
        except (ValueError, OSError):
            continue

        entries: list[tuple[str, str]] = []
        try:
            log_lines = log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            log_lines = ""
        entries = [
            (line, classify_log_line(line))
            for line in log_lines.splitlines(keepends=True)
        ]
        target = row.get("target")
        action = row.get("action")
        run = RunRecord(
            action=action if isinstance(action, str) else "Unbekannte Aktion",
            label=row.get("label") if isinstance(row.get("label"), str) else action or "Lauf",
            target=target if isinstance(target, str) else "unbekannt",
            command=row.get("command") if isinstance(row.get("command"), str) else "",
            log_path=log_path,
            started_at=started_at,
            entries=entries,
            elapsed_ms=int(row.get("totalMs", 0)) if isinstance(row.get("totalMs"), (int, float)) else 0,
            exit_code=row.get("exitCode") if isinstance(row.get("exitCode"), int) else None,
        )
        runs.append(run)
    runs.reverse()
    return runs


TARGETS = {
    "iOS Development": Target(
        label="iOS Development-Simulator",
        name="ios-development-simulator",
        description="Startet den schnellen inkrementellen Development-Loop im iOS-Simulator.",
        platform="ios",
        simulator=True,
        profile="development",
        env_file=".env.development.local",
        dev_loop=True,
    ),
    "iOS Preview-Simulator": Target(
        label="iOS Preview-Simulator",
        name="ios-preview-simulator",
        description="Startet ausschließlich das gelockte Preview-APP im iOS-Simulator.",
        platform="ios",
        simulator=True,
        profile="preview-simulator",
        env_file=".env.preview",
    ),
    "iOS TestFlight": Target(
        label="iOS Preview-TestFlight",
        name="ios-preview-testflight",
        description="Verwendet das gelockte IPA. Build und Upload sind getrennte Aktionen.",
        platform="ios",
        simulator=False,
        profile="preview-testflight",
        submit=True,
    ),
    "iOS Production": Target(
        label="iOS Production",
        name="ios-production",
        description="Verwendet ausschließlich ein explizit gelocktes Production-IPA.",
        platform="ios",
        simulator=False,
        profile="production",
        submit=False,
    ),
    "Android Development": Target(
        label="Android Development-Emulator",
        name="android-development",
        description="Startet den schnellen inkrementellen Development-Loop im Android-Emulator.",
        platform="android",
        simulator=True,
        profile="development",
        env_file=".env.development.local",
        dev_loop=True,
    ),
    "Android Preview": Target(
        label="Android Preview-Emulator",
        name="android-preview",
        description="Startet ausschließlich die gelockte Preview-APK im Android-Emulator.",
        platform="android",
        simulator=True,
        profile="preview",
        env_file=".env.preview",
    ),
    "Android Production": Target(
        label="Android Production",
        name="android-production",
        description="Verwendet ausschließlich ein explizit gelocktes Production-AAB.",
        platform="android",
        simulator=False,
        profile="production",
        submit=False,
    ),
}


class BuildGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("fam Native Build Lock")
        self.geometry("900x640")
        self.minsize(720, 500)

        self.target = tk.StringVar(value="iOS Development")
        self.action = tk.StringVar(value=DEV_ACTION)
        self.approve_rebuild = tk.BooleanVar(value=False)
        self.eas_build_id = tk.StringVar()
        # Leer = Expo wählt selbst (meist das zuletzt gestartete Gerät).
        # Name muss exakt zu 'xcrun simctl list devices' bzw. 'adb devices' passen.
        self.device = tk.StringVar()
        self.status = tk.StringVar(value="Lock wird geprüft …")
        self.target_state = tk.StringVar()
        self.health_state = tk.StringVar(value="Fingerprint: noch nicht geprüft")
        self.elapsed = tk.StringVar(value="Laufzeit: 00:00")
        self.last_run = tk.StringVar(value="Kein Lauf ausgewählt")
        self.diagnostic_state = tk.StringVar(value="Xcode-Diagnose: noch nicht vorhanden")
        self.log_filter = tk.StringVar(value="Alle")
        self.selected_run = tk.StringVar(value="Aktueller Lauf")
        self.output: queue.Queue[tuple[str, object]] = queue.Queue()
        self.process: subprocess.Popen[str] | None = None
        self.worker: threading.Thread | None = None
        self.running = False
        self.run_started_monotonic: float | None = None
        self.current_run: RunRecord | None = None
        self.run_history: list[RunRecord] = []
        self.history_labels: dict[str, RunRecord] = {}
        self.latest_build: dict[str, str] | None = None
        self.latest_build_checked = False
        self.pending_latest_restore = False
        self.pending_auto_retry_device: str | None = None
        self.stop_requested = False
        self.target_menu: ttk.Combobox

        self.run_history = load_persisted_runs(PROJECT_ROOT, METRICS_PATH)
        self._build_ui()
        self._refresh_history()
        self._refresh_target_info()
        self._refresh_devices()
        self.after(150, self.refresh_status)
        self.after(100, self._drain_output)
        self.after(250, self._refresh_elapsed)
        self.protocol("WM_DELETE_WINDOW", self._close)

    def _build_ui(self) -> None:
        container = ttk.Frame(self, padding=18)
        container.pack(fill="both", expand=True)
        container.columnconfigure(1, weight=1)

        ttk.Label(container, text="Ziel").grid(
            row=0, column=0, sticky="w", padx=(0, 12), pady=6
        )
        self.target_menu = ttk.Combobox(
            container,
            textvariable=self.target,
            values=tuple(TARGETS),
            state="readonly",
        )
        self.target_menu.grid(row=0, column=1, sticky="ew", pady=6)
        self.target_menu.bind("<<ComboboxSelected>>", self._target_changed)

        ttk.Label(container, text="Aktion").grid(
            row=1, column=0, sticky="w", padx=(0, 12), pady=6
        )
        self.action_menu = ttk.Combobox(
            container,
            textvariable=self.action,
            state="readonly",
        )
        self.action_menu.grid(row=1, column=1, sticky="ew", pady=6)
        self.action_menu.bind("<<ComboboxSelected>>", self._action_changed)

        ttk.Label(container, text="EAS Build-ID").grid(
            row=2, column=0, sticky="w", padx=(0, 12), pady=6
        )
        ttk.Entry(container, textvariable=self.eas_build_id).grid(
            row=2, column=1, sticky="ew", pady=6
        )

        ttk.Label(container, text="Gerät (optional)").grid(
            row=3, column=0, sticky="w", padx=(0, 12), pady=6
        )
        device_frame = ttk.Frame(container)
        device_frame.grid(row=3, column=1, sticky="ew", pady=6)
        device_frame.columnconfigure(0, weight=1)
        self.device_menu = ttk.Combobox(device_frame, textvariable=self.device)
        self.device_menu.grid(row=0, column=0, sticky="ew")
        ttk.Button(device_frame, text="⟳", width=3, command=self._refresh_devices).grid(
            row=0, column=1, padx=(6, 0)
        )
        ttk.Label(
            container,
            text="Leer = Expo wählt selbst. Exakter Name/UDID aus 'xcrun simctl list devices' bzw. 'adb devices'.",
            foreground="#888888",
        ).grid(row=4, column=0, columnspan=2, sticky="w", pady=(0, 6))

        self.description = ttk.Label(container, anchor="w", justify="left")
        self.description.grid(row=5, column=0, columnspan=2, sticky="ew", pady=(4, 2))
        ttk.Label(container, textvariable=self.target_state).grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(0, 10)
        )
        ttk.Label(container, textvariable=self.health_state).grid(
            row=7, column=0, columnspan=2, sticky="w", pady=(0, 4)
        )
        ttk.Label(container, textvariable=self.diagnostic_state).grid(
            row=8, column=0, columnspan=2, sticky="w", pady=(0, 8)
        )

        self.rebuild_check = ttk.Checkbutton(
            container,
            text="Ich erlaube für diese Aktion ausdrücklich Prebuild, CocoaPods und Kompilierung.",
            variable=self.approve_rebuild,
        )
        self.rebuild_check.grid(row=9, column=0, columnspan=2, sticky="w", pady=(0, 10))

        log_toolbar = ttk.Frame(container)
        log_toolbar.grid(row=10, column=0, columnspan=2, sticky="ew", pady=(0, 6))
        log_toolbar.columnconfigure(5, weight=1)
        ttk.Label(log_toolbar, text="Logansicht").grid(row=0, column=0, sticky="w")
        self.log_filter_menu = ttk.Combobox(
            log_toolbar,
            textvariable=self.log_filter,
            values=LOG_FILTERS,
            state="readonly",
            width=18,
        )
        self.log_filter_menu.grid(row=0, column=1, padx=(6, 14))
        self.log_filter_menu.bind("<<ComboboxSelected>>", self._log_filter_changed)
        ttk.Label(log_toolbar, text="Lauf").grid(row=0, column=2, sticky="w")
        self.history_menu = ttk.Combobox(
            log_toolbar,
            textvariable=self.selected_run,
            values=("Aktueller Lauf",),
            state="readonly",
            width=34,
        )
        self.history_menu.grid(row=0, column=3, padx=(6, 14))
        self.history_menu.bind("<<ComboboxSelected>>", self._history_changed)
        ttk.Label(log_toolbar, textvariable=self.elapsed).grid(row=0, column=4, sticky="w")
        ttk.Label(log_toolbar, textvariable=self.last_run).grid(row=0, column=5, sticky="e")
        self.open_log_button = ttk.Button(
            log_toolbar, text="Log öffnen", command=self._open_selected_log
        )
        self.open_log_button.grid(row=0, column=6, padx=(10, 0))

        log_frame = ttk.Frame(container)
        log_frame.grid(row=11, column=0, columnspan=2, sticky="nsew")
        container.rowconfigure(11, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        self.log = tk.Text(
            log_frame,
            state="disabled",
            wrap="none",
            bg="#171717",
            fg="#eeeeee",
            insertbackground="#eeeeee",
        )
        self.log.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.log.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.log.configure(yscrollcommand=scrollbar.set)

        footer = ttk.Frame(container)
        footer.grid(row=12, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        footer.columnconfigure(0, weight=1)
        ttk.Label(footer, textvariable=self.status).grid(row=0, column=0, sticky="w")
        self.refresh_button = ttk.Button(footer, text="Status prüfen", command=self.refresh_status)
        self.refresh_button.grid(row=0, column=1, padx=(8, 0))
        self.start_button = ttk.Button(footer, text="Ausführen", command=self.start_action)
        self.start_button.grid(row=0, column=2, padx=(8, 0))
        self.stop_button = ttk.Button(footer, text="Abbrechen", command=self.stop_build, state="disabled")
        self.stop_button.grid(row=0, column=3, padx=(8, 0))

    def _target_changed(self, _event: tk.Event[tk.Misc]) -> None:
        self.health_state.set("Fingerprint: noch nicht geprüft")
        self.diagnostic_state.set("Xcode-Diagnose: noch nicht vorhanden")
        self.latest_build = None
        self.latest_build_checked = False
        self._refresh_target_info()
        self._refresh_devices()

    def _refresh_devices(self) -> None:
        platform = self._selected_target().platform
        try:
            names = self._list_ios_devices() if platform == "ios" else self._list_android_devices()
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
            names = []
        self.device_menu.configure(values=tuple(names))

    @staticmethod
    def _list_ios_devices() -> list[str]:
        # '-j' liefert stabiles JSON statt der menschenlesbaren simctl-Textausgabe.
        result = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "available", "-j"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        data = json.loads(result.stdout)
        names = []
        for runtime_devices in data.get("devices", {}).values():
            for device in runtime_devices:
                if device.get("isAvailable", True):
                    names.append(device["name"])
        return sorted(set(names))

    @staticmethod
    def _list_android_devices() -> list[str]:
        result = subprocess.run(
            ["emulator", "-list-avds"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        return sorted(line.strip() for line in result.stdout.splitlines() if line.strip())

    def _action_changed(self, _event: tk.Event[tk.Misc]) -> None:
        self._update_controls()

    def _selected_target(self) -> Target:
        return TARGETS[self.target.get()]

    def _read_target_lock(self) -> dict[str, object] | None:
        try:
            lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        artifacts = lock.get("artifacts", {})
        if not isinstance(artifacts, dict):
            return None
        target_lock = artifacts.get(self._selected_target().name)
        return target_lock if isinstance(target_lock, dict) else None

    def _refresh_target_info(self) -> None:
        target = self._selected_target()
        self.description.configure(text=f"{target.label}: {target.description}")

        actions = [STATUS_ACTION, RECOVER_ACTION, DIFF_ACTION, REBUILD_ACTION]
        if target.dev_loop:
            actions.insert(2, DEV_ACTION)
        if target.simulator:
            actions.insert(2, RUN_ACTION)
        if target.submit:
            actions.insert(actions.index(REBUILD_ACTION), LATEST_EAS_ACTION)
            actions.insert(actions.index(REBUILD_ACTION), RESTORE_LATEST_ACTION)
            actions.append(SUBMIT_ACTION)
            actions.append(DEPLOY_ACTION)
        actions.insert(actions.index(REBUILD_ACTION), RESTORE_ACTION)

        self.action_menu.configure(values=tuple(actions))
        if self.action.get() not in actions:
            self.action.set(DEV_ACTION if target.dev_loop else STATUS_ACTION)
        self._refresh_target_state()
        self._update_controls()

    def _refresh_target_state(self) -> None:
        target = self._selected_target()
        target_lock = self._read_target_lock()
        if target_lock is None:
            state = "nicht im Native-Lock registriert"
        else:
            relative_path = target_lock.get("relativePath")
            artifact_path = (
                PROJECT_ROOT / relative_path if isinstance(relative_path, str) else None
            )
            if artifact_path is not None and artifact_path.exists():
                state = "lokal vorhanden, SHA-256 wird beim Status geprüft"
            else:
                state = "lokal nicht vorhanden"
            build_id = target_lock.get("easBuildId")
            if isinstance(build_id, str) and build_id:
                state += f", EAS Build-ID {build_id}"
            else:
                state += ", keine EAS Build-ID hinterlegt"

        if target.name == "ios-preview-testflight" and self.latest_build_checked:
            if self.latest_build is None:
                state += " · kein passender fertiger EAS-Build gefunden"
            else:
                latest_id = self.latest_build["id"]
                latest_status = self.latest_build.get("status", "Status unbekannt")
                state += f" · passender letzter EAS-Build: {latest_id} ({latest_status})"
        self.target_state.set(f"Artefakt: {state}")

    def _update_controls(self) -> None:
        is_rebuild = self.action.get() in (REBUILD_ACTION, DEPLOY_ACTION)
        self.rebuild_check.configure(state="normal" if is_rebuild else "disabled")
        if not is_rebuild:
            self.approve_rebuild.set(False)

    def _base_environment(self) -> dict[str, str]:
        env = os.environ.copy()
        env["EXPO_NO_DOTENV"] = "1"
        # GUI processes launched from Finder may not inherit the shell PATH.
        path_entries = ["/opt/homebrew/bin", "/usr/local/bin", env.get("PATH", "")]
        env["PATH"] = os.pathsep.join(entry for entry in path_entries if entry)
        return env

    def _with_env_file(self, command: list[str], env_file: str | None) -> list[str]:
        if env_file is None:
            return command
        return ["dotenv", "-o", "-e", env_file, "--", *command]

    def _dev_command(
        self, target: Target, device: str
    ) -> tuple[list[str], dict[str, str], str]:
        if not target.dev_loop:
            raise ValueError(
                "Der Dev-Loop-Pfad ist nur für Development-Targets gedacht "
                "(siehe DEV_TARGETS in scripts/native-build.ts)."
            )
        env = self._base_environment()
        command = ["bun", "run", "native:dev", "--", "--target", target.name]
        if device.strip():
            command.extend(["--device", device.strip()])
        if target.platform == "ios" and target.simulator:
            # The iOS simulator can reach the Mac through loopback. This
            # avoids choosing a stale LAN address when Wi-Fi/VPN changes.
            env["REACT_NATIVE_PACKAGER_HOSTNAME"] = "127.0.0.1"
        return (
            self._with_env_file(command, target.env_file),
            env,
            f"{target.label}: Inner Loop (expo run:*, ccache)",
        )

    def _pod_repair_command(self) -> tuple[list[str], dict[str, str], str]:
        env = self._base_environment()
        env["USE_CCACHE"] = "1"
        return (
            ["pod", "install", "--project-directory=ios"],
            env,
            "iOS Pods reparieren und Native-Modul-Linkage neu erzeugen",
        )

    def _command(self) -> tuple[list[str], dict[str, str], str]:
        target = self._selected_target()
        action = self.action.get()
        env = self._base_environment()
        native_command = ["bun", "run"]

        if action == STATUS_ACTION:
            return [*native_command, "native:status"], env, "Native-Lock prüfen"

        if action == RECOVER_ACTION:
            return (
                [*native_command, "native:status", "--", "--diff"],
                env,
                "Mismatch prüfen und nächsten Schritt vorbereiten",
            )

        if action == DIFF_ACTION:
            return (
                [*native_command, "native:status", "--", "--diff"],
                env,
                "Native-Lock-Diff (abweichende Fingerprint-Quelle anzeigen)",
            )

        if action == DEV_ACTION:
            return self._dev_command(target, self.device.get())

        if action == RUN_ACTION:
            if not target.simulator:
                raise ValueError("Nur Simulator-/Emulator-Targets können direkt gestartet werden.")
            command = [
                *native_command,
                "native:run",
                "--",
                "--target",
                target.name,
            ]
            device = self.device.get().strip()
            if device:
                command.extend(["--device", device])
            return self._with_env_file(command, target.env_file), env, f"{target.label} starten"

        if action == REBUILD_ACTION:
            if not self.approve_rebuild.get():
                raise ValueError(
                    "Der Rebuild bleibt gesperrt. Aktiviere zuerst die ausdrückliche Freigabe."
                )
            return [
                *native_command,
                "native:rebuild",
                "--",
                "--target",
                target.name,
                "--approve-rebuild",
            ], env, f"{target.label} kontrolliert rebuilden"

        if action == RESTORE_ACTION:
            command = [
                *native_command,
                "native:restore",
                "--",
                "--target",
                target.name,
            ]
            build_id = self.eas_build_id.get().strip()
            if build_id:
                command.extend(["--eas-build-id", build_id])
            return command, env, f"{target.label} wiederherstellen"

        if action == LATEST_EAS_ACTION:
            return (
                self._latest_eas_command(target, self._read_native_fingerprint(target.platform)),
                env,
                "Letzten passenden EAS-Build ermitteln",
            )

        if action == RESTORE_LATEST_ACTION:
            build_id = self.eas_build_id.get().strip()
            if build_id:
                return self._restore_command(target, build_id, env)
            raise ValueError("Zuerst den letzten EAS-Build ermitteln oder eine Build-ID eingeben.")

        if action == SUBMIT_ACTION:
            target_lock = self._read_target_lock()
            relative_path = target_lock.get("relativePath") if target_lock else None
            if not isinstance(relative_path, str):
                raise ValueError("Für dieses Target ist kein Artefakt im Native-Lock registriert.")
            artifact_path = PROJECT_ROOT / relative_path
            if not artifact_path.exists():
                raise ValueError("Das gelockte IPA fehlt lokal. Stelle es zuerst wieder her.")
            return [
                "eas",
                "submit",
                "--platform",
                target.platform,
                "--profile",
                target.profile,
                "--path",
                str(artifact_path),
                "--wait",
                "--non-interactive",
            ], env, "Vorhandenes IPA an TestFlight senden"

        if action == DEPLOY_ACTION:
            if not self.approve_rebuild.get():
                raise ValueError(
                    "Build & Deploy bleibt gesperrt. Aktiviere zuerst die ausdrückliche Freigabe."
                )
            if not target.submit:
                raise ValueError("Build & Deploy ist nur für Submit-fähige Targets gedacht.")
            artifact_path = PROJECT_ROOT / "native-artifacts" / target.name / "fam.ipa"
            rebuild_command = [
                *native_command,
                "native:rebuild",
                "--",
                "--target",
                target.name,
                "--approve-rebuild",
            ]
            submit_command = [
                "eas",
                "submit",
                "--platform",
                target.platform,
                "--profile",
                target.profile,
                "--path",
                str(artifact_path),
                "--wait",
                "--non-interactive",
            ]
            combined = f"{shlex.join(rebuild_command)} && {shlex.join(submit_command)}"
            return ["bash", "-lc", combined], env, f"{target.label}: Build & Deploy"

        raise ValueError(f"Unbekannte Aktion: {action}")

    @staticmethod
    def _latest_eas_command(target: Target, fingerprint: str | None = None) -> list[str]:
        command = [
            "eas",
            "build:list",
            "--platform",
            target.platform,
            "--build-profile",
            target.profile,
            "--status",
            "finished",
            "--limit",
            "1",
            "--json",
            "--non-interactive",
        ]
        if fingerprint:
            command.extend(["--fingerprint-hash", fingerprint])
        return command

    def _read_native_fingerprint(self, platform: str) -> str | None:
        try:
            lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        fingerprints = lock.get("nativeFingerprints", {})
        platform_lock = fingerprints.get(platform) if isinstance(fingerprints, dict) else None
        fingerprint = platform_lock.get("hash") if isinstance(platform_lock, dict) else None
        return fingerprint if isinstance(fingerprint, str) and fingerprint else None

    def _restore_command(
        self, target: Target, build_id: str, env: dict[str, str]
    ) -> tuple[list[str], dict[str, str], str]:
        command = [
            "bun",
            "run",
            "native:restore",
            "--",
            "--target",
            target.name,
            "--eas-build-id",
            build_id,
        ]
        return command, env, f"{target.label} wiederherstellen"

    def start_action(self) -> None:
        if self.running:
            return
        try:
            if self.action.get() == RESTORE_LATEST_ACTION and not self.eas_build_id.get().strip():
                self.pending_latest_restore = True
                target = self._selected_target()
                command = self._latest_eas_command(
                    target, self._read_native_fingerprint(target.platform)
                )
                self._start_process(
                    command,
                    self._base_environment(),
                    "Letzten EAS-Build ermitteln",
                    LATEST_EAS_ACTION,
                )
                return
            command, env, label = self._command()
        except ValueError as error:
            messagebox.showwarning("Native Build Lock", str(error))
            return
        self._start_process(command, env, label)

    def refresh_status(self) -> None:
        if self.running:
            return
        self._start_process(
            ["bun", "run", "native:status"],
            self._base_environment(),
            "Native-Lock prüfen",
            STATUS_ACTION,
        )

    def _start_process(
        self,
        command: list[str],
        env: dict[str, str],
        label: str,
        action: str | None = None,
    ) -> None:
        started_at = datetime.now()
        log_path = LOG_DIR / f"native-{started_at.strftime('%Y-%m-%d_%H-%M-%S-%f')}.log"
        self.current_run = RunRecord(
            action=action or self.action.get(),
            label=label,
            target=self._selected_target().name,
            command=shlex.join(command),
            log_path=log_path,
            started_at=started_at,
        )
        self.selected_run.set("Aktueller Lauf")
        self.run_started_monotonic = time.monotonic()
        self.running = True
        self.diagnostic_state.set("Xcode-Diagnose: wartet auf Build-Ergebnis")
        self._append_log(f"$ {shlex.join(command)}\n\n", "action")
        self.status.set(f"Läuft: {label}")
        self.last_run.set("Aktueller Lauf")
        self.elapsed.set("Laufzeit: 00:00")
        self.start_button.configure(state="disabled")
        self.refresh_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.target_menu.configure(state="disabled")
        self.action_menu.configure(state="disabled")
        self._append_log(f"Logdatei: {log_path}\n\n", "action")
        self.worker = threading.Thread(
            target=self._run_process,
            args=(command, env, log_path),
            daemon=True,
        )
        self.worker.start()

    def _run_process(
        self,
        command: list[str],
        env: dict[str, str],
        log_path: Path,
    ) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        try:
            with log_path.open("w", encoding="utf-8") as log_file:
                log_file.write(f"Started: {datetime.now().isoformat(timespec='seconds')}\n")
                log_file.write(f"Command: {shlex.join(command)}\n\n")
                log_file.flush()
                self.process = subprocess.Popen(
                    command,
                    cwd=PROJECT_ROOT,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    start_new_session=True,
                )
                assert self.process.stdout is not None
                for line in self.process.stdout:
                    log_file.write(line)
                    log_file.flush()
                    self.output.put(("log", line))
                return_code = self.process.wait()
                log_file.write(f"\nFinished: {datetime.now().isoformat(timespec='seconds')}\n")
                log_file.write(f"Exit-Code: {return_code}\n")
                self.output.put(("done", return_code))
        except Exception as error:  # noqa: BLE001 - surface subprocess errors in the GUI
            with log_path.open("a", encoding="utf-8") as log_file:
                log_file.write(f"\nFEHLER: {error}\n")
            self.output.put(("error", str(error)))

    def stop_build(self) -> None:
        if self.process is None:
            return
        self.stop_requested = True
        try:
            os.killpg(self.process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        self.status.set("Abbruch angefordert …")

    def _drain_output(self) -> None:
        try:
            while True:
                kind, value = self.output.get_nowait()
                if kind == "log":
                    line = str(value)
                    self._append_log(line)
                    self._update_health_from_line(line)
                elif kind == "done":
                    self.process = None
                    self.running = False
                    self.start_button.configure(state="normal")
                    self.refresh_button.configure(state="normal")
                    self.stop_button.configure(state="disabled")
                    self._finish_run(int(value))
                else:
                    self.process = None
                    self.running = False
                    self.start_button.configure(state="normal")
                    self.refresh_button.configure(state="normal")
                    self.stop_button.configure(state="disabled")
                    self.status.set("Fehler")
                    self._append_log(f"\nFEHLER: {value}\n", "error")
                    self._finish_run(1)
        except queue.Empty:
            pass
        self.after(100, self._drain_output)

    def _append_log(self, text: str, category: str | None = None) -> None:
        if self.current_run is not None:
            self.current_run.entries.append((text, category or classify_log_line(text)))
        self._render_log()

    def _render_log(self) -> None:
        run = self._selected_run()

        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        if run is not None:
            for text, category in run.entries:
                if matches_log_filter(category, self.log_filter.get()):
                    self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _log_filter_changed(self, _event: tk.Event[tk.Misc]) -> None:
        self._render_log()

    def _history_changed(self, _event: tk.Event[tk.Misc]) -> None:
        self._render_log()

    def _selected_run(self) -> RunRecord | None:
        if self.selected_run.get() == "Aktueller Lauf":
            return self.current_run
        return self.history_labels.get(self.selected_run.get())

    def _open_selected_log(self) -> None:
        run = self._selected_run()
        if run is None or not run.log_path.exists():
            self.status.set("Für diesen Lauf ist noch keine Logdatei vorhanden.")
            return
        try:
            subprocess.Popen(["open", str(run.log_path)])
        except OSError as error:
            self.status.set(f"Log konnte nicht geöffnet werden: {error}")

    def _refresh_history(self) -> None:
        self.history_labels = {}
        values = ["Aktueller Lauf"]
        for run in self.run_history:
            result = "läuft" if run.exit_code is None else f"Exit {run.exit_code}"
            label = (
                f"{run.started_at.strftime('%H:%M:%S')} · {run.label} · "
                f"{format_duration(run.elapsed_ms)} · {result}"
            )
            self.history_labels[label] = run
            values.append(label)
        self.history_menu.configure(values=tuple(values))

    def _refresh_elapsed(self) -> None:
        if self.running and self.run_started_monotonic is not None:
            elapsed_ms = round((time.monotonic() - self.run_started_monotonic) * 1000)
            self.elapsed.set(f"Laufzeit: {format_duration(elapsed_ms)}")
        self.after(250, self._refresh_elapsed)

    def _update_health_from_line(self, line: str) -> None:
        normalized = line.lower()
        if "native baseline ist unverändert" in normalized:
            self.health_state.set("Fingerprint: Baseline unverändert")
        elif "fingerprint" in normalized and any(
            marker in normalized for marker in ("mismatch", "weicht", "stimmt nicht")
        ):
            self.health_state.set("Fingerprint-Mismatch: Diff anzeigen oder Rebuild freigeben")
        elif "kein artefakt" in normalized or "artefakt fehlt" in normalized:
            self.health_state.set("Artefakt fehlt: Restore oder Rebuild erforderlich")

    def _finish_run(self, return_code: int) -> None:
        run = self.current_run
        if run is None:
            return

        was_cancelled = self.stop_requested
        self.stop_requested = False
        run.exit_code = return_code
        if self.run_started_monotonic is not None:
            run.elapsed_ms = round((time.monotonic() - self.run_started_monotonic) * 1000)
        if return_code != 0 and run.target.startswith("ios"):
            self._append_xcode_diagnostics(run)
        self.elapsed.set(f"Laufzeit: {format_duration(run.elapsed_ms)}")
        self._append_log(
            f"\nGUI-Lauf beendet: {format_duration(run.elapsed_ms)} · Exit-Code {return_code}\n",
            "error" if return_code else "action",
        )
        self.run_history.insert(0, run)
        self._refresh_history()
        self.last_run.set(
            f"Letzter Lauf: {format_duration(run.elapsed_ms)} · Exit-Code {return_code}"
        )
        self._write_metrics(run)

        if (
            return_code != 0
            and run.action == DEV_ACTION
            and run.target.startswith("ios-")
            and not was_cancelled
            and is_auto_repairable_native_failure(
                "".join(text for text, _ in run.entries)
            )
        ):
            self.pending_auto_retry_device = self.device.get().strip()
            self._append_log(
                "\nAuto-Recovery: bekannte iOS-Pod-/Module-Fehler erkannt. "
                "Repariere Pods automatisch und starte den Dev-Loop danach einmal neu.\n",
                "action",
            )
            self.status.set("Auto-Recovery: iOS Pods werden repariert …")
            command, env, label = self._pod_repair_command()
            self._start_process(command, env, label, REPAIR_ACTION)
            return

        if run.action == REPAIR_ACTION:
            device = self.pending_auto_retry_device
            self.pending_auto_retry_device = None
            if return_code == 0 and device is not None and not was_cancelled:
                target = self._selected_target()
                self.action.set(DEV_ACTION)
                command, env, label = self._dev_command(target, device)
                self.status.set("Auto-Recovery erfolgreich · Dev-Loop startet erneut …")
                self._start_process(command, env, label, DEV_ACTION)
                return

        if run.action == LATEST_EAS_ACTION and return_code == 0:
            latest_build = parse_latest_eas_build("".join(text for text, _ in run.entries))
            self.latest_build_checked = True
            if latest_build is None:
                self.latest_build = None
                self.status.set("Kein EAS-Build im Ergebnis gefunden")
                self.pending_latest_restore = False
            else:
                self.latest_build = latest_build
                self.eas_build_id.set(latest_build["id"])
                self._append_log(
                    f"\nLetzter EAS-Build: {latest_build['id']}"
                    f" ({latest_build.get('status', 'Status unbekannt')})\n",
                    "action",
                )
                if self.pending_latest_restore:
                    self.pending_latest_restore = False
                    self._refresh_target_info()
                    command, env, label = self._restore_command(
                        self._selected_target(), latest_build["id"], self._base_environment()
                    )
                    self._start_process(command, env, label, RESTORE_LATEST_ACTION)
                    return
        elif run.action == LATEST_EAS_ACTION:
            self.latest_build_checked = True
            self.latest_build = None
            self.pending_latest_restore = False

        if return_code == 0:
            self.status.set(f"Erfolgreich abgeschlossen · {format_duration(run.elapsed_ms)}")
        else:
            self.status.set(f"Fehlgeschlagen · Exit-Code {return_code}")
        if run.action == RECOVER_ACTION and return_code != 0:
            self.action.set(REBUILD_ACTION)
            self.approve_rebuild.set(False)
            self.status.set("Mismatch analysiert · Rebuild erst ausdrücklich freigeben")
        self._refresh_target_info()
        self.target_menu.configure(state="readonly")
        self.action_menu.configure(state="readonly")

    def _append_xcode_diagnostics(self, run: RunRecord) -> None:
        diagnostics = read_recent_xcode_diagnostics(PROJECT_ROOT, run.started_at)
        if not diagnostics:
            self.diagnostic_state.set(
                "Xcode-Diagnose: kein frischer Expo-Rohlog gefunden"
            )
            return

        first_error: str | None = None
        block = ["\nXcode-Rohdiagnose (Expo):\n"]
        for log_path, lines in diagnostics:
            run.diagnostic_paths.append(log_path)
            relative_path = log_path.relative_to(PROJECT_ROOT)
            block.append(f"  Log: {relative_path}\n")
            for line in lines:
                if line not in run.diagnostic_excerpt:
                    run.diagnostic_excerpt.append(line)
                if first_error is None and "error:" in line.lower():
                    first_error = line
                block.append(f"  {line}\n")

        with run.log_path.open("a", encoding="utf-8") as log_file:
            log_file.write("".join(block))
        self._append_log("".join(block), "error")
        if first_error is not None:
            summary = first_error.replace("\n", " ")
            if len(summary) > 180:
                summary = f"{summary[:177]}..."
            self.diagnostic_state.set(f"Xcode-Diagnose: {summary}")
        else:
            self.diagnostic_state.set(
                f"Xcode-Diagnose: {len(run.diagnostic_excerpt)} relevante Zeilen"
            )

    def _write_metrics(self, run: RunRecord) -> None:
        METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
        platform = "ios" if run.target.startswith("ios") else "android"
        fingerprint: str | None = None
        try:
            lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            fingerprints = lock.get("nativeFingerprints", {})
            platform_lock = fingerprints.get(platform, {}) if isinstance(fingerprints, dict) else {}
            value = platform_lock.get("hash") if isinstance(platform_lock, dict) else None
            fingerprint = value if isinstance(value, str) else None
        except (OSError, json.JSONDecodeError):
            pass

        row = {
            "ts": run.started_at.isoformat(timespec="seconds"),
            "target": run.target,
            "action": run.action,
            "label": run.label,
            "command": run.command,
            "fingerprint": fingerprint,
            "totalMs": run.elapsed_ms,
            "exitCode": run.exit_code,
            "logPath": str(run.log_path.relative_to(PROJECT_ROOT)),
            "xcodeLogPaths": [
                str(path.relative_to(PROJECT_ROOT)) for path in run.diagnostic_paths
            ],
            "xcodeErrors": run.diagnostic_excerpt,
        }
        with METRICS_PATH.open("a", encoding="utf-8") as metrics_file:
            metrics_file.write(f"{json.dumps(row, ensure_ascii=False)}\n")

    def _close(self) -> None:
        if self.running:
            if not messagebox.askyesno("Aktion läuft", "Aktion wirklich abbrechen und GUI schließen?"):
                return
            self.stop_build()
        self.destroy()


if __name__ == "__main__":
    BuildGui().mainloop()
