/**
 * @file ci-coverage-summary.js
 * @description Monorepo Code Coverage Aggregator and Quality Gate Verifier.
 *
 * Architecture Role:
 *   In this multi-package TypeScript/Angular monorepo, unit and integration tests
 *   produce isolated coverage reports across separate workspaces (packages/persona,
 *   packages/db, apps/bot-backend, apps/dashboard-backend, apps/functions, apps/dashboard-frontend).
 *   This script aggregates individual Istanbul `coverage-summary.json` files, evaluates each
 *   against strict quality thresholds (>= 80% for statements, branches, functions, and lines),
 *   formats a GitHub-flavored Markdown table, and publishes it to `$GITHUB_STEP_SUMMARY` and
 *   a local `coverage-summary.md` artifact.
 *
 * Usage:
 *   node scripts/ci-coverage-summary.js
 *
 * Exit Codes:
 *   0 - All mandatory packages passed the coverage threshold (>= 80.0%).
 *   1 - One or more mandatory packages failed or coverage files are missing.
 */

const fs = require('fs');
const path = require('path');

/**
 * Packages participating in the monorepo test coverage audit.
 * `requiredGate`: true enforces >= 80% threshold causing non-zero exit on failure.
 */
const packages = [
  { name: '@rebecca/persona', path: 'packages/persona/coverage/coverage-summary.json', requiredGate: true },
  { name: '@rebecca/db', path: 'packages/db/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/bot-backend', path: 'apps/bot-backend/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/dashboard-backend', path: 'apps/dashboard-backend/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/functions', path: 'apps/functions/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/dashboard-frontend', path: 'apps/dashboard-frontend/coverage/coverage-summary.json', requiredGate: true },
];

/** Quality Gate Threshold (Minimum percentage required for C0/C1 metrics) */
const THRESHOLD = 80.0;

let rows = [];
let allPassed = true;

for (const pkg of packages) {
  const fullPath = path.resolve(process.cwd(), pkg.path);
  if (fs.existsSync(fullPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const total = data.total || {};
      const stmts = parseFloat(total.statements?.pct || 0);
      const branches = parseFloat(total.branches?.pct || 0);
      const funcs = parseFloat(total.functions?.pct || 0);
      const lines = parseFloat(total.lines?.pct || 0);

      const passed = stmts >= THRESHOLD && branches >= THRESHOLD && funcs >= THRESHOLD && lines >= THRESHOLD;
      if (pkg.requiredGate && !passed) {
        allPassed = false;
      }

      rows.push({
        name: pkg.name,
        stmts: `${stmts.toFixed(2)}%`,
        branches: `${branches.toFixed(2)}%`,
        funcs: `${funcs.toFixed(2)}%`,
        lines: `${lines.toFixed(2)}%`,
        status: passed ? '✅ PASS' : (pkg.requiredGate ? '❌ FAIL' : 'ℹ️ REPORTED'),
      });
    } catch (err) {
      console.error(`[Coverage Error] Failed to parse ${pkg.path}:`, err);
      rows.push({
        name: pkg.name,
        stmts: 'N/A',
        branches: 'N/A',
        funcs: 'N/A',
        lines: 'N/A',
        status: '⚠️ ERROR',
      });
      if (pkg.requiredGate) allPassed = false;
    }
  } else {
    rows.push({
      name: pkg.name,
      stmts: 'N/A',
      branches: 'N/A',
      funcs: 'N/A',
      lines: 'N/A',
      status: '⚠️ MISSING',
    });
    if (pkg.requiredGate) allPassed = false;
  }
}

let md = '### 🛡️ Jest & Karma Monorepo Coverage Gate Summary\n\n';
md += '| Package | Statements (C0) | Branches (C1) | Functions | Lines | Status |\n';
md += '| :--- | :---: | :---: | :---: | :---: | :---: |\n';

for (const r of rows) {
  md += `| **\`${r.name}\`** | ${r.stmts} | ${r.branches} | ${r.funcs} | ${r.lines} | ${r.status} |\n`;
}

md += '\n> **CI Quality Gate**: Minimum **80.00%** required across all mandatory backend/core metrics (Statements, Branches, Functions, Lines).\n';

console.log(md);

// Write to GitHub Actions Job Summary if running in CI environment
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

// Write to local coverage-summary.md for build artifact archiving and PR bot posting
fs.writeFileSync(path.resolve(process.cwd(), 'coverage-summary.md'), md, 'utf8');

if (!allPassed) {
  console.error('\n❌ One or more mandatory packages failed to meet the >= 80% coverage threshold.');
  process.exit(1);
} else {
  console.log('\n✅ All mandatory packages successfully passed the >= 80% coverage gate!');
}
