Pod::Spec.new do |s|
  s.name = 'FamWatchConnectivity'
  s.version = '1.0.0'
  s.summary = 'WatchConnectivity bridge for the fam Apple Watch app'
  s.description = 'Transfers the latest shopping list snapshot to the paired Apple Watch.'
  s.license = { :type => 'Proprietary' }
  s.author = 'fam'
  s.homepage = 'https://github.com/goldjunge91/fam'
  s.source = { :git => 'https://github.com/goldjunge91/fam.git', :branch => 'main' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
