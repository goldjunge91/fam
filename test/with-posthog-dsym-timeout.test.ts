import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("withPosthogDsymTimeout", () => {
  it("finds fam inside PBXNativeTarget when a PBXGroup named fam appears first", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "posthog-dsym-target-"));
    const pbxPath = join(projectRoot, "project.pbxproj");
    let mockPbxPath = pbxPath;
    const initialProject = `
/* Begin PBXGroup section */
\t\tGROUP /* fam */ = {
\t\t\tisa = PBXGroup;
\t\t};
/* End PBXGroup section */
/* Begin PBXNativeTarget section */
\t\tWATCH /* watch */ = {
\t\t\tbuildPhases = (
\t\t\t\tWATCH_PHASE /* Watch Phase */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tname = watch;
\t\t};
\t\tAPP /* fam */ = {
\t\t\tbuildPhases = (
\t\t\t\tPOSTHOG_PHASE /* Upload PostHog Debug Symbols */,
\t\t\t\tSOURCES_PHASE /* Sources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tname = fam;
\t\t};
/* End PBXNativeTarget section */
`;
    writeFileSync(pbxPath, initialProject);

    try {
      let configWithFinalizedMod: any;
      jest.isolateModules(() => {
        jest.doMock("expo/config-plugins", () => ({
          IOSConfig: { Paths: { getPBXProjectPath: () => mockPbxPath } },
          withBaseMod: (config: any) => config,
          withFinalizedMod: (
            config: any,
            [platform, action]: [string, Function],
          ) => {
            config.finalizedMod = { platform, action };
            return config;
          },
        }));
        configWithFinalizedMod = require("../plugins/withPosthogDsymTimeout")(
          {},
        );
      });

      configWithFinalizedMod.finalizedMod.action({
        modRequest: { projectRoot },
      });

      const updatedProject = readFileSync(pbxPath, "utf8");
      const nativeTargetsStart = updatedProject.indexOf(
        "/* Begin PBXNativeTarget section */",
      );
      const famTargetStart = updatedProject.indexOf(
        "/* fam */ = {",
        nativeTargetsStart,
      );
      const famTargetEnd = updatedProject.indexOf(
        "\t\t\tbuildRules = (",
        famTargetStart,
      );
      const famTarget = updatedProject.slice(famTargetStart, famTargetEnd);
      const famPhases = famTarget
        .match(/buildPhases = \(\n([\s\S]*?)\t\t\t\);/)?.[1]
        ?.split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean);

      expect(famPhases?.at(-1)).toContain("Upload PostHog Debug Symbols");
      expect(updatedProject).toContain("WATCH_PHASE /* Watch Phase */");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      jest.dontMock("expo/config-plugins");
    }
  });
});
