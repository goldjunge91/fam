#!/usr/bin/env python3
"""macOS GUI for the lock-aware native build workflow."""

from __future__ import annotations

import json
import os
import queue
import shlex
import signal
import subprocess
import threading
import tkinter as tk
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, ttk


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = PROJECT_ROOT / "native-build-lock.json"
LOG_DIR = PROJECT_ROOT / "tools" / "build-gui" / "logs"

STATUS_ACTION = "Lock prüfen"
DIFF_ACTION = "Lock-Diff anzeigen (bei Mismatch)"
DEV_ACTION = "Dev-Loop starten (schnell, expo run:*)"
RUN_ACTION = "Simulator/Emulator starten"
RESTORE_ACTION = "Artefakt wiederherstellen"
REBUILD_ACTION = "Rebuild (explizit freigeben)"
SUBMIT_ACTION = "TestFlight hochladen"


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


TARGETS = {
    "iOS Development": Target(
        label="iOS Development-Simulator",
        name="ios-development-simulator",
        description="Startet ausschließlich das gelockte Debug-APP im iOS-Simulator.",
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
        description="Startet ausschließlich die gelockte Debug-APK im Android-Emulator.",
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
        self.action = tk.StringVar(value=RUN_ACTION)
        self.approve_rebuild = tk.BooleanVar(value=False)
        self.eas_build_id = tk.StringVar()
        self.status = tk.StringVar(value="Lock wird geprüft …")
        self.target_state = tk.StringVar()
        self.output: queue.Queue[tuple[str, object]] = queue.Queue()
        self.process: subprocess.Popen[str] | None = None
        self.worker: threading.Thread | None = None
        self.running = False

        self._build_ui()
        self._refresh_target_info()
        self.after(150, self.refresh_status)
        self.after(100, self._drain_output)
        self.protocol("WM_DELETE_WINDOW", self._close)

    def _build_ui(self) -> None:
        container = ttk.Frame(self, padding=18)
        container.pack(fill="both", expand=True)
        container.columnconfigure(1, weight=1)
        container.rowconfigure(5, weight=1)

        ttk.Label(container, text="Ziel").grid(
            row=0, column=0, sticky="w", padx=(0, 12), pady=6
        )
        target_menu = ttk.Combobox(
            container,
            textvariable=self.target,
            values=tuple(TARGETS),
            state="readonly",
        )
        target_menu.grid(row=0, column=1, sticky="ew", pady=6)
        target_menu.bind("<<ComboboxSelected>>", self._target_changed)

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

        self.description = ttk.Label(container, anchor="w", justify="left")
        self.description.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(4, 2))
        ttk.Label(container, textvariable=self.target_state).grid(
            row=4, column=0, columnspan=2, sticky="w", pady=(0, 10)
        )

        self.rebuild_check = ttk.Checkbutton(
            container,
            text="Ich erlaube für diese Aktion ausdrücklich Prebuild, CocoaPods und Kompilierung.",
            variable=self.approve_rebuild,
        )
        self.rebuild_check.grid(row=5, column=0, columnspan=2, sticky="w", pady=(0, 10))

        log_frame = ttk.Frame(container)
        log_frame.grid(row=6, column=0, columnspan=2, sticky="nsew")
        container.rowconfigure(6, weight=1)
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
        footer.grid(row=7, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        footer.columnconfigure(0, weight=1)
        ttk.Label(footer, textvariable=self.status).grid(row=0, column=0, sticky="w")
        self.refresh_button = ttk.Button(footer, text="Status prüfen", command=self.refresh_status)
        self.refresh_button.grid(row=0, column=1, padx=(8, 0))
        self.start_button = ttk.Button(footer, text="Ausführen", command=self.start_action)
        self.start_button.grid(row=0, column=2, padx=(8, 0))
        self.stop_button = ttk.Button(footer, text="Abbrechen", command=self.stop_build, state="disabled")
        self.stop_button.grid(row=0, column=3, padx=(8, 0))

    def _target_changed(self, _event: tk.Event[tk.Misc]) -> None:
        self._refresh_target_info()

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

        actions = [STATUS_ACTION, DIFF_ACTION, REBUILD_ACTION]
        if target.dev_loop:
            actions.insert(2, DEV_ACTION)
        if target.simulator:
            actions.insert(2, RUN_ACTION)
        if target.submit:
            actions.append(SUBMIT_ACTION)
        actions.insert(actions.index(REBUILD_ACTION), RESTORE_ACTION)

        self.action_menu.configure(values=tuple(actions))
        if self.action.get() not in actions:
            self.action.set(DEV_ACTION if target.dev_loop else STATUS_ACTION)
        self._refresh_target_state()
        self._update_controls()

    def _refresh_target_state(self) -> None:
        target_lock = self._read_target_lock()
        if target_lock is None:
            self.target_state.set("Artefakt: nicht im Native-Lock registriert")
            return

        relative_path = target_lock.get("relativePath")
        artifact_path = PROJECT_ROOT / relative_path if isinstance(relative_path, str) else None
        if artifact_path is not None and artifact_path.exists():
            state = "lokal vorhanden, SHA-256 wird beim Status geprüft"
        else:
            state = "lokal nicht vorhanden"
        build_id = target_lock.get("easBuildId")
        if isinstance(build_id, str) and build_id:
            state += f", EAS Build-ID {build_id}"
        else:
            state += ", keine EAS Build-ID hinterlegt"
        self.target_state.set(f"Artefakt: {state}")

    def _update_controls(self) -> None:
        is_rebuild = self.action.get() == REBUILD_ACTION
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

    def _command(self) -> tuple[list[str], dict[str, str], str]:
        target = self._selected_target()
        action = self.action.get()
        env = self._base_environment()
        native_command = ["bun", "run"]

        if action == STATUS_ACTION:
            return [*native_command, "native:status"], env, "Native-Lock prüfen"

        if action == DIFF_ACTION:
            return (
                [*native_command, "native:status", "--", "--diff"],
                env,
                "Native-Lock-Diff (abweichende Fingerprint-Quelle anzeigen)",
            )

        if action == DEV_ACTION:
            if not target.dev_loop:
                raise ValueError(
                    "Der Dev-Loop-Pfad ist nur für Development-Targets gedacht "
                    "(siehe DEV_TARGETS in scripts/native-build.ts)."
                )
            command = [
                *native_command,
                "native:dev",
                "--",
                "--target",
                target.name,
            ]
            return (
                self._with_env_file(command, target.env_file),
                env,
                f"{target.label}: Inner Loop (expo run:*, ccache)",
            )

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
            return self._with_env_file(command, target.env_file), env, f"{target.label} starten"

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

        raise ValueError(f"Unbekannte Aktion: {action}")

    def start_action(self) -> None:
        if self.running:
            return
        try:
            command, env, label = self._command()
        except ValueError as error:
            messagebox.showwarning("Native Build Lock", str(error))
            return
        self._start_process(command, env, label)

    def refresh_status(self) -> None:
        if self.running:
            return
        self._start_process(["bun", "run", "native:status"], self._base_environment(), "Native-Lock prüfen")

    def _start_process(self, command: list[str], env: dict[str, str], label: str) -> None:
        self.running = True
        self._write_log(f"$ {shlex.join(command)}\n\n")
        self.status.set(f"Läuft: {label}")
        self.start_button.configure(state="disabled")
        self.refresh_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        log_path = LOG_DIR / f"native-{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log"
        self._write_log(f"Logdatei: {log_path}\n\n")
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
                    self._write_log(str(value))
                elif kind == "done":
                    self.process = None
                    self.running = False
                    self.start_button.configure(state="normal")
                    self.refresh_button.configure(state="normal")
                    self.stop_button.configure(state="disabled")
                    if value == 0:
                        self.status.set("Erfolgreich abgeschlossen")
                    else:
                        self.status.set(f"Fehlgeschlagen (Exit-Code {value})")
                    self._refresh_target_info()
                else:
                    self.process = None
                    self.running = False
                    self.start_button.configure(state="normal")
                    self.refresh_button.configure(state="normal")
                    self.stop_button.configure(state="disabled")
                    self.status.set("Fehler")
                    self._write_log(f"\nFEHLER: {value}\n")
        except queue.Empty:
            pass
        self.after(100, self._drain_output)

    def _write_log(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _close(self) -> None:
        if self.running:
            if not messagebox.askyesno("Aktion läuft", "Aktion wirklich abbrechen und GUI schließen?"):
                return
            self.stop_build()
        self.destroy()


if __name__ == "__main__":
    BuildGui().mainloop()
