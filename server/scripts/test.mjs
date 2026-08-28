/**
 * Backend unit tests: compile to CommonJS, then run Node's built-in runner.
 * Mirrors the mobile setup so both suites work the same way, with no test
 * framework dependency.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, '.test-build');

function run(command, args, useShell = true) {
  return spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: useShell }).status ?? 1;
}

function collect(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    else if (full.endsWith('.test.js')) found.push(full);
  }
  return found;
}

rmSync(buildDir, { recursive: true, force: true });

console.log('Compiling backend tests...');
if (run('npx', ['tsc', '-p', 'tsconfig.test.json']) !== 0) {
  console.error('\nCompilation failed.');
  process.exit(1);
}

const tests = collect(path.join(buildDir, 'tests'));
if (tests.length === 0) {
  console.error('No compiled test files found.');
  process.exit(1);
}

console.log(`Running ${tests.length} test file(s)...\n`);
process.exit(run(process.execPath, ['--test', ...tests], false));
