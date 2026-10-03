pod 'ExpoSQLite', :path => '../node_modules/expo-sqlite/ios'

# Gleiche Integration wie das App-Target: ohne use_frameworks! zieht siri die
# Pods als plain Libraries, während fam statische Frameworks nutzt — CocoaPods
# bildet dann für jedes gemeinsame Pod zwei Varianten, deren identische
# Privacy-Bundles und AppIntents-Metadaten im Archiv kollidieren.
use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
