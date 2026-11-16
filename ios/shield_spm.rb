# React Native's spm_dependency attaches SPM products only to the plugin's pod
# target. With static libraries or static frameworks (RN's default) nothing then
# links ShieldFraud into the app, and on RN 0.75+ no linkage embeds the binary
# framework. This hook links and embeds it for every linkage. The podspec runs
# it automatically after React Native applies SPM dependencies; calling it from
# the Podfile after react_native_post_install is optional and idempotent.
# Newer RN versions that embed ShieldFraud themselves are left alone.
# CocoaPods-free apps use Package.swift and do not need this.
SHIELD_SPM_PLUGIN_NAMES = %w[react-native-shield-fraud-plugin react-native-shield-full-plugin].freeze

# Native ShieldFraud iOS SDK version, resolved from SPM only (no CocoaPod from
# 2.3.0 onwards). Single source of truth for both podspecs. Change it with
# `node scripts/set-ios-sdk-version.js <version>`, which also updates
# Package.swift and shield-config.json so all three stay in sync.
SHIELD_IOS_SDK_VERSION = '2.2.0'.freeze
SHIELD_SPM_URL = 'https://github.com/shield-ai-technology/shieldfraud-spm.git'.freeze

# Declares the ShieldFraud SPM dependency on a plugin podspec and installs the
# post_install hook that links and embeds it in the app.
def shield_spm_dependency(spec)
  unless respond_to?(:spm_dependency, true)
    raise 'SHIELD SPM integration requires React Native 0.75 or newer. Upgrade React Native or use the previous plugin release.'
  end

  spm_dependency(spec,
    url: SHIELD_SPM_URL,
    requirement: { kind: 'exactVersion', version: SHIELD_IOS_SDK_VERSION },
    products: ['ShieldFraud']
  )
  shield_spm_register_auto_post_install
end

def shield_spm_post_install(installer)
  plugin_names = SHIELD_SPM_PLUGIN_NAMES
  framework_path = '${PODS_CONFIGURATION_BUILD_DIR}/ShieldFraud.framework'
  anchor = /^if \[\[ "\$CONFIGURATION" == /

  installer.aggregate_targets.each do |aggregate|
    next if (aggregate.pod_targets.map(&:name) & plugin_names).empty?

    # Link the SPM framework into the app. Xcode places the resolved binary
    # framework in the shared products directory for every linkage. Mutate the
    # in-memory configs so React Native's later xcconfig saves keep the change.
    aggregate.xcconfigs.each do |config_name, config|
      search_paths = config.attributes['FRAMEWORK_SEARCH_PATHS'] || '$(inherited)'
      unless search_paths.include?('"${PODS_CONFIGURATION_BUILD_DIR}"')
        config.attributes['FRAMEWORK_SEARCH_PATHS'] = "#{search_paths} \"${PODS_CONFIGURATION_BUILD_DIR}\""
      end
      # Xcodeproj keeps OTHER_LDFLAGS outside attributes; frameworks is a Set.
      config.other_linker_flags[:frameworks] << 'ShieldFraud'
      config.save_as(aggregate.xcconfig_path(config_name))
    end

    script_path = aggregate.embed_frameworks_script_path
    next if File.exist?(script_path) && File.read(script_path).include?('install_spm_framework "ShieldFraud"')

    # Register the framework with CocoaPods so user-project integration (which
    # runs after post_install) adds the embed phase even when no other pod ships
    # a framework, e.g. JSC apps with static libraries, and lists ShieldFraud in
    # the phase's input/output files for incremental builds.
    aggregate.framework_paths_by_config.each_value do |paths|
      next if paths.any? { |path| path.source_path == framework_path }

      paths << Pod::Xcode::FrameworkPaths.new(framework_path)
    end

    # CocoaPods writes the embed script only when some pod ships a framework, so
    # regenerate it with CocoaPods' own generator now that ShieldFraud is listed.
    Pod::Generator::EmbedFrameworksScript.new(
      aggregate.framework_paths_by_config,
      aggregate.xcframeworks_by_config
    ).save_as(Pathname(script_path))

    script = File.read(script_path)
    unless script.match?(anchor)
      raise 'SHIELD could not update the CocoaPods framework embed script. Check the installed CocoaPods version.'
    end

    check = <<~'SH'
      # SHIELD SPM embedding
      if [ ! -d "${PODS_CONFIGURATION_BUILD_DIR}/ShieldFraud.framework" ]; then
        echo "error: ShieldFraud SPM framework is missing. Resolve Swift packages and rebuild."
        exit 1
      fi
    SH
    File.write(script_path, script.sub(anchor) { "#{check}#{$&}" })
  end

  # Xcode 26 collects both the shared and pod-local copy of an SPM binary's
  # signature when archiving. Keep the shared copy and remove only SHIELD's
  # redundant pod-local metadata, as newer React Native SPM helpers do.
  phase_name = '[SHIELD] Remove duplicate SPM signature'
  installer.pods_project.targets.each do |target|
    next unless plugin_names.include?(target.name)
    next if target.shell_script_build_phases.any? do |phase|
      [phase_name, '[RN] Remove duplicate Swift package xcframework signatures'].include?(phase.name)
    end

    phase = target.new_shell_script_build_phase(phase_name)
    phase.shell_script = 'rm -f "${CONFIGURATION_BUILD_DIR}/ShieldFraud.xcframework-"*.signature'
    phase.always_out_of_date = '1'
  end
end

# Runs shield_spm_post_install right after React Native applies SPM
# dependencies inside react_native_post_install, so apps need no Podfile change.
module ShieldSPMAutoPostInstall
  def apply_on_post_install(installer)
    super
    shield_spm_post_install(installer)
  end
end

def shield_spm_register_auto_post_install
  return unless defined?(SPM)
  return if SPM.singleton_class.include?(ShieldSPMAutoPostInstall)

  SPM.singleton_class.prepend(ShieldSPMAutoPostInstall)
end
