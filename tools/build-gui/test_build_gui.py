import unittest
import json
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from build_gui import (
    BuildGui,
    TARGETS,
    classify_log_line,
    extract_xcode_error_lines,
    format_duration,
    is_auto_repairable_native_failure,
    load_persisted_runs,
    matches_log_filter,
    parse_latest_eas_build,
    read_recent_xcode_diagnostics,
)


class BuildGuiHelpersTest(unittest.TestCase):
    class _Value:
        def __init__(self) -> None:
            self.value = ""

        def set(self, value: str) -> None:
            self.value = value

        def get(self) -> str:
            return self.value

    def test_refresh_target_state_uses_selected_target_during_gui_startup(self) -> None:
        gui = BuildGui.__new__(BuildGui)
        gui._selected_target = lambda: TARGETS["iOS TestFlight"]
        gui._read_target_lock = lambda: None
        gui.latest_build = {"id": "build-123", "status": "finished"}
        gui.latest_build_checked = False
        gui.target_state = self._Value()

        BuildGui._refresh_target_state(gui)

        self.assertIn("nicht im Native-Lock registriert", gui.target_state.value)

    def test_recovery_action_runs_diff_and_prepares_the_rebuild_path(self) -> None:
        gui = BuildGui.__new__(BuildGui)
        gui._selected_target = lambda: TARGETS["iOS Development"]
        gui._base_environment = lambda: {}
        gui.action = self._Value()
        gui.action.set("Mismatch zurückführen (prüfen)")

        command, environment, label = BuildGui._command(gui)

        self.assertEqual(command, ["bun", "run", "native:status", "--", "--diff"])
        self.assertEqual(environment, {})
        self.assertIn("Mismatch", label)

    def test_loads_persisted_history_and_ignores_paths_outside_project(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            log_path = root / "tools" / "build-gui" / "logs" / "run.log"
            log_path.parent.mkdir(parents=True)
            log_path.write_text("$ bun run native:dev\nBuild Succeeded\n", encoding="utf-8")
            metrics_path = root / ".build-metrics" / "gui-runs.jsonl"
            metrics_path.parent.mkdir()
            rows = [
                {
                    "ts": "2026-09-03T10:00:00",
                    "target": "ios-development-simulator",
                    "action": "Dev-Loop starten (schnell, expo run:*)",
                    "label": "iOS Development",
                    "command": "bun run native:dev",
                    "totalMs": 1250,
                    "exitCode": 0,
                    "logPath": "tools/build-gui/logs/run.log",
                },
                {
                    "ts": "2026-09-03T09:00:00",
                    "target": "ios-development-simulator",
                    "action": "alter Lauf",
                    "logPath": "../outside.log",
                },
            ]
            metrics_path.write_text(
                "\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8"
            )

            runs = load_persisted_runs(root, metrics_path)

            self.assertEqual(len(runs), 1)
            self.assertEqual(runs[0].label, "iOS Development")
            self.assertEqual(runs[0].elapsed_ms, 1250)
            self.assertEqual(len(runs[0].entries), 2)

    def test_classifies_build_errors_and_phases(self) -> None:
        self.assertEqual(classify_log_line("Error: xcodebuild failed"), "error")
        self.assertEqual(classify_log_line("Native Build Lock: Fingerprint weicht ab"), "warning")
        self.assertEqual(
            classify_log_line(
                "Native Build Lock: ios-Fingerprint stimmt nicht mit dem Lock überein"
            ),
            "warning",
        )
        self.assertEqual(classify_log_line("› Executing react-native Pods/Hermes"), "phase")
        self.assertEqual(classify_log_line("$ bun run native:dev"), "action")

    def test_filters_include_only_the_requested_categories(self) -> None:
        self.assertTrue(matches_log_filter("error", "Fehler/Warnungen"))
        self.assertTrue(matches_log_filter("warning", "Fehler/Warnungen"))
        self.assertFalse(matches_log_filter("phase", "Fehler/Warnungen"))
        self.assertTrue(matches_log_filter("phase", "Build-Phasen"))
        self.assertFalse(matches_log_filter("info", "Build-Phasen"))

    def test_formats_elapsed_time(self) -> None:
        self.assertEqual(format_duration(0), "00:00")
        self.assertEqual(format_duration(65_000), "01:05")
        self.assertEqual(format_duration(3_661_000), "01:01:01")

    def test_recognizes_only_known_local_native_failures_for_auto_repair(self) -> None:
        self.assertTrue(
            is_auto_repairable_native_failure(
                "SQLiteModule.swift:114: error: cannot find 'exsqlite3_open' in scope"
            )
        )
        self.assertTrue(
            is_auto_repairable_native_failure(
                "Explicit modules is enabled but the compiler was not recognized"
            )
        )
        self.assertFalse(is_auto_repairable_native_failure("Signing certificate missing"))

    def test_pod_repair_is_local_and_keeps_ccache_enabled(self) -> None:
        gui = BuildGui.__new__(BuildGui)
        gui._base_environment = lambda: {"PATH": "/usr/bin"}

        command, environment, label = BuildGui._pod_repair_command(gui)

        self.assertEqual(command, ["pod", "install", "--project-directory=ios"])
        self.assertEqual(environment["USE_CCACHE"], "1")
        self.assertIn("Pods", label)

    def test_reads_latest_eas_build_from_wrapped_json(self) -> None:
        output = "EAS output:\n{" + '"builds": [{"id": "build-123", "status": "finished", "profile": "preview-testflight"}]}'

        self.assertEqual(
            parse_latest_eas_build(output),
            {
                "id": "build-123",
                "status": "finished",
                "profile": "preview-testflight",
            },
        )

    def test_latest_eas_command_filters_by_build_profile(self) -> None:
        command = BuildGui._latest_eas_command(TARGETS["iOS TestFlight"])

        self.assertIn("--build-profile", command)
        self.assertIn("preview-testflight", command)
        self.assertIn("--status", command)
        self.assertIn("finished", command)
        self.assertNotIn("--profile", command)

    def test_latest_eas_command_can_filter_by_native_fingerprint(self) -> None:
        command = BuildGui._latest_eas_command(
            TARGETS["iOS TestFlight"], "fingerprint-123"
        )

        self.assertIn("--fingerprint-hash", command)
        self.assertIn("fingerprint-123", command)

    def test_extracts_actionable_xcode_errors_without_repeating_them(self) -> None:
        output = """\
note: unrelated compiler note
/project/SQLiteModule.swift:114:14: error: cannot find 'exsqlite3_open' in scope
/project/SQLiteModule.swift:114:14: error: cannot find 'exsqlite3_open' in scope
** BUILD FAILED **
The following build commands failed:
    SwiftCompile SQLiteModule.swift
"""

        self.assertEqual(
            extract_xcode_error_lines(output),
            [
                "/project/SQLiteModule.swift:114:14: error: cannot find 'exsqlite3_open' in scope",
                "** BUILD FAILED **",
                "The following build commands failed:",
                "SwiftCompile SQLiteModule.swift",
            ],
        )

    def test_prioritizes_compiler_errors_after_early_build_steps(self) -> None:
        output = "\n".join(
            [*(f"SwiftCompile step-{index}" for index in range(30)),
             "/project/SQLiteModule.swift:114:14: error: cannot find symbol"]
        )

        self.assertEqual(
            extract_xcode_error_lines(output, limit=1),
            ["/project/SQLiteModule.swift:114:14: error: cannot find symbol"],
        )

    def test_does_not_treat_error_like_identifiers_as_compiler_errors(self) -> None:
        self.assertEqual(
            extract_xcode_error_lines("internal final class SecAccessControlError:\n"),
            [],
        )

    def test_reads_only_xcode_logs_created_during_this_run(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            expo_dir = root / ".expo"
            expo_dir.mkdir()
            error_log = expo_dir / "xcodebuild-error.log"
            error_log.write_text(
                "/project/SQLiteModule.swift:114:14: error: missing symbol\n",
                encoding="utf-8",
            )
            started_at = datetime.fromtimestamp(error_log.stat().st_mtime + 2)
            self.assertEqual(read_recent_xcode_diagnostics(root, started_at), [])

            error_log.touch()
            diagnostics = read_recent_xcode_diagnostics(root, datetime.now())
            self.assertEqual(len(diagnostics), 1)
            self.assertEqual(diagnostics[0][0], error_log)
            self.assertEqual(diagnostics[0][1], [
                "/project/SQLiteModule.swift:114:14: error: missing symbol"
            ])


if __name__ == "__main__":
    unittest.main()
