const { withPodfile } = require('expo/config-plugins');

const POST_INSTALL_END = '\n  end\nend\n\nrequire File.join(';
const POST_INTEGRATE_END = '\nend\n\nrequire File.join(';
const MARKER = '# withIosSimulatorArm64: final iOS simulator target settings';
const POST_INTEGRATE_MARKER =
  '# withIosSimulatorArm64: mark the CocoaPods-added ads phase as always out of date';
const SIRI_PODS_CONFIG_MARKER =
  '# withIosSimulatorArm64: attach CocoaPods configurations to siri';
const SIRI_POST_INTEGRATE_CONFIG_MARKER =
  '# withIosSimulatorArm64: restore siri CocoaPods configurations after integration';
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

    // CURRENT_PROJECT_VERSION fuer das siri-Target. `appVersionSource` steht auf
    // `remote`, App Store Connect erhaelt also den Build von EAS; fuer lokale
    // Builde greift der Wert aus app.json.
    const buildNumber = String(config.ios?.buildNumber ?? '1');

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

      if target_name == 'siri'
        # CocoaPods can replace custom extension build configurations during integration.
        # Reattach the Pods config after integration so Xcode resolves the Podfile paths
        # and ExpoSQLite module map when building Siri independently or through fam.
        # ${SIRI_POST_INTEGRATE_CONFIG_MARKER}
        user_target.build_configurations.each do |config|
          config_file = project.files.find do |file|
            file.path.to_s.end_with?("Pods-siri.#{config.name.to_s.downcase}.xcconfig")
          end
          raise "withIosSimulatorArm64: missing CocoaPods configuration for siri #{config.name}" unless config_file

          config.base_configuration_reference = config_file
        end
      end

      unless project.reference_for_path(pods_project.path)
        project.main_group.new_file(pods_project.path, :group)
      end
      user_target.add_dependency(pod_target)
    end

    # withIosSimulatorArm64: Doppelte XCFramework-Aggregate entfernen.
    #
    # ML Kit erzwingt use_frameworks! :linkage => :static (expo-mlkit-ocr liefert
    # ein XCFramework). Zusammen mit den vorkompilierten Expo-Modulen erzeugt
    # CocoaPods dann fuer jedes dieser Pods ZWEI Aggregate-Targets: einmal als
    # 'X-framework' und einmal als 'X-library'. Beide haben eine
    # '[CP] Copy XCFrameworks'-Phase und schreiben in dasselbe Verzeichnis
    # unter XCFrameworkIntermediates. Der iphoneos-Build bricht darauf ab:
    #
    #   error: Multiple commands produce '.../ExpoModulesCore/ExpoModulesCore.framework'
    #     note: ... in Target 'ExpoModulesCore-framework' ... [CP] Copy XCFrameworks
    #     note: ... in Target 'ExpoModulesCore-library'   ... [CP] Copy XCFrameworks
    #
    # Betroffen sind nur die vorkompilierten Module, nicht die uebrigen Pods:
    # ExpoModulesCore, ExpoModulesJSI, hermes-engine, React-Core-prebuilt und
    # ReactNativeDependencies. Von jedem Paar bleibt die -framework-Variante,
    # weil nur sie im Aggregate-Target der App referenziert ist; die
    # -library-Variante haengt als Relikt im Pod-Projekt.
    duplicated_xcframeworks = %w[ExpoModulesCore ExpoModulesJSI hermes-engine React-Core-prebuilt ReactNativeDependencies]
    duplicated_xcframeworks.each do |pod|
      framework_target = installer.pods_project.targets.find { |t| t.name == "#{pod}-framework" }
      library_target = installer.pods_project.targets.find { |t| t.name == "#{pod}-library" }
      next unless framework_target && library_target

      # Beide Aggregate-Targets bleiben erhalten: ExpoSQLite-library etwa
      # braucht ExpoModulesCore-library als Swift-Modul, sonst bricht die
      # Kompilierung mit "no such module 'ExpoModulesCore'" ab. Entfernt wird
      # nur die [CP] Copy XCFrameworks-Phase aus der framework-Variante, weil
      # der Aggregate-Target der App genau diese referenziert und die
      # library-Variante das Framework an dieselbe Stelle kopieren wuerde.
      #
      # Welche Variante kopiert, ist belanglos: das Framework entsteht beim
      # Prebuild in XCFrameworkIntermediates und wird von der verbleibenden
      # Kopierphase installiert.
      framework_target.build_phases.each do |phase|
        next unless phase.respond_to?(:name) && phase.name.to_s.include?('Copy XCFrameworks')
        framework_target.build_phases.delete(phase)
        phase.remove_from_project
      end
      puts "withIosSimulatorArm64: doppelte XCFramework-Kopierphase entfernt: #{pod}-framework"
    end

    # withIosSimulatorArm64: enable code signing for the app and embedded targets,
    # and align the extension build numbers with the app's.
    app_target = project.native_targets.find { |native_target| native_target.name == 'fam' }
    app_build_version = nil
    if app_target && app_target.build_configurations.first
      app_build_version = app_target.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION']
    end
    app_build_version = '${buildNumber}' if app_build_version.to_s.strip.empty?

    project.native_targets.each do |native_target|
      next unless [${rubyCodeSigningTargets}].include?(native_target.name)

      native_target.build_configurations.each do |config|
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'YES'
        # Das watch-Target traegt zwar SDKROOT = watchos, wird aber ueber 'Embed
        # Watch Content' mit dem App-SDK gebaut. Xcode reicht dann -sdk iphoneos
        # durch und actool laeuft mit --platform iphoneos / --target-device iphone
        # gegen ein watchos-AppIcon:
        #
        #   error: The stickers icon set, app icon set, or icon stack named
        #          "AppIcon" did not have any applicable content.
        #
        # SUPPORTED_PLATFORMS auf watchos zu setzen laesst Xcode beim
        # Abhaengigkeitsaufbau das WatchOS-SDK fuer diesen Target waehlen.
        if native_target.name == 'watch'
          # Beide Watch-Plattformen zulassen: Xcode mappt den iOS-Geraete-Build
          # auf watchos und den iOS-Simulator-Build auf watchsimulator. Nur
          # 'watchos' zu erzwingen liess den Simulator-Build ein
          # watchos-Geraete-Produkt einbetten, was ValidateEmbeddedBinary
          # zurueckweist ("built for iOS Simulator but contains embedded
          # content built for watchOS"). SDKROOT bleibt als Geraete-Default
          # bestehen und wird pro Destination ueberschrieben.
          config.build_settings['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
          config.build_settings['SDKROOT'] = 'watchos'
        end
        # Das siri-Target traegt kein eigenes CURRENT_PROJECT_VERSION und erbte
        # dadurch eine eigene, von der App abweichende Nummer. TestFlight
        # ordnet die Extension sonst nicht dem Haupt-Target zu. Frueher stand das
        # in einem eigenen Xcode-Projekt-Mod (plugins/withSiriBuildNumber.js),
        # dessen Reihenfolge gegen @bacons/apple-targets nicht aufloesbar war:
        # vor dem Plugin fehlte der siri-Target, danach kollidierte der
        # Mod-Provider ("Provider must be the last mod added").
        #
        # Der Wert wird hier aus dem fam-Target gelesen und nicht aus app.json
        # uebernommen: appVersionSource steht auf "remote", deshalb setzt EAS
        # die Build-Nummer im generierten Projekt und der lokale Wert aus
        # app.json waere beim TestFlight-Build veraltet.
        if native_target.name == 'siri'
          config.build_settings['CURRENT_PROJECT_VERSION'] = app_build_version
        end
      end
    end

    project.save
  end

    # CocoaPods disambiguiert React-Core in zwei Varianten ('.common' + Hash-Suffix),
    # weil das App-Target andere Subspecs anfordert als die Expo-Module. Beide
    # Varianten erzeugen dasselbe '<Pod>_privacy.bundle' und kollidieren im
    # Archiv-Schritt ("Multiple commands produce", react/react-native#49397).
    # Je Bundle-Namen ein Target behalten, Duplikate entfernen, Bundle-Pfade in
    # den Pods-*-resources.sh auf das verbleibende Target umschreiben.
    privacy_targets = installer.pods_project.targets.select { |t| t.name.include?('_privacy') }
    privacy_by_bundle = privacy_targets.group_by do |t|
      product = t.build_configurations.map { |c| c.build_settings['PRODUCT_NAME'] }.compact.first
      product || t.name
    end
    privacy_path_rewrites = {}
    privacy_by_bundle.each_value do |variants|
      next unless variants.size > 1
      keep = variants.find { |t| t.name.include?('.common') } || variants.first
      bundle_name = keep.build_configurations.map { |c| c.build_settings['PRODUCT_NAME'] }.compact.first
      next unless bundle_name
      # Die resources.sh referenzieren das Pod-Target-Verzeichnis (ohne den
      # Bundle-Suffix), nicht den Bundle-Target-Namen.
      pod_dir_of = ->(t) { t.name[0...-(bundle_name.length + 1)] }
      (variants - [keep]).each do |variant|
        privacy_path_rewrites["\${PODS_CONFIGURATION_BUILD_DIR}/#{pod_dir_of.call(variant)}/#{bundle_name}.bundle"] =
          "\${PODS_CONFIGURATION_BUILD_DIR}/#{pod_dir_of.call(keep)}/#{bundle_name}.bundle"
        # remove_from_project setzt nur die target-Referenz von PBXTargetDependency
        # auf nil; das Objekt bleibt als Waise zurueck und bricht den Parser von
        # @expo/config-plugins (getTargetDependencies). Deshalb zuerst die
        # Dependencies und die Product-Reference explizit raeumen.
        installer.pods_project.targets.each do |t|
          t.dependencies.select { |d| d.target == variant }.each do |d|
            d.target_proxy&.remove_from_project
            d.remove_from_project
          end
        end
        variant.product_reference&.remove_from_project
        variant.remove_from_project
        puts "withIosSimulatorArm64: doppeltes Privacy-Bundle-Target entfernt: #{variant.name}"
      end
    end
    unless privacy_path_rewrites.empty?
      installer.aggregate_targets.each do |aggregate_target|
        resources_script = File.join(aggregate_target.support_files_dir, aggregate_target.label + '-resources.sh')
        next unless File.exist?(resources_script)
        content = File.read(resources_script)
        updated = content.dup
        privacy_path_rewrites.each { |old_path, new_path| updated = updated.gsub(old_path, new_path) }
        File.write(resources_script, updated) if updated != content
      end
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
