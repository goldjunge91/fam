#!/usr/bin/env python3
"""Small Tk UI for local Expo builds and EAS build, submit, and update flows."""

from __future__ import annotations

import json
import os
import queue
import signal
import subprocess
import threading
import tkinter as tk
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from tkinter import ttk

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCAL_IOS = PROJECT_ROOT / "build" / "local" / "ios"
IOS_CACHE = PROJECT_ROOT / "build" / "cache" / "ios"
EXPORT_OPTIONS = PROJECT_ROOT / "tools" / "build-gui" / "ExportOptions.plist"
LATEST_BUILD = LOCAL_IOS / "latest-testflight-build.json"


@dataclass(frozen=True)
class Target:
    platform: str
    profile: str
    environment: str
    channel: str
    env_file: str | None = None
    simulator: bool = False


TARGETS = {
    "iOS Development Simulator": Target(
        "ios", "development", "development", "development",
        env_file=".env.development.local", simulator=True,
    ),
    "iOS TestFlight": Target(
        "ios", "preview-testflight", "preview", "preview-testflight",
    ),
    "iOS Production": Target(
        "ios", "production", "production", "production",
    ),
    "Android Development Emulator": Target(
        "android", "development", "development", "development",
        env_file=".env.development.local", simulator=True,
    ),
    "Android Preview Emulator": Target(
        "android", "preview", "preview", "preview", env_file=".env.preview", simulator=True,
    ),
    "Android Production": Target("android", "production", "production", "production"),
}


def _expo(*args: str, env_file: str | None = None) -> list[str]:
    command = ["bun"]
    if env_file:
        command.append(f"--env-file={env_file}")
    return [*command, "run", "expo", *args]


def _prebuild(target: Target) -> list[str]:
    return _expo(
        "prebuild", "--no-clean", "--platform", target.platform,
        env_file=target.env_file,
    )


def commands_for(
    target_name: str,
    action: str,
    device: str = "",
    message: str = "",
    local_build_dir: Path | None = None,
) -> list[list[str]]:
    target = TARGETS[target_name]
    if action == "Lokal bauen: Simulator" and target.platform == "ios" and target.simulator:
        run = _expo("run:ios", "--scheme", "fam", env_file=target.env_file)
        if device.strip():
            run.extend(["--device", device.strip()])
        return [
            [
                "env", "FAM_HARNESS_UI=1", "FAM_IOS_MLKIT_OCR=0",
                "FAM_UPDATE_CHANNEL=development",
                "USE_CCACHE=1", *_prebuild(target),
            ],
            [
                "env", "FAM_HARNESS_UI=1", "FAM_IOS_MLKIT_OCR=0",
                "FAM_UPDATE_CHANNEL=development", *run,
            ],
        ]

    if action == "Lokal bauen: TestFlight-Archiv" and target_name == "iOS TestFlight":
        build_dir = local_build_dir or LOCAL_IOS / "manual-run"
        return [
            [
                "env", "FAM_HARNESS_UI=0", "FAM_UPDATE_CHANNEL=preview-testflight",
                "USE_CCACHE=1", *_prebuild(target),
            ],
            [
                "bun", "tools/build-gui/eas_ios_version_sync.ts", "build:version:sync",
                "--platform", "ios",
                "--profile", "preview-testflight",
            ],
            [
                "env", "FAM_UPDATE_CHANNEL=preview-testflight",
                str(PROJECT_ROOT / "node_modules" / ".bin" / "dotenv"),
                "-o", "-e", ".env.preview", "--", "xcodebuild", "archive",
                "-workspace", "ios/fam.xcworkspace", "-scheme", "fam",
                "-configuration", "Release", "-destination", "generic/platform=iOS",
                "-archivePath", str(build_dir / "fam.xcarchive"),
                "-derivedDataPath", str(IOS_CACHE / "DerivedData"),
                "-allowProvisioningUpdates", "CODE_SIGN_STYLE=Automatic",
                "DEVELOPMENT_TEAM=SW8RP7PA3W",
            ],
            [
                "xcodebuild", "-exportArchive", "-archivePath", str(build_dir / "fam.xcarchive"),
                "-exportOptionsPlist", str(EXPORT_OPTIONS), "-exportPath", str(build_dir / "export"),
            ],
        ]

    if action == "EAS Build starten":
        return [[
            "env", f"FAM_UPDATE_CHANNEL={target.channel}", "bunx", "eas-cli", "build",
            "--platform", target.platform, "--profile", target.profile,
        ]]

    if action == "Letzten Simulator-Build installieren" and target.simulator:
        command = [
            "bunx", "eas-cli", "build:run", "--latest", "--platform", target.platform,
            "--profile", target.profile,
        ]
        if device.strip() and target.platform == "ios":
            command.extend(["--simulator", device.strip()])
        return [command]

    if action == "TestFlight hochladen: EAS" and target_name == "iOS TestFlight":
        ipa = latest_local_build_path("ipa")
        return [[
            "bunx", "eas-cli", "submit", "--platform", "ios", "--profile",
            "preview-testflight", "--path", str(ipa),
        ]]

    if action == "TestFlight hochladen: Xcode" and target_name == "iOS TestFlight":
        archive = latest_local_build_path("archive")
        return [["open", "-a", "Xcode", str(archive)]]

    if action == "OTA-Update veröffentlichen":
        if not message.strip():
            raise ValueError("Bitte eine kurze Update-Beschreibung eingeben.")
        return [[
            "env", f"FAM_UPDATE_CHANNEL={target.channel}", "bunx", "eas-cli", "update",
            "--channel", target.channel,
            "--platform", target.platform, "--message", message.strip(),
            "--environment", target.environment,
        ]]

    raise ValueError(f"Aktion '{action}' ist für '{target_name}' nicht verfügbar.")


def latest_local_build_path(kind: str) -> Path:
    if kind not in {"archive", "ipa"}:
        raise ValueError("Unbekannter lokaler Build-Artefakttyp.")
    try:
        paths = json.loads(LATEST_BUILD.read_text(encoding="utf-8"))
        path = Path(paths[kind]).resolve()
    except (OSError, KeyError, json.JSONDecodeError) as error:
        raise ValueError("Noch kein lokaler TestFlight-Build in dieser GUI erstellt.") from error
    if not path.is_relative_to(LOCAL_IOS.resolve()) or not path.exists():
        raise ValueError("Der gespeicherte lokale Build fehlt. Erstelle zuerst ein neues TestFlight-Archiv.")
    return path


def prepare_action(action: str) -> Path | None:
    if action != "Lokal bauen: TestFlight-Archiv":
        return None
    build_dir = LOCAL_IOS / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    build_dir.mkdir(parents=True, exist_ok=False)
    (IOS_CACHE / "DerivedData").mkdir(parents=True, exist_ok=True)
    (build_dir / "export").mkdir()
    return build_dir


class BuildGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("fam Builds")
        self.geometry("900x620")
        self.minsize(720, 480)
        self.target = tk.StringVar(value="iOS Development Simulator")
        self.action = tk.StringVar(value="Lokal bauen: Simulator")
        self.device = tk.StringVar()
        self.message = tk.StringVar()
        self.status = tk.StringVar(value="Bereit")
        self.output: queue.Queue[tuple[str, str]] = queue.Queue()
        self.running = False
        self.metro_active = False
        self.current_process: subprocess.Popen[str] | None = None
        self.process_lock = threading.Lock()
        self.stop_requested = threading.Event()

        root = ttk.Frame(self, padding=16)
        root.pack(fill="both", expand=True)
        root.columnconfigure(1, weight=1)
        root.rowconfigure(5, weight=1)

        ttk.Label(root, text="Ziel").grid(row=0, column=0, sticky="w", padx=(0, 12), pady=5)
        self.target_menu = ttk.Combobox(root, textvariable=self.target, values=tuple(TARGETS), state="readonly")
        self.target_menu.grid(row=0, column=1, sticky="ew", pady=5)
        self.target_menu.bind("<<ComboboxSelected>>", self._target_changed)
        ttk.Label(root, text="Aktion").grid(row=1, column=0, sticky="w", padx=(0, 12), pady=5)
        self.action_menu = ttk.Combobox(root, textvariable=self.action, state="readonly")
        self.action_menu.grid(row=1, column=1, sticky="ew", pady=5)
        ttk.Label(root, text="Gerät (optional)").grid(row=2, column=0, sticky="w", padx=(0, 12), pady=5)
        ttk.Entry(root, textvariable=self.device).grid(row=2, column=1, sticky="ew", pady=5)
        ttk.Label(root, text="OTA-Update-Beschreibung").grid(row=3, column=0, sticky="w", padx=(0, 12), pady=5)
        ttk.Entry(root, textvariable=self.message).grid(row=3, column=1, sticky="ew", pady=5)
        ttk.Label(
            root,
            text="Lokale iOS-Builds behalten Pods und DerivedData. Cache-Ordner werden nicht automatisch gelöscht.",
        ).grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 10))

        self.log = tk.Text(root, wrap="word", state="disabled")
        self.log.grid(row=5, column=0, columnspan=2, sticky="nsew")
        scrollbar = ttk.Scrollbar(root, command=self.log.yview)
        scrollbar.grid(row=5, column=2, sticky="ns")
        self.log.configure(yscrollcommand=scrollbar.set)
        footer = ttk.Frame(root)
        footer.grid(row=6, column=0, columnspan=2, sticky="ew", pady=(10, 0))
        footer.columnconfigure(0, weight=1)
        ttk.Label(footer, textvariable=self.status).grid(row=0, column=0, sticky="w")
        self.run_button = ttk.Button(footer, text="Ausführen", command=self.start)
        self.run_button.grid(row=0, column=2, padx=(8, 0))
        self.metro_stop_button = ttk.Button(
            footer, text="Metro stoppen", command=self.stop_metro, state="disabled",
        )
        self.metro_stop_button.grid(row=0, column=1, padx=(8, 0))
        self._target_changed()
        self.after(100, self._drain_output)
        self.protocol("WM_DELETE_WINDOW", self._close)

    def _target_changed(self, _event: tk.Event[tk.Misc] | None = None) -> None:
        target = TARGETS[self.target.get()]
        actions: list[str] = []
        if self.target.get() == "iOS Development Simulator":
            actions.extend(["Lokal bauen: Simulator", "Letzten Simulator-Build installieren"])
        if self.target.get() == "iOS TestFlight":
            actions.extend([
                "Lokal bauen: TestFlight-Archiv", "TestFlight hochladen: EAS",
                "TestFlight hochladen: Xcode",
            ])
        actions.append("EAS Build starten")
        actions.append("OTA-Update veröffentlichen")
        if target.simulator and "Letzten Simulator-Build installieren" not in actions:
            actions.insert(0, "Letzten Simulator-Build installieren")
        self.action_menu.configure(values=tuple(actions))
        if self.action.get() not in actions:
            self.action.set(actions[0])

    def start(self) -> None:
        if self.running:
            return
        try:
            build_dir = prepare_action(self.action.get())
            commands = commands_for(
                self.target.get(), self.action.get(), self.device.get(), self.message.get(), build_dir,
            )
        except (OSError, ValueError) as error:
            self.status.set(str(error))
            return
        self.running = True
        self.metro_active = False
        self.stop_requested.clear()
        self.run_button.configure(state="disabled")
        self.metro_stop_button.configure(state="disabled")
        self.target_menu.configure(state="disabled")
        self.action_menu.configure(state="disabled")
        self.status.set("Läuft …")
        metro_command_index = 1 if self.action.get() == "Lokal bauen: Simulator" else None
        threading.Thread(
            target=self._run_commands,
            args=(commands, build_dir, metro_command_index),
            daemon=True,
        ).start()

    def stop_metro(self) -> None:
        with self.process_lock:
            process = self.current_process
        if process is None:
            self.metro_stop_button.configure(state="disabled")
            self.status.set("Metro wird bereits beendet …")
            return

        self.stop_requested.set()
        self.metro_stop_button.configure(state="disabled")
        self.status.set("Metro wird beendet …")
        try:
            os.killpg(process.pid, signal.SIGINT)
        except ProcessLookupError:
            pass
        except OSError as error:
            self.stop_requested.clear()
            self.status.set(f"Metro konnte nicht beendet werden: {error}")
            self.metro_stop_button.configure(state="normal")

    def _run_commands(
        self,
        commands: list[list[str]],
        build_dir: Path | None,
        metro_command_index: int | None,
    ) -> None:
        environment = os.environ.copy()
        for index, command in enumerate(commands):
            self.output.put(("line", f"$ {' '.join(command)}\n"))
            try:
                process = subprocess.Popen(
                    command, cwd=PROJECT_ROOT, env=environment,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                    start_new_session=index == metro_command_index,
                )
            except OSError as error:
                self.output.put(("done", f"Start fehlgeschlagen: {error}"))
                return
            with self.process_lock:
                self.current_process = process
            if process.stdout is not None:
                for line in process.stdout:
                    self.output.put(("line", line))
                    if index == metro_command_index and "Waiting on " in line:
                        self.output.put(("metro_started", ""))
            return_code = process.wait()
            with self.process_lock:
                self.current_process = None
            if self.stop_requested.is_set():
                self.output.put(("done", "Metro beendet"))
                return
            if return_code:
                self.output.put(("done", f"Fehlgeschlagen · Exit-Code {process.returncode}"))
                return
        if build_dir is not None:
            archive = build_dir / "fam.xcarchive"
            ipa_files = list((build_dir / "export").glob("*.ipa"))
            if not archive.is_dir() or len(ipa_files) != 1:
                self.output.put(("done", "Export fehlgeschlagen: Xcode-Archiv oder einzelne IPA fehlt."))
                return
            artifact = {"archive": str(archive), "ipa": str(ipa_files[0])}
            try:
                LATEST_BUILD.parent.mkdir(parents=True, exist_ok=True)
                LATEST_BUILD.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
            except OSError as error:
                self.output.put(("done", f"Build fertig, letzter Build konnte nicht gespeichert werden: {error}"))
                return
        self.output.put(("done", "Erfolgreich abgeschlossen"))

    def _drain_output(self) -> None:
        while True:
            try:
                kind, value = self.output.get_nowait()
            except queue.Empty:
                break
            if kind == "line":
                self.log.configure(state="normal")
                self.log.insert("end", value)
                self.log.see("end")
                self.log.configure(state="disabled")
            elif kind == "metro_started":
                self.metro_active = True
                self.status.set("Metro läuft. Zum Beenden „Metro stoppen“ drücken.")
                self.metro_stop_button.configure(state="normal")
            else:
                self.status.set(value)
                self.running = False
                self.metro_active = False
                self.stop_requested.clear()
                self.run_button.configure(state="normal")
                self.metro_stop_button.configure(state="disabled")
                self.target_menu.configure(state="readonly")
                self.action_menu.configure(state="readonly")
        self.after(100, self._drain_output)

    def _close(self) -> None:
        if self.running:
            message = (
                "Metro läuft noch. Zum Beenden „Metro stoppen“ drücken."
                if self.metro_active else "Build läuft noch; Fenster bleibt geöffnet"
            )
            self.status.set(message)
            return
        self.destroy()


if __name__ == "__main__":
    BuildGui().mainloop()
