/**
 * Unit test runner.
 *
 * Compiles the app and the tests to CommonJS, then runs them on Node's built-in
 * test runner. This keeps the test stack at zero dependencies while the tests
 * still import the real modules through the `@/` alias.
 *
 * Usage: npm test
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, '.test-build');

function run(command, args, useShell = true) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: useShell });
  return result.status ?? 1;
}

function collectTests(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectTests(full, found);
    else if (full.endsWith('.test.js')) found.push(full);
  }
  return found;
}

rmSync(buildDir, { recursive: true, force: true });

console.log('Compiling tests...');
if (run('npx', ['tsc', '-p', 'tsconfig.test.json']) !== 0) {
  console.error('\nCompilation failed.');
  process.exit(1);
}

const tests = collectTests(path.join(buildDir, 'tests'));
if (tests.length === 0) {
  console.error('No compiled test files found.');
  process.exit(1);
}

console.log(`Running ${tests.length} test file(s)...\n`);
// The preload path must be absolute: Node resolves `--require` against its own
// internal preload module, not the working directory. `shell: false` keeps
// paths containing spaces intact.
const register = path.join(root, 'scripts', 'test-register.cjs');
process.exit(run(process.execPath, ['--require', register, '--test', ...tests], false));
