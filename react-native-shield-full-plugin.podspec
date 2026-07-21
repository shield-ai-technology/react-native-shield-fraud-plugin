require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = package["name"]
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "12.0" }
  s.source       = { :git => "https://github.com/shield-ai-technology/react-native-shield-fraud-plugin.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"

  # install_modules_dependencies handles New Architecture (Turbo Modules / Fabric)
  # and replaces the legacy `s.dependency "React"` call.
  install_modules_dependencies(s)

  s.dependency "ShieldFraud", ">= 2.0.0"
end
