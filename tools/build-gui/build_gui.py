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
                "env", "FAM_HARNESS_UI=0", "FAM_IOS_MLKIT_OCR=1",
                "FAM_UPDATE_CHANNEL=preview-testflight",
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
                "COMPILATION_CACHE_ENABLE_CACHING=YES",
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
        self.geometry("1060x760")
        self.minsize(860, 620)
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

        self._configure_styles()
        shell = ttk.Frame(self, style="App.TFrame")
        shell.pack(fill="both", expand=True)
        shell.columnconfigure(1, weight=1)
        shell.rowconfigure(0, weight=1)

        sidebar = ttk.Frame(shell, style="Sidebar.TFrame", padding=(22, 24))
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.configure(width=218)
        sidebar.grid_propagate(False)
        ttk.Label(sidebar, text="fam", style="Brand.TLabel").pack(anchor="w")
        ttk.Label(sidebar, text="BUILD STUDIO", style="BrandCaption.TLabel").pack(
            anchor="w", pady=(1, 24),
        )
        ttk.Separator(sidebar).pack(fill="x", pady=(0, 22))
        ttk.Label(sidebar, text="LOKALER BUILDER", style="SideCaption.TLabel").pack(anchor="w")
        ttk.Label(
            sidebar,
            text="iOS und Android\nSimulator · TestFlight · OTA",
            style="SideBody.TLabel",
            justify="left",
        ).pack(anchor="w", pady=(8, 0))
        ttk.Frame(sidebar, style="Sidebar.TFrame").pack(fill="both", expand=True)
        ttk.Separator(sidebar).pack(fill="x", pady=(12, 16))
        ttk.Label(sidebar, text="IOS ARCHIV CACHE", style="SideCaption.TLabel").pack(anchor="w")
        ttk.Label(
            sidebar,
            text="build/cache/ios/DerivedData",
            style="CachePath.TLabel",
            wraplength=170,
            justify="left",
        ).pack(anchor="w", pady=(8, 5))
        ttk.Label(
            sidebar,
            text="Für lokale Archive aktiviert",
            style="CacheState.TLabel",
            wraplength=170,
            justify="left",
        ).pack(anchor="w")

        main = ttk.Frame(shell, style="App.TFrame", padding=(32, 26, 32, 20))
        main.grid(row=0, column=1, sticky="nsew")
        main.columnconfigure(0, weight=1)
        main.rowconfigure(7, weight=1)

        header = ttk.Frame(main, style="App.TFrame")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 25))
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="BUILD WORKSPACE", style="Eyebrow.TLabel").grid(
            row=0, column=0, sticky="w",
        )
        ttk.Label(header, text="Neuen Build konfigurieren", style="Title.TLabel").grid(
            row=1, column=0, sticky="w", pady=(5, 3),
        )
        ttk.Label(
            header,
            text="Ziel wählen, Aktion starten und den Lauf hier verfolgen.",
            style="Subtitle.TLabel",
        ).grid(row=2, column=0, sticky="w")
        self.status_label = ttk.Label(
            header, textvariable=self.status, style="Status.TLabel", wraplength=220,
            justify="right",
        )
        self.status_label.grid(row=0, column=1, rowspan=3, sticky="ne", padx=(20, 0))

        ttk.Label(main, text="KONFIGURATION", style="Section.TLabel").grid(
            row=1, column=0, sticky="w", pady=(0, 10),
        )
        form = ttk.Frame(main, style="App.TFrame")
        form.grid(row=2, column=0, sticky="ew")
        form.columnconfigure(0, weight=1)
        form.columnconfigure(1, weight=1)

        target_field = ttk.Frame(form, style="App.TFrame")
        target_field.grid(row=0, column=0, sticky="ew", padx=(0, 10), pady=(0, 8))
        ttk.Label(target_field, text="BUILD-ZIEL", style="Field.TLabel").pack(anchor="w", pady=(0, 6))
        self.target_menu = ttk.Combobox(
            target_field, textvariable=self.target, values=tuple(TARGETS), state="readonly",
        )
        self.target_menu.pack(fill="x")
        self.target_menu.bind("<<ComboboxSelected>>", self._target_changed)
        action_field = ttk.Frame(form, style="App.TFrame")
        action_field.grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=(0, 8))
        ttk.Label(action_field, text="AKTION", style="Field.TLabel").pack(anchor="w", pady=(0, 6))
        self.action_menu = ttk.Combobox(action_field, textvariable=self.action, state="readonly")
        self.action_menu.pack(fill="x")
        self.action_menu.bind("<<ComboboxSelected>>", self._action_changed)

        self.device_field = self._make_entry_field(form, "GERÄT (OPTIONAL)", self.device)
        self.message_field = self._make_entry_field(form, "OTA-UPDATE-BESCHREIBUNG", self.message)

        self.context_label = ttk.Label(main, style="Hint.TLabel", wraplength=760)
        self.context_label.grid(row=3, column=0, sticky="w", pady=(10, 0))

        self.steps_frame = ttk.Frame(main, style="App.TFrame")
        self.steps_frame.grid(row=4, column=0, sticky="ew", pady=(16, 20))
        for column in range(4):
            self.steps_frame.columnconfigure(column, weight=1)
        for index, name in enumerate(("Prebuild", "Version", "Xcode-Archiv", "IPA-Export"), start=1):
            step = ttk.Frame(self.steps_frame, style="App.TFrame")
            step.grid(row=0, column=index - 1, sticky="w", padx=(0, 8))
            ttk.Label(step, text=str(index), style="StepNumber.TLabel").pack(side="left", padx=(0, 7))
            ttk.Label(step, text=name, style="Step.TLabel").pack(side="left")

        action_row = ttk.Frame(main, style="App.TFrame")
        action_row.grid(row=5, column=0, sticky="ew", pady=(0, 18))
        action_row.columnconfigure(0, weight=1)
        self.metro_stop_button = ttk.Button(
            action_row, text="Metro stoppen", command=self.stop_metro, state="disabled",
            style="Secondary.TButton",
        )
        self.metro_stop_button.grid(row=0, column=0, sticky="w")
        self.run_button = ttk.Button(
            action_row, text="Ausführen", command=self.start, style="Primary.TButton",
        )
        self.run_button.grid(row=0, column=1, sticky="e")

        output_header = ttk.Frame(main, style="App.TFrame")
        output_header.grid(row=6, column=0, sticky="ew", pady=(0, 8))
        output_header.columnconfigure(0, weight=1)
        ttk.Label(output_header, text="BUILD-AUSGABE", style="Section.TLabel").grid(
            row=0, column=0, sticky="w",
        )
        ttk.Label(output_header, text="Live", style="Live.TLabel").grid(row=0, column=1, sticky="e")

        output_frame = ttk.Frame(main, style="App.TFrame")
        output_frame.grid(row=7, column=0, sticky="nsew")
        output_frame.columnconfigure(0, weight=1)
        output_frame.rowconfigure(0, weight=1)
        self.log = tk.Text(
            output_frame, wrap="word", state="disabled", relief="flat", borderwidth=0,
            background="#302a30", foreground="#eee3dc", insertbackground="#eee3dc",
            selectbackground="#875a70", padx=14, pady=12,
            font=("Menlo", 11), highlightthickness=1, highlightbackground="#d8ccc9",
        )
        self.log.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(output_frame, command=self.log.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.log.configure(yscrollcommand=scrollbar.set)
        self.log.configure(state="normal")
        self.log.insert("end", "Bereit. Die Build-Ausgabe erscheint hier.\n")
        self.log.configure(state="disabled")

        self._target_changed()
        self.after(100, self._drain_output)
        self.protocol("WM_DELETE_WINDOW", self._close)

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("App.TFrame", background="#fbf7f2")
        style.configure("Sidebar.TFrame", background="#f7f0eb")
        style.configure(
            "Brand.TLabel", background="#f7f0eb", foreground="#30272e",
            font=("TkDefaultFont", 23, "bold"),
        )
        style.configure(
            "BrandCaption.TLabel", background="#f7f0eb", foreground="#71646d",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "SideCaption.TLabel", background="#f7f0eb", foreground="#875a70",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "SideBody.TLabel", background="#f7f0eb", foreground="#514750",
            font=("TkDefaultFont", 10),
        )
        style.configure(
            "CachePath.TLabel", background="#f7f0eb", foreground="#514750",
            font=("TkFixedFont", 9),
        )
        style.configure(
            "CacheState.TLabel", background="#f7f0eb", foreground="#4c765f",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "Eyebrow.TLabel", background="#fbf7f2", foreground="#875a70",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "Title.TLabel", background="#fbf7f2", foreground="#30272e",
            font=("TkDefaultFont", 22, "bold"),
        )
        style.configure(
            "Subtitle.TLabel", background="#fbf7f2", foreground="#71646d",
            font=("TkDefaultFont", 10),
        )
        style.configure(
            "Status.TLabel", background="#fbf7f2", foreground="#53394c",
            font=("TkDefaultFont", 10, "bold"),
        )
        style.configure(
            "Section.TLabel", background="#fbf7f2", foreground="#30272e",
            font=("TkDefaultFont", 10, "bold"),
        )
        style.configure(
            "Field.TLabel", background="#fbf7f2", foreground="#71646d",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "Hint.TLabel", background="#fbf7f2", foreground="#71646d",
            font=("TkDefaultFont", 9),
        )
        style.configure(
            "Live.TLabel", background="#fbf7f2", foreground="#4c765f",
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure(
            "Step.TLabel", background="#fbf7f2", foreground="#514750",
            font=("TkDefaultFont", 9),
        )
        style.configure(
            "StepNumber.TLabel", background="#e9dce2", foreground="#53394c",
            font=("TkDefaultFont", 9, "bold"), padding=(6, 3),
        )
        style.configure(
            "TCombobox", fieldbackground="#fffdfa", background="#fffdfa",
            foreground="#30272e", arrowcolor="#875a70", bordercolor="#d8ccc9", padding=8,
        )
        style.map(
            "TCombobox", fieldbackground=[("readonly", "#fffdfa")],
            foreground=[("readonly", "#30272e")],
        )
        style.configure(
            "TEntry", fieldbackground="#fffdfa", foreground="#30272e",
            bordercolor="#d8ccc9", padding=8,
        )
        style.configure("TSeparator", background="#d8ccc9")
        style.configure("TButton", padding=(12, 8), font=("TkDefaultFont", 10))
        style.configure(
            "Primary.TButton", background="#53394c", foreground="#ffffff",
            bordercolor="#53394c", padding=(16, 9), font=("TkDefaultFont", 10, "bold"),
        )
        style.map(
            "Primary.TButton", background=[("active", "#6b4c63"), ("disabled", "#b7a7b1")],
            foreground=[("disabled", "#f7f0eb")],
        )
        style.configure(
            "Secondary.TButton", background="#f7f0eb", foreground="#53394c",
            bordercolor="#d8ccc9",
        )
        style.map(
            "Secondary.TButton", background=[("active", "#e9dce2"), ("disabled", "#f7f0eb")],
        )

    @staticmethod
    def _make_entry_field(parent: ttk.Frame, label: str, variable: tk.StringVar) -> ttk.Frame:
        field = ttk.Frame(parent, style="App.TFrame")
        ttk.Label(field, text=label, style="Field.TLabel").pack(anchor="w", pady=(0, 6))
        ttk.Entry(field, textvariable=variable).pack(fill="x")
        return field

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
        self._action_changed()

    def _action_changed(self, _event: tk.Event[tk.Misc] | None = None) -> None:
        action = self.action.get()
        target = TARGETS[self.target.get()]

        if self.device_field.winfo_manager() == "grid":
            self.device_field.grid_remove()
        if self.message_field.winfo_manager() == "grid":
            self.message_field.grid_remove()
        row = 1
        if target.simulator and action in {
            "Lokal bauen: Simulator", "Letzten Simulator-Build installieren",
        }:
            self.device_field.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(10, 0))
            row += 1
        if action == "OTA-Update veröffentlichen":
            self.message_field.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(10, 0))

        is_local_testflight = action == "Lokal bauen: TestFlight-Archiv"
        if is_local_testflight:
            self.steps_frame.grid()
            self.context_label.configure(
                text="Das lokale Archiv läuft über xcodebuild mit stabilem DerivedData-Pfad und Xcode Compilation Cache.",
            )
        else:
            self.steps_frame.grid_remove()
            self.context_label.configure(text="Die Build-Ausgabe wird während des Laufs hier live angezeigt.")

        button_labels = {
            "Lokal bauen: Simulator": "Simulator bauen",
            "Letzten Simulator-Build installieren": "Build installieren",
            "Lokal bauen: TestFlight-Archiv": "Archiv erstellen",
            "EAS Build starten": "EAS Build starten",
            "TestFlight hochladen: EAS": "Mit EAS hochladen",
            "TestFlight hochladen: Xcode": "Archiv in Xcode öffnen",
            "OTA-Update veröffentlichen": "Update veröffentlichen",
        }
        self.run_button.configure(text=button_labels.get(action, "Ausführen"))

        if action == "Lokal bauen: Simulator":
            self.metro_stop_button.grid()
        else:
            self.metro_stop_button.grid_remove()

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
