#!/usr/bin/env node
/**
 * Switch which plugin variant the example app builds against.
 *
 *   node scripts/use-plugin.js fraud   (default)
 *   node scripts/use-plugin.js full
 *
 * Only package.json is swapped. Everything else (native class names,
 * Android Java package, iOS class) stays the same — the build.gradle and
 * podspec already detect the variant from the package name at build time.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const variant = process.argv[2];

if (variant !== 'fraud' && variant !== 'full') {
  console.error('Usage: node scripts/use-plugin.js <fraud|full>');
  process.exit(1);
}

const src = variant === 'full'
  ? path.join(ROOT, 'package.full.json')
  : path.join(ROOT, 'package.fraud.json');

// On first run for fraud→full, back up the original package.json as package.fraud.json
const pkgPath = path.join(ROOT, 'package.json');
const fraudBackup = path.join(ROOT, 'package.fraud.json');

if (!fs.existsSync(fraudBackup)) {
  // First time: save the current (fraud) package.json as the fraud backup
  fs.copyFileSync(pkgPath, fraudBackup);
  console.log('✓ Created package.fraud.json backup');
}

fs.copyFileSync(src, pkgPath);
console.log(`✓ package.json → ${variant} (react-native-shield-${variant}-plugin)`);
console.log(`\nRun: cd example && yarn android`);
