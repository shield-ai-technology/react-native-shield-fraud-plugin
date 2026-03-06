require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-shield-fraud-plugin"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/rajdeepak27/react-native-shield-fraud-plugin.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"

  # Enable Clang modules in C++ mode so that @import ShieldFraud; works
  s.pod_target_xcconfig = {
    'CLANG_ENABLE_MODULES'  => 'YES',
    'OTHER_CPLUSPLUSFLAGS'  => '$(inherited) -fmodules -fcxx-modules'
  }

  # install_modules_dependencies handles New Architecture (Turbo Modules / Fabric)
  # and replaces the legacy `s.dependency "React"` call.
  install_modules_dependencies(s)

  s.dependency "ShieldFraud", ">= 1.5.46"
end
