#!/usr/bin/env node
// scripts/release.mjs — Custom release runner
// Usage:
//   pnpm release                       Auto bump (major/minor/patch) from commits
//   pnpm release --first-release       Use current package.json version, generate CHANGELOG
//   pnpm release --version 1.2.3       Force specific version
//   Add --dry-run to any of the above  Preview without writing

import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`\x1b[36m[release]\x1b[0m ${msg}\n`);
}

function error(msg) {
  process.stderr.write(`\x1b[31m[release] ERROR:\x1b[0m ${msg}\n`);
  process.exit(1);
}

function readPkg() {
  return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v);
}

/**
 * Call release-it with the given extra CLI args.
 * Always inherits stdio so the interactive output is visible.
 */
function releaseIt(extraArgs) {
  const args = ['release-it', ...extraArgs];
  log(`Running: npx ${args.join(' ')}`);
  execFileSync('npx', args, { stdio: 'inherit', cwd: root });
}

/**
 * Use conventional-recommended-bump to determine the bump type
 * based on commits since the last tag.
 * Returns 'major' | 'minor' | 'patch'.
 */
async function detectBumpType() {
  // Dynamic import because it's an ESM-only package
  const { Bumper } = await import('conventional-recommended-bump');
  const bumper = new Bumper(root).loadPreset('conventionalcommits');
  const recommendation = await bumper.bump();
  const types = ['major', 'minor', 'patch'];
  return types[recommendation.releaseType] ?? 'patch';
}

// ── arg parsing ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

const isFirstRelease = argv.includes('--first-release');
const isDryRun = argv.includes('--dry-run');
const versionFlagIdx = argv.indexOf('--version');
const specifiedVersion = versionFlagIdx !== -1 ? argv[versionFlagIdx + 1] : null;

// Mutual exclusion
if (isFirstRelease && specifiedVersion != null) {
  error('--first-release and --version cannot be used together.');
}

if (specifiedVersion != null && !isValidSemver(specifiedVersion)) {
  error(`Invalid version "${specifiedVersion}". Expected format: MAJOR.MINOR.PATCH (e.g. 1.2.3)`);
}

// ── main ─────────────────────────────────────────────────────────────────────

// release-it requires --ci to suppress interactive prompts.
// --git.requireUpstream=false: allow release without a remote upstream.
// During dry-run also skip clean-working-dir check so previews work from any state.
const commonArgs = ['--git.requireUpstream=false', '--ci'];
if (isDryRun) {
  commonArgs.push('--dry-run');
  commonArgs.push('--git.requireCleanWorkingDir=false');
}

if (isFirstRelease) {
  // Use the version already in package.json; pass it as --increment so release-it
  // treats it as an exact target version (semver string, not a bump type).
  const { version } = readPkg();
  log(`First release — using package.json version: ${version}`);
  releaseIt([`--increment=${version}`, ...commonArgs]);
} else if (specifiedVersion != null) {
  log(`Specified version: ${specifiedVersion}`);
  releaseIt([`--increment=${specifiedVersion}`, ...commonArgs]);
} else {
  log('Auto-detecting bump type from conventional commits…');
  const bumpType = await detectBumpType();
  log(`Detected bump type: ${bumpType}`);
  releaseIt([`--increment=${bumpType}`, ...commonArgs]);
}
