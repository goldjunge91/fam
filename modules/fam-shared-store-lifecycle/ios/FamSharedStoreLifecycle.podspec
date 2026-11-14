Pod::Spec.new do |s|
  s.name = 'FamSharedStoreLifecycle'
  s.version = '1.0.0'
  s.summary = 'Lifecycle owner for shared app-group store writers'
  s.description = 'Provides an iOS-only Expo bridge for named writer and background assertions.'
  s.license = { :type => 'Proprietary' }
  s.author = 'fam'
  s.homepage = 'https://github.com/goldjunge91/fam'
  s.source = { :git => 'https://github.com/goldjunge91/fam.git', :branch => 'main' }
  s.platform = :ios, '17.0'
  s.swift_version = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
