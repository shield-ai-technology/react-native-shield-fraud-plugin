const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  FILES,
  SPM_URL,
  assertSpmTagExists,
  bumpLevel,
  bumpVersion,
  compareVersions,
  readIosSdkVersions,
  setIosSdkVersion,
} = require('../set-ios-sdk-version');

// Tag lookups are stubbed so tests never touch the network.
const tagged = () => {};

describe('setIosSdkVersion', () => {
  let dir;
  let files;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shield-ios-sdk-'));
    files = {
      rubyHelper: path.join(dir, 'shield_spm.rb'),
      packageSwift: path.join(dir, 'Package.swift'),
      config: path.join(dir, 'shield-config.json'),
      packageJsons: FILES.packageJsons.map((file) =>
        path.join(dir, path.basename(file))
      ),
    };
    fs.copyFileSync(FILES.rubyHelper, files.rubyHelper);
    fs.copyFileSync(FILES.packageSwift, files.packageSwift);
    fs.copyFileSync(FILES.config, files.config);
    FILES.packageJsons.forEach((file, i) =>
      fs.copyFileSync(file, files.packageJsons[i])
    );
  });

  // Puts the SDK pin and every plugin package at known versions.
  const startAt = (sdk, plugin) => {
    setIosSdkVersion(sdk, { files, log: () => {}, checkTag: false });
    for (const file of files.packageJsons) {
      const content = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(
        file,
        content.replace(/("version":\s*")[^"]+(")/, `$1${plugin}$2`)
      );
    }
  };
  const pluginVersions = () =>
    files.packageJsons.map(
      (file) => JSON.parse(fs.readFileSync(file, 'utf8')).version
    );

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('updates the podspec helper, Package.swift and shield-config.json together', () => {
    const before = fs.readFileSync(files.packageSwift, 'utf8');
    setIosSdkVersion('2.3.0', { files, log: () => {}, assertTag: tagged });

    expect(readIosSdkVersions(files)).toEqual({
      rubyHelper: '2.3.0',
      packageSwift: '2.3.0',
      config: '2.3.0',
    });
    // Only the shieldfraud-spm requirement changes in Package.swift.
    const changed = fs
      .readFileSync(files.packageSwift, 'utf8')
      .split('\n')
      .filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual(['            exact: "2.3.0"']);
    expect(
      JSON.parse(fs.readFileSync(files.config, 'utf8')).platform
    ).toBeDefined();
  });

  test('rejects versions that are not X.Y.Z', () => {
    expect(() =>
      setIosSdkVersion('2.3', { files, log: () => {}, assertTag: tagged })
    ).toThrow('X.Y.Z');
    expect(() =>
      setIosSdkVersion(undefined, { files, log: () => {}, assertTag: tagged })
    ).toThrow('X.Y.Z');
  });

  test('writes nothing when a file no longer contains the version pin', () => {
    fs.writeFileSync(files.packageSwift, '// no dependency here\n');
    const ruby = fs.readFileSync(files.rubyHelper, 'utf8');
    expect(() =>
      setIosSdkVersion('2.3.0', { files, log: () => {}, assertTag: tagged })
    ).toThrow('Package.swift');
    expect(fs.readFileSync(files.rubyHelper, 'utf8')).toBe(ruby);
  });

  test('writes nothing when the version is not tagged in shieldfraud-spm', () => {
    const before = readIosSdkVersions(files);
    const untagged = () => {
      throw new Error('ShieldFraud 9.9.9 is not tagged');
    };
    expect(() =>
      setIosSdkVersion('9.9.9', { files, log: () => {}, assertTag: untagged })
    ).toThrow('not tagged');
    expect(readIosSdkVersions(files)).toEqual(before);
  });

  test('can skip the tag check explicitly', () => {
    const neverCalled = jest.fn();
    setIosSdkVersion('2.3.0', {
      files,
      log: () => {},
      checkTag: false,
      assertTag: neverCalled,
    });
    expect(neverCalled).not.toHaveBeenCalled();
    expect(readIosSdkVersions(files).rubyHelper).toBe('2.3.0');
  });

  test('bumps the fraud and full plugin minor version for a minor SDK release', () => {
    startAt('2.2.0', '2.6.0');
    const result = setIosSdkVersion('2.3.0', {
      files,
      log: () => {},
      assertTag: tagged,
    });
    expect(result.level).toBe('minor');
    expect(pluginVersions()).toEqual(['2.7.0', '2.7.0', '2.7.0']);
  });

  test('bumps only the plugin patch for a patch SDK release', () => {
    startAt('2.3.0', '2.7.0');
    setIosSdkVersion('2.3.1', { files, log: () => {}, assertTag: tagged });
    expect(pluginVersions()).toEqual(['2.7.1', '2.7.1', '2.7.1']);
  });

  test('does not bump the plugin again when the SDK version is unchanged', () => {
    startAt('2.3.0', '2.7.0');
    setIosSdkVersion('2.3.0', { files, log: () => {}, assertTag: tagged });
    setIosSdkVersion('2.3.0', { files, log: () => {}, assertTag: tagged });
    expect(pluginVersions()).toEqual(['2.7.0', '2.7.0', '2.7.0']);
  });

  test('changes only the version line of each package file', () => {
    startAt('2.2.0', '2.6.0');
    const before = files.packageJsons.map((f) => fs.readFileSync(f, 'utf8'));
    setIosSdkVersion('2.3.0', { files, log: () => {}, assertTag: tagged });
    files.packageJsons.forEach((file, i) => {
      expect(fs.readFileSync(file, 'utf8')).toBe(
        before[i].replace('"version": "2.6.0"', '"version": "2.7.0"')
      );
    });
  });

  test('leaves the alpha package out of the bump', () => {
    expect(FILES.packageJsons.map((f) => path.basename(f))).toEqual([
      'package.json',
      'package.fraud.json',
      'package.full.json',
    ]);
  });

  test('does not bump package.json when it holds the alpha manifest', () => {
    startAt('2.2.0', '2.6.0');
    const activePackage = files.packageJsons[0];
    fs.copyFileSync(
      path.join(__dirname, '..', '..', 'package.alpha.json'),
      activePackage
    );
    const alpha = fs.readFileSync(activePackage, 'utf8');
    const log = jest.fn();

    const result = setIosSdkVersion('2.3.0', { files, log, assertTag: tagged });

    expect(fs.readFileSync(activePackage, 'utf8')).toBe(alpha);
    expect(log).toHaveBeenCalledWith(
      '  • package.json is react-native-shield-alpha-plugin; not bumped'
    );
    expect(pluginVersions().slice(1)).toEqual(['2.7.0', '2.7.0']);
    expect(result.pluginVersions).toEqual(['2.7.0', '2.7.0']);
  });

  test('refuses an SDK downgrade and writes nothing', () => {
    startAt('2.3.0', '2.7.0');
    const before = readIosSdkVersions(files);
    const assertTag = jest.fn();
    expect(() =>
      setIosSdkVersion('2.2.1', { files, log: () => {}, assertTag })
    ).toThrow('--allow-downgrade');
    expect(assertTag).not.toHaveBeenCalled();
    expect(readIosSdkVersions(files)).toEqual(before);
    expect(pluginVersions()).toEqual(['2.7.0', '2.7.0', '2.7.0']);
  });

  test('downgrades the SDK when --allow-downgrade is passed', () => {
    startAt('2.3.0', '2.7.0');
    setIosSdkVersion('2.2.1', {
      files,
      log: () => {},
      assertTag: tagged,
      allowDowngrade: true,
    });
    expect(readIosSdkVersions(files).rubyHelper).toBe('2.2.1');
  });
});

describe('bumpLevel / bumpVersion', () => {
  test('follows the highest SDK version part that changed', () => {
    expect(bumpLevel('2.2.0', '3.0.0')).toBe('major');
    expect(bumpLevel('2.2.0', '2.3.0')).toBe('minor');
    expect(bumpLevel('2.3.0', '2.3.1')).toBe('patch');
    expect(bumpVersion('2.6.4', 'major')).toBe('3.0.0');
    expect(bumpVersion('2.6.4', 'minor')).toBe('2.7.0');
    expect(bumpVersion('2.6.4', 'patch')).toBe('2.6.5');
  });

  test('compares versions numerically', () => {
    expect(compareVersions('2.2.1', '2.3.0')).toBeLessThan(0);
    expect(compareVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.3.0', '2.3.0')).toBe(0);
  });
});

describe('assertSpmTagExists', () => {
  test('asks git for exactly that tag in shieldfraud-spm', () => {
    const run = jest.fn(() => 'abc123\trefs/tags/2.2.0\n');
    assertSpmTagExists('2.2.0', { run });
    expect(run.mock.calls[0][0]).toBe('git');
    expect(run.mock.calls[0][1]).toEqual([
      'ls-remote',
      '--tags',
      SPM_URL,
      'refs/tags/2.2.0',
    ]);
  });

  test('fails when the tag does not exist', () => {
    expect(() => assertSpmTagExists('9.9.9', { run: () => '' })).toThrow(
      'ShieldFraud 9.9.9 is not tagged'
    );
  });

  test('fails with a clear message when GitHub cannot be reached', () => {
    const run = () => {
      throw new Error('Could not resolve host: github.com');
    };
    expect(() => assertSpmTagExists('2.3.0', { run })).toThrow(
      '--skip-tag-check'
    );
  });

  test('checks the same repository the podspecs and Package.swift use', () => {
    expect(fs.readFileSync(FILES.rubyHelper, 'utf8')).toContain(`'${SPM_URL}'`);
    expect(fs.readFileSync(FILES.packageSwift, 'utf8')).toContain(
      `"${SPM_URL}"`
    );
  });
});
