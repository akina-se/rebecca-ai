const fs = require('fs');
const path = require('path');

const packages = [
  { name: '@rebecca/persona', path: 'packages/persona/coverage/coverage-summary.json', requiredGate: true },
  { name: '@rebecca/db', path: 'packages/db/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/bot-backend', path: 'apps/bot-backend/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/dashboard-backend', path: 'apps/dashboard-backend/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/functions', path: 'apps/functions/coverage/coverage-summary.json', requiredGate: true },
  { name: 'apps/dashboard-frontend', path: 'apps/dashboard-frontend/coverage/coverage-summary.json', requiredGate: false },
];

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
      console.error(`Error parsing ${pkg.path}:`, err);
      rows.push({
        name: pkg.name,
        stmts: 'N/A',
        branches: 'N/A',
        funcs: 'N/A',
        lines: 'N/A',
        status: '⚠️ ERROR',
      });
      allPassed = false;
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
    allPassed = false;
  }
}

let md = '### 🛡️ Jest Test Coverage Gate Summary (CI Monorepo)\n\n';
md += '| Package | Statements (C0) | Branches (C1) | Functions | Lines | Status |\n';
md += '| :--- | :---: | :---: | :---: | :---: | :---: |\n';

for (const r of rows) {
  md += `| **\`${r.name}\`** | ${r.stmts} | ${r.branches} | ${r.funcs} | ${r.lines} | ${r.status} |\n`;
}

md += '\n> **CI Coverage Gate**: Minimum **80.00%** required across all metrics (Statements, Branches, Functions, Lines).\n';

console.log(md);

// Write to GITHUB_STEP_SUMMARY if available
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

// Write to local coverage-summary.md for artifacts / comments
fs.writeFileSync(path.resolve(process.cwd(), 'coverage-summary.md'), md, 'utf8');

if (!allPassed) {
  console.error('\n❌ One or more packages failed to meet the >= 80% coverage threshold.');
  process.exit(1);
} else {
  console.log('\n✅ All packages successfully passed the >= 80% coverage gate!');
}
