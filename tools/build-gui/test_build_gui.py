import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from build_gui import (
    IOS_CACHE,
    LATEST_BUILD,
    LOCAL_IOS,
    PROJECT_ROOT,
    TARGETS,
    commands_for,
    latest_local_build_path,
    prepare_action,
)


class BuildGuiCommandTest(unittest.TestCase):
    def test_local_simulator_build_prebuilds_without_cleaning_then_runs_expo(self) -> None:
        commands = commands_for(
            "iOS Development Simulator", "Lokal bauen: Simulator", "iPhone 17"
        )

        self.assertEqual(len(commands), 2)
        self.assertEqual(commands[0][:3], ["env", "FAM_HARNESS_UI=1", "bun"])
        self.assertIn("--no-clean", commands[0])
        self.assertNotIn("--clean", commands[0])
        self.assertIn("run:ios", commands[1])
        self.assertEqual(commands[1][-3:], ["--device", "iPhone 17"])

    def test_local_testflight_build_reuses_derived_data_and_keeps_unique_artifacts(self) -> None:
        build_dir = LOCAL_IOS / "unique-build"
        commands = commands_for("iOS TestFlight", "Lokal bauen: TestFlight-Archiv", local_build_dir=build_dir)

        self.assertEqual(len(commands), 4)
        self.assertIn("--no-clean", commands[0])
        self.assertIn("USE_CCACHE=1", commands[0])
        self.assertIn("build:version:sync", commands[1])
        self.assertIn("-derivedDataPath", commands[2])
        self.assertIn(str(IOS_CACHE / "DerivedData"), commands[2])
        self.assertIn(str(build_dir / "fam.xcarchive"), commands[2])
        self.assertIn(str(build_dir / "fam.xcarchive"), commands[3])
        self.assertIn("-exportArchive", commands[3])

    def test_eas_build_uses_selected_profile_and_platform(self) -> None:
        command = commands_for("iOS TestFlight", "EAS Build starten")[0]
        self.assertEqual(
            command,
            ["env", "FAM_UPDATE_CHANNEL=preview-testflight", "bunx", "eas-cli", "build",
             "--platform", "ios", "--profile", "preview-testflight"],
        )

    def test_latest_eas_artifact_can_be_installed_on_a_simulator(self) -> None:
        command = commands_for(
            "Android Preview Emulator", "Letzten Simulator-Build installieren"
        )[0]
        self.assertEqual(command[:5], ["bunx", "eas-cli", "build:run", "--latest", "--platform"])
        self.assertIn("preview", command)

    def test_eas_upload_submits_the_ipa_from_the_latest_local_archive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build = root / "build-1"
            ipa = build / "export" / "fam.ipa"
            ipa.parent.mkdir(parents=True)
            ipa.touch()
            marker = root / "latest.json"
            marker.write_text(json.dumps({"ipa": str(ipa), "archive": str(build / "fam.xcarchive")}))
            with patch("build_gui.LOCAL_IOS", root), patch("build_gui.LATEST_BUILD", marker):
                command = commands_for("iOS TestFlight", "TestFlight hochladen: EAS")[0]

        self.assertIn("submit", command)
        self.assertIn("--path", command)
        self.assertIn(str(ipa), command)
        self.assertIn("preview-testflight", command)

    def test_xcode_upload_opens_the_latest_archive_in_organizer(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "build-1" / "fam.xcarchive"
            archive.mkdir(parents=True)
            marker = root / "latest.json"
            marker.write_text(json.dumps({"archive": str(archive), "ipa": str(root / "fam.ipa")}))
            with patch("build_gui.LOCAL_IOS", root), patch("build_gui.LATEST_BUILD", marker):
                command = commands_for("iOS TestFlight", "TestFlight hochladen: Xcode")[0]

        self.assertEqual(command[:3], ["open", "-a", "Xcode"])
        self.assertEqual(command[3], str(archive))

    def test_ota_uses_the_target_channel_environment_and_description(self) -> None:
        command = commands_for(
            "iOS TestFlight", "OTA-Update veröffentlichen", message="Fix Einkaufsliste"
        )[0]
        self.assertEqual(
            command,
            ["env", "FAM_UPDATE_CHANNEL=preview-testflight", "bunx", "eas-cli", "update",
             "--channel", "preview-testflight", "--platform", "ios", "--message", "Fix Einkaufsliste",
             "--environment", "preview"],
        )

    def test_ota_requires_a_description(self) -> None:
        with self.assertRaisesRegex(ValueError, "Beschreibung"):
            commands_for("iOS TestFlight", "OTA-Update veröffentlichen")

    def test_preparing_a_testflight_build_keeps_prior_archives_and_cache(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            local_ios = root / "local" / "ios"
            cache = root / "cache" / "ios"
            old_archive = local_ios / "old" / "fam.xcarchive"
            old_archive.mkdir(parents=True)
            old_archive_file = old_archive / "keep.txt"
            old_archive_file.write_text("keep")
            with patch("build_gui.LOCAL_IOS", local_ios), patch("build_gui.IOS_CACHE", cache):
                build_dir = prepare_action("Lokal bauen: TestFlight-Archiv")

        self.assertIsNotNone(build_dir)
        self.assertTrue(old_archive_file.exists())
        self.assertTrue((cache / "DerivedData").is_dir())

    def test_ota_metadata_matches_every_eas_profile_channel(self) -> None:
        profiles = json.loads((PROJECT_ROOT / "eas.json").read_text())["build"]
        for target in TARGETS.values():
            with self.subTest(channel=target.channel):
                profile = profiles[target.profile]
                self.assertEqual(target.channel, profile["channel"])
                self.assertEqual(target.environment, profile["environment"])

    def test_actions_are_rejected_for_unsupported_targets(self) -> None:
        with self.assertRaises(ValueError):
            commands_for("Android Production", "Lokal bauen: Simulator")

    def test_upload_requires_a_successful_local_build(self) -> None:
        with patch("build_gui.LATEST_BUILD", Path("/missing/local-build.json")):
            with self.assertRaisesRegex(ValueError, "Noch kein lokaler"):
                latest_local_build_path("ipa")


if __name__ == "__main__":
    unittest.main()
