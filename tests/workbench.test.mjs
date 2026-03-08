import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { buildContractSummary, extractPackFromModelText } from '../scripts/lib/workbench.mjs';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const modelText = "```json\n{\n  \"fileMap\": [\"src/components/Hero.tsx\"],\n  \"files\": {\n    \"src/components/Hero.tsx\": \"export function Hero() {\\n  return <section>Generic hero</section>;\\n}\\n\"\n  }\n}\n```";

test('contract summary passes for valid json file pack', () => {
  const summary = buildContractSummary(ROOT, 'synthetic-demo', modelText, ['src/components/Hero.tsx']);
  assert.equal(summary.contract.pass, true);
  assert.deepEqual(summary.missingRequiredFiles, []);
});

test('pack extraction returns expected file map', () => {
  const pack = extractPackFromModelText(modelText);
  assert.equal(pack.kind, 'json_files');
  assert.ok(pack.files['src/components/Hero.tsx']);
});

test('gate cli passes against synthetic session', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/gemini-pack-apply.mjs',
    '--session',
    'synthetic-demo',
    '--required-files',
    'src/components/Hero.tsx',
    '--allow-prefix',
    'src/components/',
  ], { cwd: ROOT });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.gates.pass, true);
});

test('inspect cli passes against synthetic session', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/gemini-ui-review.mjs',
    '--session',
    'synthetic-demo',
    '--inspect-last',
    '--required-files',
    'src/components/Hero.tsx',
  ], { cwd: ROOT });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.contract.pass, true);
});

test('capture dry-run emits resolved plan', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/capture-authenticated-route.mjs',
    '--route', '/demo',
    '--output', 'tmp/demo.png',
    '--baseUrl', 'http://127.0.0.1:3000',
    '--bootstrapBody', 'examples/synthetic-pack/bootstrap-user.json',
    '--dryRun',
  ], { cwd: ROOT, env: { ...process.env, adminToken: 'token-123' } });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.route, '/demo');
  assert.equal(parsed.output, 'tmp/demo.png');
  assert.equal(parsed.bootstrapBody.token, 'token-123');
  assert.equal(parsed.bootstrapBody.user.password, parsed.password);
});
