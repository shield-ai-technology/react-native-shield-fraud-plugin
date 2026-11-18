#!/usr/bin/env node
/**
 * Set the native ShieldFraud iOS SDK version that the fraud and full plugins
 * resolve through Swift Package Manager (iOS SDK 2.3.0+ ships via SPM only).
 *
 *   node scripts/set-ios-sdk-version.js 2.3.0
 *
 * Updates every place the version is pinned, so they cannot drift:
 *   - ios/shield_spm.rb   SHIELD_IOS_SDK_VERSION (read by both podspecs)
 *   - Package.swift       shieldfraud-spm `exact:` requirement (SwiftPM preview)
 *   - shield-config.json  iosVersion (used by scripts/update-and-run.js)
 *
 * When the SDK version changes, the fraud and full plugin versions are bumped
 * by the same level (SDK 2.2.0 → 2.3.0 bumps the plugin 2.6.0 → 2.7.0; a patch
 * SDK release bumps the plugin patch). Re-running with the same SDK version
 * bumps nothing. The alpha plugin is versioned separately and is not touched.
 *
 * The version must already be tagged in shieldfraud-spm; otherwise nothing is
 * written. Pass --skip-tag-check to bypass this (e.g. offline).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const SPM_URL = 'https://github.com/shield-ai-technology/shieldfraud-spm.git';

// Throws unless `version` is an existing tag in the shieldfraud-spm repository.
const assertSpmTagExists = (version, { run = execFileSync } = {}) => {
  let output;
  try {
    output = run(
      'git',
      ['ls-remote', '--tags', SPM_URL, `refs/tags/${version}`],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      }
    );
  } catch (error) {
    throw new Error(
      `Could not check tags in ${SPM_URL} (${error.message.trim()}). ` +
        'Check network/GitHub access, or pass --skip-tag-check.'
    );
  }
  if (!String(output).trim()) {
    throw new Error(
      `ShieldFraud ${version} is not tagged in ${SPM_URL}. ` +
        'Publish the SPM release first, or check the version number.'
    );
  }
};

const FILES = {
  rubyHelper: path.join(ROOT, 'ios', 'shield_spm.rb'),
  packageSwift: path.join(ROOT, 'Package.swift'),
  config: path.join(ROOT, 'shield-config.json'),
  packageJsons: ['package.json', 'package.fraud.json', 'package.full.json'].map(
    (name) => path.join(ROOT, name)
  ),
};

const PACKAGE_VERSION = /^(\s*"version":\s*")([^"]+)(")/m;

// Only these plugins use the SPM SDK. package.json is a copy of whichever
// variant is active, so it can hold the alpha manifest, which must not be bumped.
const SPM_PLUGIN_NAMES = [
  'react-native-shield-fraud-plugin',
  'react-native-shield-full-plugin',
];

// 'major' | 'minor' | 'patch': the highest semver part that differs.
const bumpLevel = (from, to) => {
  const [a, b] = [from, to].map((v) => v.split('.').map(Number));
  if (a[0] !== b[0]) return 'major';
  if (a[1] !== b[1]) return 'minor';
  return 'patch';
};

const bumpVersion = (version, level) => {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const RUBY_VERSION = /(SHIELD_IOS_SDK_VERSION\s*=\s*')([^']+)(')/;
const SWIFT_VERSION =
  /(url:\s*"https:\/\/github\.com\/shield-ai-technology\/shieldfraud-spm\.git",\s*exact:\s*")([^"]+)(")/;

const replaceOnce = (content, pattern, version, label) => {
  if (!pattern.test(content)) {
    throw new Error(
      `Could not find the ShieldFraud iOS SDK version in ${label}.`
    );
  }
  return content.replace(pattern, `$1${version}$3`);
};

const readIosSdkVersions = (files = FILES) => ({
  rubyHelper: fs
    .readFileSync(files.rubyHelper, 'utf8')
    .match(RUBY_VERSION)?.[2],
  packageSwift: fs
    .readFileSync(files.packageSwift, 'utf8')
    .match(SWIFT_VERSION)?.[2],
  config: JSON.parse(fs.readFileSync(files.config, 'utf8')).iosVersion,
});

const setIosSdkVersion = (
  version,
  {
    files = FILES,
    log = console.log,
    checkTag = true,
    assertTag = assertSpmTagExists,
  } = {}
) => {
  if (!VERSION_PATTERN.test(version || '')) {
    throw new Error(
      `iOS SDK version must be in X.Y.Z format (got: ${version}).`
    );
  }
  if (checkTag) {
    assertTag(version);
    log(`  ✓ ${version} is tagged in shieldfraud-spm`);
  }

  // Validate every file before writing any, so a failure leaves nothing half-updated.
  const ruby = replaceOnce(
    fs.readFileSync(files.rubyHelper, 'utf8'),
    RUBY_VERSION,
    version,
    'ios/shield_spm.rb'
  );
  const swift = replaceOnce(
    fs.readFileSync(files.packageSwift, 'utf8'),
    SWIFT_VERSION,
    version,
    'Package.swift'
  );
  const config = JSON.parse(fs.readFileSync(files.config, 'utf8'));
  config.iosVersion = version;

  const previous = fs
    .readFileSync(files.rubyHelper, 'utf8')
    .match(RUBY_VERSION)[2];
  const level = previous === version ? null : bumpLevel(previous, version);
  const packages = level
    ? files.packageJsons.flatMap((file) => {
        const content = fs.readFileSync(file, 'utf8');
        const { name } = JSON.parse(content);
        if (!SPM_PLUGIN_NAMES.includes(name)) {
          log(`  • ${path.basename(file)} is ${name}; not bumped`);
          return [];
        }
        const current = content.match(PACKAGE_VERSION)?.[2];
        if (!VERSION_PATTERN.test(current || '')) {
          throw new Error(
            `Could not read an X.Y.Z version from ${path.basename(file)}.`
          );
        }
        const next = bumpVersion(current, level);
        return [
          {
            file,
            current,
            next,
            content: content.replace(PACKAGE_VERSION, `$1${next}$3`),
          },
        ];
      })
    : [];

  fs.writeFileSync(files.rubyHelper, ruby);
  log(`  ✓ ios/shield_spm.rb → ${version}`);
  fs.writeFileSync(files.packageSwift, swift);
  log(`  ✓ Package.swift → ${version}`);
  fs.writeFileSync(files.config, JSON.stringify(config, null, 2) + '\n');
  log(`  ✓ shield-config.json → ${version}`);

  if (!level) {
    log(`  • SDK already at ${version}; plugin version unchanged`);
  }
  for (const { file, current, next, content } of packages) {
    fs.writeFileSync(file, content);
    log(`  ✓ ${path.basename(file)} ${current} → ${next} (${level} bump)`);
  }
  return { previous, level, pluginVersions: packages.map((p) => p.next) };
};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    setIosSdkVersion(
      args.find((arg) => !arg.startsWith('--')),
      { checkTag: !args.includes('--skip-tag-check') }
    );
    console.log(
      '\nNext: cd example/ios && bundle exec pod install (refreshes Podfile.lock), then build and run the example.'
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(
      'Usage: node scripts/set-ios-sdk-version.js <X.Y.Z> [--skip-tag-check]'
    );
    process.exit(1);
  }
}

module.exports = {
  FILES,
  SPM_PLUGIN_NAMES,
  SPM_URL,
  assertSpmTagExists,
  bumpLevel,
  bumpVersion,
  readIosSdkVersions,
  setIosSdkVersion,
};
