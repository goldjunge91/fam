const { withPodfile } = require('expo/config-plugins');

const POST_INSTALL_END = '\n  end\nend\n\nrequire File.join(';
const POST_INTEGRATE_END = '\nend\n\nrequire File.join(';
const MARKER = '# withIosSimulatorArm64: final iOS simulator target settings';
const POST_INTEGRATE_MARKER =
  '# withIosSimulatorArm64: mark the CocoaPods-added ads phase as always out of date';
const SIRI_PODS_CONFIG_MARKER =
  '# withIosSimulatorArm64: attach CocoaPods configurations to siri';
const POD_TARGET_DEPENDENCY_MARKER =
  '# withIosSimulatorArm64: order app targets after their CocoaPods targets';
const IOS_SIMULATOR_TARGETS = ['fam', 'siri', 'ExpoWidgetsTarget'];
const CODE_SIGNING_TARGETS = ['fam', 'siri', 'watch', 'ExpoWidgetsTarget'];
const ALWAYS_RUN_PHASES = [
  'Upload Debug Symbols to Sentry',
  'Upload PostHog Debug Symbols',
  '[Expo Dev Launcher] Strip Local Network Keys for Release',
  '[CP-User] [RNGoogleMobileAds] Configuration',
];

module.exports = function withIosSimulatorArm64(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes(MARKER) && !contents.includes(POST_INSTALL_END)) {
      throw new Error('withIosSimulatorArm64: post_install end not found in Podfile');
    }

    const rubyTargets = IOS_SIMULATOR_TARGETS.map((name) => `'${name}'`).join(', ');
    const rubyCodeSigningTargets = CODE_SIGNING_TARGETS.map((name) => `'${name}'`).join(', ');
    const rubyAlwaysRunPhases = ALWAYS_RUN_PHASES.map((name) => `'${name}'`).join(', ');
    contents = contents.replace(`# ${SIRI_PODS_CONFIG_MARKER}`, SIRI_PODS_CONFIG_MARKER);

    if (!contents.includes(MARKER)) {
      contents = contents.replace(
        POST_INSTALL_END,
        `

  ${MARKER}
  installer.aggregate_targets.each do |aggregate_target|
    project = aggregate_target.user_project
    project.native_targets.each do |target|
      next unless [${rubyTargets}].include?(target.name)

      target.build_configurations.each do |config|
        config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = '$(inherited) x86_64'
        config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO' if target.name == 'siri'
        # ${SIRI_PODS_CONFIG_MARKER}
        if target.name == 'siri'
          config_file = project.files.find do |file|
            file.path.to_s.end_with?("Pods-siri.#{config.name.to_s.downcase}.xcconfig")
          end
          config.base_configuration_reference = config_file if config_file
        end
        config.build_settings.delete('ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES') if target.name == 'fam'
        if target.name == 'siri'
          config.build_settings.delete('CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER')
          config.build_settings.delete('CLANG_CXX_LANGUAGE_STANDARD')
        end
      end

      if target.name == 'fam'
        target.shell_script_build_phases.each do |phase|
          phase.always_out_of_date = '1' if [${rubyAlwaysRunPhases}].include?(phase.name)
        end
      end
    end
    project.save
  end

  end
end

require File.join(`,
      );
    }

    const postIntegrateHook = `${POST_INTEGRATE_MARKER}
post_integrate do |installer|
  installer.aggregate_targets.each do |aggregate_target|
    project = aggregate_target.user_project
    target = project.native_targets.find { |native_target| native_target.name == 'fam' }

    if target
      target.shell_script_build_phases.each do |phase|
        phase.always_out_of_date = '1' if phase.name == '[CP-User] [RNGoogleMobileAds] Configuration'
      end
    end

    ${POD_TARGET_DEPENDENCY_MARKER}
    pods_project = installer.pods_project
    pod_target = pods_project.targets.find { |candidate| candidate.name == aggregate_target.label }
    target_name = aggregate_target.label.sub(/\\APods-/, '')
    if [${rubyTargets}].include?(target_name)
      user_target = project.native_targets.find { |candidate| candidate.name == target_name }
      raise "withIosSimulatorArm64: missing Xcode or CocoaPods target for #{aggregate_target.label}" unless user_target && pod_target

      unless project.reference_for_path(pods_project.path)
        project.main_group.new_file(pods_project.path, :group)
      end
      user_target.add_dependency(pod_target)
    end

    # withIosSimulatorArm64: enable code signing for the app and embedded targets
    project.native_targets.each do |native_target|
      next unless [${rubyCodeSigningTargets}].include?(native_target.name)

      native_target.build_configurations.each do |config|
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'YES'
      end
    end

    project.save
  end
end`;

    const postIntegrateMarkerIndex = contents.indexOf(POST_INTEGRATE_MARKER);
    if (postIntegrateMarkerIndex >= 0) {
      const postIntegrateEndIndex = contents.indexOf(POST_INTEGRATE_END, postIntegrateMarkerIndex);
      if (postIntegrateEndIndex < 0) {
        throw new Error('withIosSimulatorArm64: existing post_integrate hook end not found');
      }
      contents =
        contents.slice(0, postIntegrateMarkerIndex) +
        postIntegrateHook +
        contents.slice(postIntegrateEndIndex + '\nend'.length);
    } else {
      const widgetsRequireLine = contents
        .split('\n')
        .find((line) => line.startsWith('require File.join(') && line.includes('expo-widgets/package.json'));
      if (!widgetsRequireLine) {
        throw new Error('withIosSimulatorArm64: expo-widgets Podfile require not found');
      }
      contents = contents.replace(widgetsRequireLine, `${postIntegrateHook}\n\n${widgetsRequireLine}`);
    }

    if (!contents.includes(SIRI_PODS_CONFIG_MARKER)) {
      const siriSettingsLine =
        "        config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO' if target.name == 'siri'";
      const siriConfiguration = `${siriSettingsLine}
        ${SIRI_PODS_CONFIG_MARKER}
        if target.name == 'siri'
          config_file = project.files.find do |file|
            file.path.to_s.end_with?("Pods-siri.#{config.name.to_s.downcase}.xcconfig")
          end
          config.base_configuration_reference = config_file if config_file
        end`;
      if (!contents.includes(siriSettingsLine)) {
        throw new Error('withIosSimulatorArm64: siri build settings line not found');
      }
      contents = contents.replace(siriSettingsLine, siriConfiguration);
    }

    config.modResults.contents = contents;
    return config;
  });
};
