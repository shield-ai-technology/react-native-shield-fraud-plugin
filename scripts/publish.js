#!/usr/bin/env node
/**
 * Publish both npm packages from this repo.
 *
 *   node scripts/publish.js          — publish fraud then full
 *   node scripts/publish.js fraud    — publish fraud only
 *   node scripts/publish.js full     — publish full only
 *
 * Each publish:
 *   1. Swaps the correct package.json into place
 *   2. Runs `npm publish` (prepack → bob build runs automatically)
 *   3. Restores the original package.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkgPath = path.join(ROOT, 'package.json');
const fraudPkgPath = path.join(ROOT, 'package.fraud.json');
const fullPkgPath = path.join(ROOT, 'package.full.json');

const originalPkg = fs.readFileSync(pkgPath);

function publish(variant) {
  const srcPath = variant === 'full' ? fullPkgPath : fraudPkgPath;
  const name = variant === 'full'
    ? 'react-native-shield-full-plugin'
    : 'react-native-shield-fraud-plugin';

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing ${path.basename(srcPath)} — run "yarn use-${variant}" once first to generate it.`);
  }

  console.log(`\n── Publishing ${name} ──`);
  fs.copyFileSync(srcPath, pkgPath);
  execSync('npm publish', { stdio: 'inherit', cwd: ROOT });
  console.log(`✓ Published ${name}`);
}

const variant = process.argv[2];
const variants = variant ? [variant] : ['fraud', 'full'];

if (variant && variant !== 'fraud' && variant !== 'full') {
  console.error('Usage: node scripts/publish.js [fraud|full]');
  process.exit(1);
}

try {
  for (const v of variants) {
    publish(v);
  }
  console.log('\n✓ Done');
} finally {
  fs.writeFileSync(pkgPath, originalPkg);
}
