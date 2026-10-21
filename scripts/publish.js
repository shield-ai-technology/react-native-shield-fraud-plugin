#!/usr/bin/env node
/**
 * Publish all npm packages from this repo.
 *
 *   node scripts/publish.js          — publish fraud, full, then alpha
 *   node scripts/publish.js fraud    — publish fraud only
 *   node scripts/publish.js full     — publish full only
 *   node scripts/publish.js alpha    — publish alpha only
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
const VARIANTS = ['fraud', 'full', 'alpha'];

const originalPkg = fs.readFileSync(pkgPath);

function publish(variant) {
  const srcPath = path.join(ROOT, `package.${variant}.json`);
  const name = `react-native-shield-${variant}-plugin`;

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing ${path.basename(srcPath)} — run "yarn use-${variant}" once first to generate it.`);
  }

  console.log(`\n── Publishing ${name} ──`);
  fs.copyFileSync(srcPath, pkgPath);
  execSync('npm publish', { stdio: 'inherit', cwd: ROOT });
  console.log(`✓ Published ${name}`);
}

const variant = process.argv[2];
const variants = variant ? [variant] : VARIANTS;

if (variant && !VARIANTS.includes(variant)) {
  console.error(`Usage: node scripts/publish.js [${VARIANTS.join('|')}]`);
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
