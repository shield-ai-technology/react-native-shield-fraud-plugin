#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'shield-config.json');
const appPath = path.join(ROOT, 'example', 'src', 'App.tsx');
const appBackupPath = path.join(ROOT, 'example', 'src', 'App.tsx.backup');
const gradlePath = path.join(ROOT, 'android', 'build.gradle');
const outputPath = path.join(ROOT, 'example', 'shield-output.json');

// Load environment variables from .env file if it exists
const loadDotenv = () => {
  const dotenvPath = path.join(ROOT, '.env');
  if (fs.existsSync(dotenvPath)) {
    const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, ''); // strip quotes
        process.env[key] = val;
      }
    }
  }
};

loadDotenv();

let logProcess = null;
let metroProcess = null;
let appRestoreNeeded = false;
let testSiteId;
let testSecretKey;

const normalizeCommandOutput = output => (output == null ? '' : String(output).trim());

const runCommand = (command, args, options = {}) =>
  normalizeCommandOutput(execFileSync(command, args, { encoding: 'utf8', ...options }));

const readMetroStatus = () =>
  new Promise(resolve => {
    const request = http.get('http://127.0.0.1:8081/status', response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    });
    request.setTimeout(1000, () => request.destroy());
    request.on('error', () => resolve(''));
  });

const isMetroRunning = async ({ probe = readMetroStatus } = {}) =>
  (await probe()).includes('packager-status:running');

const parseIosDevices = output => {
  const devices = JSON.parse(output).devices || {};
  return Object.values(devices)
    .flat()
    .filter(device => device.isAvailable !== false);
};

const ensureIosSimulator = ({ run = runCommand, log = console.log } = {}) => {
  try {
    run('xcrun', ['--find', 'simctl']);
  } catch (error) {
    throw new Error('Xcode Simulator tools are unavailable. Install Xcode and run `xcode-select --install`.');
  }

  let devices;
  try {
    devices = parseIosDevices(run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
  } catch (error) {
    throw new Error(`Unable to list iOS simulators: ${error.message}`);
  }

  const simulator = devices.find(device => device.state === 'Booted') || devices.find(device => device.state === 'Shutdown');
  if (!simulator) {
    throw new Error('No available iOS simulator found. Create one in Xcode > Settings > Platforms.');
  }

  try {
    if (simulator.state !== 'Booted') {
      log(`[Shield Script] Booting iOS simulator: ${simulator.name}...`);
      run('xcrun', ['simctl', 'boot', simulator.udid]);
      run('xcrun', ['simctl', 'bootstatus', simulator.udid, '-b']);
    }
    run('open', ['-a', 'Simulator'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error(`Unable to boot and open iOS simulator ${simulator.name}: ${error.message}`);
  }

  log(`[Shield Script] ✓ iOS simulator booted and opened: ${simulator.name}`);
  return { udid: simulator.udid, name: simulator.name };
};

const connectedAndroidEmulator = devicesOutput =>
  devicesOutput
    .split('\n')
    .map(line => line.trim().split(/\s+/))
    .find(([serial, state]) => /^emulator-\d+$/.test(serial) && state === 'device')?.[0];

const waitForAndroidBoot = ({ run = runCommand, sleep = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds) } = {}) => {
  run('adb', ['wait-for-device']);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (run('adb', ['shell', 'getprop', 'sys.boot_completed']) === '1') return;
    sleep(1000);
  }
  throw new Error('Android emulator did not finish booting within 60 seconds.');
};

const ensureAndroidEmulator = ({ run = runCommand, spawn: spawnProcess = spawn, waitForBoot = waitForAndroidBoot, log = console.log } = {}) => {
  let serial;
  try {
    serial = connectedAndroidEmulator(run('adb', ['devices']));
  } catch (error) {
    throw new Error('ADB is unavailable. Install Android SDK Platform-Tools and add `adb` to PATH.');
  }

  if (serial) {
    log(`[Shield Script] ✓ Android emulator booted and opened: ${serial}`);
    return { serial, avd: null };
  }

  let avd;
  try {
    avd = run('emulator', ['-list-avds']).split('\n').find(Boolean);
  } catch (error) {
    throw new Error('Android Emulator is unavailable. Install Android Emulator tools and add `emulator` to PATH.');
  }
  if (!avd) {
    throw new Error('No Android Virtual Device found. Create one in Android Studio > Device Manager.');
  }

  log(`[Shield Script] Booting Android emulator: ${avd}...`);
  const emulatorProcess = spawnProcess('emulator', [`@${avd}`], { detached: true, stdio: 'ignore' });
  emulatorProcess.unref();
  waitForBoot({ run });
  log(`[Shield Script] ✓ Android emulator booted and opened: ${avd}`);
  return { serial: null, avd };
};

const createRunArgs = (platformName, iosUdid) =>
  platformName === 'ios'
    ? ['react-native', 'run-ios', '--udid', iosUdid]
    : ['react-native', 'run-android'];

// Clean up / restore function
const restoreAppFile = () => {
  if (appRestoreNeeded) {
    try {
      if (fs.existsSync(appBackupPath)) {
        const backupContent = fs.readFileSync(appBackupPath, 'utf8');
        if (backupContent.includes('SHIELD_SITE_ID')) {
          fs.copyFileSync(appBackupPath, appPath);
          console.log('\n[Shield Script] ✓ Restored App.tsx from backup. Credentials removed.');
        } else {
          console.log('\n[Shield Script] Warning: Backup file was dirty. Using git checkout to restore App.tsx.');
          execSync(`git checkout -- ${appPath}`, { cwd: ROOT });
        }
        fs.unlinkSync(appBackupPath);
      } else {
        console.log('\n[Shield Script] Warning: Backup file not found. Using git checkout to restore App.tsx.');
        execSync(`git checkout -- ${appPath}`, { cwd: ROOT });
      }
      appRestoreNeeded = false;
    } catch (err) {
      console.error('[Shield Script] Error restoring App.tsx:', err.message);
    }
  }
  if (logProcess) {
    try {
      logProcess.kill();
      logProcess = null;
    } catch (err) {}
  }
};

// Handle exit signals
process.on('SIGINT', () => {
  console.log('\n[Shield Script] Interrupted by user.');
  restoreAppFile();
  if (metroProcess) {
    try { metroProcess.kill(); } catch (err) {}
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n[Shield Script] Terminated.');
  restoreAppFile();
  if (metroProcess) {
    try { metroProcess.kill(); } catch (err) {}
  }
  process.exit(1);
});

process.on('exit', () => {
  restoreAppFile();
  if (metroProcess) {
    try { metroProcess.kill(); } catch (err) {}
  }
});

const verifyPlatform = async (platformKey) => {
  const isIos = platformKey.startsWith('ios');
  const linkageType = platformKey.includes('static') ? 'static' : (platformKey.includes('dynamic') ? 'dynamic' : null);
  const platformName = isIos ? 'ios' : 'android';
  
  console.log(`\n======================================================`);
  console.log(`🚀 Starting verification for platform: ${platformName.toUpperCase()}${linkageType ? ` (${linkageType.toUpperCase()})` : ''}`);
  console.log(`======================================================\n`);

  // Environment Setup
  const customEnv = { ...process.env };
  if (isIos) {
    customEnv.RCT_NEW_ARCH_ENABLED = '1';
    customEnv.RCT_IGNORE_PODS_DEPRECATION = '1';
    if (linkageType) {
      customEnv.USE_FRAMEWORKS = linkageType;
    }
  }

  const target = isIos ? ensureIosSimulator() : ensureAndroidEmulator();

  // A. Temporarily update credentials in App.tsx
  if (fs.existsSync(appPath)) {
    let shouldCreateBackup = true;
    if (fs.existsSync(appBackupPath)) {
      const existingBackup = fs.readFileSync(appBackupPath, 'utf8');
      if (existingBackup.includes('SHIELD_SITE_ID')) {
        shouldCreateBackup = false;
      }
    }

    if (shouldCreateBackup) {
      fs.copyFileSync(appPath, appBackupPath);
      console.log('[Shield Script] ✓ Created backup of App.tsx');
    } else {
      console.log('[Shield Script] ✓ Reusing existing clean backup of App.tsx');
    }
    appRestoreNeeded = true;

    let appContent = fs.readFileSync(appPath, 'utf8');
    appContent = appContent.replace(/['"]SHIELD_SITE_ID['"]/g, `'${testSiteId}'`);
    appContent = appContent.replace(/['"]SHIELD_SECRET_KEY['"]/g, `'${testSecretKey}'`);
    fs.writeFileSync(appPath, appContent);
    console.log('[Shield Script] ✓ Temporarily injected test credentials into App.tsx');
  } else {
    throw new Error(`example/src/App.tsx not found.`);
  }

  // B. Run pod install if iOS
  if (platformName === 'ios') {
    console.log('[Shield Script] Running react-native codegen for iOS...');
    try {
      execSync('npx react-native codegen --platform ios --outputPath ios', {
        cwd: path.join(ROOT, 'example'),
        stdio: 'inherit',
        env: customEnv
      });
    } catch (codegenErr) {
      console.warn('[Shield Script] Warning: react-native codegen failed:', codegenErr.message);
    }

    console.log(`[Shield Script] Running pod install in example/ios directory with USE_FRAMEWORKS=${linkageType}...`);
    try {
      execSync('bundle exec pod install', {
        cwd: path.join(ROOT, 'example', 'ios'),
        stdio: 'inherit',
        env: customEnv
      });
      console.log('[Shield Script] ✓ pod install completed successfully.');
    } catch (err) {
      restoreAppFile();
      throw new Error(`pod install failed: ${err.message}`);
    }
  }

  // C. Start native syslog / logcat observer
  let nativeLogProcess = null;
  if (platformName === 'ios') {
    console.log('[Shield Script] Starting iOS simulator syslog observer...');
    nativeLogProcess = spawn('xcrun', ['simctl', 'spawn', 'booted', 'log', 'stream', '--level', 'info'], {
      shell: true
    });
  } else if (platformName === 'android') {
    console.log('[Shield Script] Starting Android logcat observer...');
    try { execSync('adb logcat -c'); } catch (e) {}
    nativeLogProcess = spawn('adb', ['logcat'], {
      shell: true
    });
  }

  return new Promise((resolve, reject) => {
    let deviceIntelligenceDetected = false;
    let runProcess = null;
    let logBuffer = '';

    const onLogData = (data, source) => {
      const logStr = data.toString();
      
      // Print Metro logs to console so user can see bundle logs, but filter noisy syslog to only show Shield-related logs
      if (source === 'metro') {
        process.stdout.write(logStr);
      } else if (source === 'native') {
        if (logStr.toLowerCase().includes('shield') || logStr.toLowerCase().includes('session')) {
          process.stdout.write(`[Device Logs] ${logStr}`);
        }
      }
      
      logBuffer += logStr;

      // Keep last 20KB to avoid memory growth
      if (logBuffer.length > 20000) {
        logBuffer = logBuffer.substring(logBuffer.length - 20000);
      }

      if (logStr.includes('[Shield] onSuccess:') || logStr.includes('[Shield] sessionId:') || logStr.toLowerCase().includes('session_id') || logStr.toLowerCase().includes('session id')) {
        if (!deviceIntelligenceDetected) {
          // Check if we can find the session ID (32 hex characters)
          let sessionId = 'Unknown';
          const match = logBuffer.match(/(?:\[Shield\] sessionId|sessionId|session id).*?['"]?([a-f0-9]{32})['"]?/i);
          if (match) {
            sessionId = match[1];
            deviceIntelligenceDetected = true;
            console.log('\n======================================================');
            console.log(`🎉 SUCCESS: Shield Device Intelligence Detected for ${platformName.toUpperCase()}${linkageType ? ` (${linkageType.toUpperCase()})` : ''}!`);
            console.log(`🔑 Session ID: ${sessionId}`);
            console.log('======================================================\n');
            cleanupVerification();
            resolve(sessionId);
          }
        }
      }
    };

    const cleanupVerification = () => {
      if (metroProcess && metroProcess.stdout) {
        metroProcess.stdout.removeListener('data', (d) => onLogData(d, 'metro'));
      }
      if (nativeLogProcess) {
        try { nativeLogProcess.kill(); } catch (e) {}
      }
      restoreAppFile();
      if (runProcess) {
        try { runProcess.kill(); } catch (e) {}
      }
    };

    if (metroProcess && metroProcess.stdout) {
      metroProcess.stdout.on('data', (d) => onLogData(d, 'metro'));
    }
    if (nativeLogProcess && nativeLogProcess.stdout) {
      nativeLogProcess.stdout.on('data', (d) => onLogData(d, 'native'));
    }

    // D. Uninstall existing app from device/simulator for clean environment
    console.log(`[Shield Script] Cleaning up previous installations of the app...`);
    if (platformName === 'ios') {
      try {
        execSync('xcrun simctl uninstall booted org.reactjs.native.example.ShieldFraudPluginExample', { stdio: 'ignore' });
        console.log('[Shield Script] ✓ Uninstalled existing iOS app.');
      } catch (e) {
        // ignore if not installed
      }
    } else if (platformName === 'android') {
      try {
        execSync('adb uninstall com.shieldfraudpluginexample', { stdio: 'ignore' });
        console.log('[Shield Script] ✓ Uninstalled existing Android app.');
      } catch (e) {
        // ignore if not installed
      }
    }

    // E. Run the React Native application
    console.log(`[Shield Script] Building and launching sample app on ${platformName}...`);
    const runArgs = createRunArgs(platformName, target.udid);

    runProcess = spawn('npx', runArgs, {
      cwd: path.join(ROOT, 'example'),
      shell: true,
      stdio: 'inherit',
      env: customEnv
    });

    runProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[Shield Script] Build/run command failed with exit code ${code}`);
        cleanupVerification();
        reject(new Error(`Build/run failed for platform ${platformKey}`));
      } else {
        console.log(`[Shield Script] App built and launched. Watching logs for ${platformKey}...`);
      }
    });
  });
};

const main = async () => {
  testSiteId = process.env.SHIELD_SITE_ID;
  testSecretKey = process.env.SHIELD_SECRET_KEY;
  if (!testSiteId || !testSecretKey) {
    throw new Error(
      'SHIELD_SITE_ID and SHIELD_SECRET_KEY must be defined in your environment or in a .env file.'
    );
  }

  // Clear any existing shield-output.json first
  if (fs.existsSync(outputPath)) {
    try {
      fs.unlinkSync(outputPath);
      console.log('[Shield Script] ✓ Cleared existing shield-output.json');
    } catch (err) {
      console.warn('[Shield Script] Warning: failed to clear shield-output.json:', err.message);
    }
  }

  // 1. Read config
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing config file: ${err.message}`);
    process.exit(1);
  }

  const { androidVersion, iosVersion, platform } = config;
  
  const shouldUpdateAndroid = !!androidVersion;
  const shouldUpdateIos = !!iosVersion;

  if (!shouldUpdateAndroid && !shouldUpdateIos) {
    console.error('Error: Configuration must specify at least androidVersion or iosVersion.');
    process.exit(1);
  }

  // 2. Perform updates as necessary
  if (shouldUpdateAndroid) {
    if (fs.existsSync(gradlePath)) {
      let gradleContent = fs.readFileSync(gradlePath, 'utf8');
      gradleContent = gradleContent.replace(
        /com\.shield\.android:shield:\d+\.\d+\.\d+/g,
        `com.shield.android:shield:${androidVersion}`
      );
      gradleContent = gradleContent.replace(
        /com\.shield\.android:shield-fraud:\d+\.\d+\.\d+/g,
        `com.shield.android:shield-fraud:${androidVersion}`
      );
      fs.writeFileSync(gradlePath, gradleContent);
      console.log(`[Shield Script] ✓ Updated android/build.gradle to version ${androidVersion}`);
    } else {
      console.warn('[Shield Script] Warning: android/build.gradle not found.');
    }
  } else {
    console.log('[Shield Script] Skipping Android dependency version update.');
  }

  if (shouldUpdateIos) {
    const podspecFiles = [
      'react-native-shield-fraud-plugin.podspec',
      'react-native-shield-full-plugin.podspec'
    ];
    podspecFiles.forEach(specName => {
      const specPath = path.join(ROOT, specName);
      if (fs.existsSync(specPath)) {
        let specContent = fs.readFileSync(specPath, 'utf8');
        specContent = specContent.replace(
          /(s\.dependency\s+["']ShieldFraud["'],\s+["'])\d+\.\d+\.\d+(["'])/g,
          `$1${iosVersion}$2`
        );
        fs.writeFileSync(specPath, specContent);
        console.log(`[Shield Script] ✓ Updated ${specName} to version ${iosVersion}`);
      } else {
        console.warn(`[Shield Script] Warning: ${specName} not found.`);
      }
    });
  } else {
    console.log('[Shield Script] Skipping iOS dependency version update.');
  }

  // Ensure node modules are fully installed using frozen lockfile as requested
  console.log('[Shield Script] Running yarn install --frozen-lockfile...');
  try {
    execSync('yarn --cwd example install --frozen-lockfile', { stdio: 'inherit' });
    console.log('[Shield Script] ✓ yarn install complete.');
  } catch (err) {
    console.error('[Shield Script] Error running yarn install:', err.message);
    process.exit(1);
  }

  // 3. Determine platforms to execute
  let platformsToRun = [];
  if (platform) {
    const platLower = platform.toLowerCase();
    if (platLower === 'both' || platLower === 'all') {
      platformsToRun = ['android', 'ios-static', 'ios-dynamic'];
    } else if (platLower === 'ios') {
      platformsToRun = ['ios-static', 'ios-dynamic'];
    } else if (platLower === 'ios-static') {
      platformsToRun = ['ios-static'];
    } else if (platLower === 'ios-dynamic') {
      platformsToRun = ['ios-dynamic'];
    } else {
      platformsToRun = [platLower];
    }
  } else {
    // Default: run whatever platform has an updated version
    if (shouldUpdateAndroid) platformsToRun.push('android');
    if (shouldUpdateIos) {
      platformsToRun.push('ios-static');
      platformsToRun.push('ios-dynamic');
    }
  }

  // Ensure we have something to run
  if (platformsToRun.length === 0) {
    console.log('[Shield Script] No target platforms to run/verify.');
    process.exit(0);
  }

  // 4. Reuse a running Metro Bundler or start one owned by this script.
  if (await isMetroRunning()) {
    console.log('[Shield Script] ✓ Metro Bundler is already running on port 8081. Reusing it.');
  } else {
    console.log('[Shield Script] Starting Metro Bundler in background...');
    metroProcess = spawn('npx', ['react-native', 'start', '--reset-cache'], {
      cwd: path.join(ROOT, 'example'),
      shell: true,
      stdio: 'pipe'
    });

    metroProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    console.log('[Shield Script] Waiting 5 seconds for Metro Bundler to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 5. Verify target platforms sequentially
  const verificationResults = {};
  for (const plat of platformsToRun) {
    try {
      const sessionId = await verifyPlatform(plat);
      verificationResults[plat] = sessionId;
    } catch (err) {
      console.error(`[Shield Script] Verification failed for platform ${plat.toUpperCase()}:`, err.message);
      if (metroProcess) {
        try { metroProcess.kill(); } catch (e) {}
      }
      process.exit(1);
    }
  }

  // Write output results file
  try {
    fs.writeFileSync(outputPath, JSON.stringify(verificationResults, null, 2));
    console.log(`[Shield Script] ✓ Verification results saved to ${outputPath}`);
  } catch (outErr) {
    console.error(`[Shield Script] Failed to write shield-output.json:`, outErr.message);
  }

  // 6. Stage changes in Git on overall success
  console.log('[Shield Script] All target platforms verified successfully! Staging updates in git...');
  try {
    if (shouldUpdateAndroid) {
      execSync('git add android/build.gradle', { cwd: ROOT });
    }
    if (shouldUpdateIos) {
      execSync('git add react-native-shield-fraud-plugin.podspec', { cwd: ROOT });
      execSync('git add react-native-shield-full-plugin.podspec', { cwd: ROOT });
      if (fs.existsSync(path.join(ROOT, 'example', 'ios', 'Podfile.lock'))) {
        execSync('git add example/ios/Podfile.lock', { cwd: ROOT });
      }
    }
    // Stage config and helper fixes
    execSync('git add shield-config.json', { cwd: ROOT });
    if (fs.existsSync(path.join(ROOT, 'example', 'ios', 'ShieldFraudPluginExample', 'Info.plist'))) {
      execSync('git add example/ios/ShieldFraudPluginExample/Info.plist', { cwd: ROOT });
    }
    if (fs.existsSync(path.join(ROOT, 'example', 'ios', 'ShieldFraudPluginExample', 'AppDelegate.mm'))) {
      execSync('git add example/ios/ShieldFraudPluginExample/AppDelegate.mm', { cwd: ROOT });
    }
    execSync('git add scripts/update-and-run.js', { cwd: ROOT });
    console.log('[Shield Script] ✓ Git staging complete. Changes are ready to be committed.');
  } catch (gitErr) {
    console.error('[Shield Script] Git staging failed:', gitErr.message);
  }

  // Open the output file for the user
  try {
    const openCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
    execSync(`${openCmd} "${outputPath}"`);
    console.log('[Shield Script] ✓ Opened shield-output.json for viewing.');
  } catch (err) {
    // Ignore opening failures if no GUI is present
  }

  // Stop Metro
  if (metroProcess) {
    try { metroProcess.kill(); } catch (e) {}
  }

  console.log('[Shield Script] Finished successfully.');
  process.exit(0);
};

if (require.main === module) {
  main().catch(err => {
    console.error('[Shield Script] Unexpected error:', err.message);
    restoreAppFile();
    if (metroProcess) {
      try { metroProcess.kill(); } catch (e) {}
    }
    process.exit(1);
  });
}

module.exports = {
  configPath,
  createRunArgs,
  ensureAndroidEmulator,
  ensureIosSimulator,
  isMetroRunning,
  normalizeCommandOutput,
};
