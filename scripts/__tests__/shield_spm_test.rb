require 'minitest/autorun'
require 'tmpdir'
require 'ostruct'
require 'set'
# Real CocoaPods classes, so the embed script matches what pod install writes.
require 'cocoapods'
require 'cocoapods/xcode'
require 'cocoapods/generator/embed_frameworks_script'

class FakeConfig
  attr_reader :attributes, :other_linker_flags, :saved_to

  def initialize(attributes)
    @attributes = attributes
    @other_linker_flags = { frameworks: Set.new(['hermes']) }
  end

  def save_as(path)
    @saved_to = path
  end
end

class ShieldSPMTest < Minitest::Test
  SHIELD_INSTALL = 'install_framework "${PODS_CONFIGURATION_BUILD_DIR}/ShieldFraud.framework"'.freeze

  def setup
    @directory = Dir.mktmpdir('shield-spm-test')
    @script_path = Pathname(File.join(@directory, 'frameworks.sh'))
    @xcconfigs = { 'Release' => FakeConfig.new({}) }
    @hermes = Pod::Xcode::FrameworkPaths.new('${PODS_ROOT}/hermes-engine/hermes.framework')
    @framework_paths = { 'Debug' => [@hermes], 'Release' => [@hermes] }
    Pod::Generator::EmbedFrameworksScript.new(@framework_paths, {}).save_as(@script_path)
    @script = File.read(@script_path)
    require_relative '../../ios/shield_spm'
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  def installer_for(name)
    pod_target = OpenStruct.new(name: name, shell_script_build_phases: [])
    pod_target.define_singleton_method(:new_shell_script_build_phase) do |phase_name|
      phase = OpenStruct.new(name: phase_name)
      shell_script_build_phases << phase
      phase
    end
    directory = @directory
    target = OpenStruct.new(
      pod_targets: [OpenStruct.new(name: name)],
      embed_frameworks_script_path: @script_path,
      xcconfigs: @xcconfigs,
      framework_paths_by_config: @framework_paths,
      xcframeworks_by_config: { 'Debug' => [], 'Release' => [] }
    )
    target.define_singleton_method(:xcconfig_path) { |config| File.join(directory, "#{config}.xcconfig") }
    OpenStruct.new(aggregate_targets: [target], pods_project: OpenStruct.new(targets: [pod_target]))
  end

  def test_declares_the_pinned_spm_dependency_on_the_podspec
    calls = []
    define_singleton_method(:spm_dependency) { |spec, **options| calls << [spec, options] }
    define_singleton_method(:shield_spm_register_auto_post_install) { calls << :hook }
    shield_spm_dependency(:spec)
    assert_equal [
      [:spec, {
        url: 'https://github.com/shield-ai-technology/shieldfraud-spm.git',
        requirement: { kind: 'exactVersion', version: SHIELD_IOS_SDK_VERSION },
        products: ['ShieldFraud']
      }],
      :hook
    ], calls
    assert_match(/\A\d+\.\d+\.\d+\z/, SHIELD_IOS_SDK_VERSION)
  end

  def test_requires_react_native_spm_support
    error = assert_raises(RuntimeError) { shield_spm_dependency(:spec) }
    assert_includes error.message, 'React Native 0.75'
  end

  def test_embeds_native_spm_framework_for_fraud_and_full_in_every_configuration
    %w[react-native-shield-fraud-plugin react-native-shield-full-plugin].each do |name|
      @framework_paths.each_value { |paths| paths.replace([@hermes]) }
      shield_spm_post_install(installer_for(name))
      script = File.read(@script_path)
      assert_equal 2, script.scan(SHIELD_INSTALL).length
      assert_equal 2, script.scan('hermes.framework').length
      assert_operator script.index('ShieldFraud SPM framework is missing'), :<, script.index('if [[ "$CONFIGURATION" ==')
    end
  end

  def test_generates_the_embed_script_when_no_other_pod_ships_a_framework
    @framework_paths.each_value(&:clear)
    File.delete(@script_path)
    shield_spm_post_install(installer_for('react-native-shield-fraud-plugin'))
    script = File.read(@script_path)
    assert_equal 2, script.scan(SHIELD_INSTALL).length
    assert_includes script, 'install_framework()'
    @framework_paths.each_value do |paths|
      assert_equal ['${PODS_CONFIGURATION_BUILD_DIR}/ShieldFraud.framework'], paths.map(&:source_path)
    end
  end

  def test_repeated_installation_does_not_duplicate_embedding
    installer = installer_for('react-native-shield-fraud-plugin')
    shield_spm_post_install(installer)
    first = File.read(@script_path)
    shield_spm_post_install(installer)
    assert_equal first, File.read(@script_path)
    assert_equal 1, first.scan('# SHIELD SPM embedding').length
    @framework_paths.each_value { |paths| assert_equal 2, paths.length }
  end

  def test_removes_only_the_duplicate_shield_archive_signature_once
    installer = installer_for('react-native-shield-fraud-plugin')
    2.times { shield_spm_post_install(installer) }
    phases = installer.pods_project.targets.first.shell_script_build_phases
    assert_equal 1, phases.length
    assert_equal 'rm -f "${CONFIGURATION_BUILD_DIR}/ShieldFraud.xcframework-"*.signature', phases.first.shell_script
    assert_equal '1', phases.first.always_out_of_date
  end

  def test_does_not_modify_alpha_or_unrelated_targets
    %w[react-native-shield-alpha-plugin unrelated].each do |name|
      shield_spm_post_install(installer_for(name))
      assert_equal @script, File.read(@script_path)
      @framework_paths.each_value { |paths| assert_equal [@hermes], paths }
      assert_equal Set['hermes'], @xcconfigs['Release'].other_linker_flags[:frameworks]
    end
  end

  def test_defers_to_react_native_when_it_already_embeds_shield
    File.write(@script_path, @script + "install_spm_framework \"ShieldFraud\"\n")
    first = File.read(@script_path)
    shield_spm_post_install(installer_for('react-native-shield-fraud-plugin'))
    assert_equal first, File.read(@script_path)
    @framework_paths.each_value { |paths| assert_equal [@hermes], paths }
  end

  def test_fails_clearly_when_cocoapods_writes_no_configuration_blocks
    @framework_paths.clear
    error = assert_raises(RuntimeError) do
      shield_spm_post_install(installer_for('react-native-shield-fraud-plugin'))
    end
    assert_includes error.message, 'CocoaPods'
  end

  def test_links_shield_into_the_app_once_for_static_linkage
    installer = installer_for('react-native-shield-fraud-plugin')
    2.times { shield_spm_post_install(installer) }
    config = @xcconfigs['Release']
    assert_equal Set['hermes', 'ShieldFraud'], config.other_linker_flags[:frameworks]
    assert_equal '$(inherited) "${PODS_CONFIGURATION_BUILD_DIR}"', config.attributes['FRAMEWORK_SEARCH_PATHS']
    assert_equal File.join(@directory, 'Release.xcconfig'), config.saved_to
  end

  def test_runs_automatically_after_react_native_applies_spm_once
    manager = Object.new
    calls = []
    manager.define_singleton_method(:apply_on_post_install) { |_installer| calls << :react_native }
    Object.const_set(:SPM, manager)
    2.times { shield_spm_register_auto_post_install }
    installer = installer_for('react-native-shield-fraud-plugin')
    SPM.apply_on_post_install(installer)
    assert_equal [:react_native], calls
    assert_includes File.read(@script_path), SHIELD_INSTALL
    assert_equal 1, SPM.singleton_class.ancestors.count(ShieldSPMAutoPostInstall)
  ensure
    Object.send(:remove_const, :SPM) if defined?(SPM)
  end

  def test_auto_registration_is_a_no_op_without_react_native_spm
    assert_nil shield_spm_register_auto_post_install
  end
end
