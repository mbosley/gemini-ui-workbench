import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'tmp', 'integration-capture.png');

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`fixture server timeout\nstdout=${stdout}\nstderr=${stderr}`)), 15000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const line = stdout.trim().split('\n').at(-1) || '';
      try {
        const parsed = JSON.parse(line);
        if (parsed.ok) {
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch {}
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`fixture server exited early (${code})\nstdout=${stdout}\nstderr=${stderr}`));
    });
  });
}

test('capture script works end to end against fixture auth app', async (t) => {
  const child = spawn('node', ['scripts/fixture-auth-app.mjs', '--port', '0'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fixture = await waitForServer(child);
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  });

  await fs.rm(OUT_PATH, { force: true });
  await execFileAsync('node', [
    'scripts/capture-authenticated-route.mjs',
    '--baseUrl', `http://127.0.0.1:${fixture.port}`,
    '--route', '/dashboard',
    '--output', OUT_PATH,
    '--bootstrapUrl', '/api/bootstrap-user',
    '--bootstrapBody', 'examples/synthetic-pack/bootstrap-user.json',
    '--email', 'integration@local.test',
    '--password', 'integration-secret',
    '--name', 'Integration User',
    '--postLoginUrl', '/courses',
    '--waitForSelector', '#welcome',
  ], {
    cwd: ROOT,
    env: { ...process.env, adminToken: 'fixture-token' },
  });

  const stat = await fs.stat(OUT_PATH);
  assert.ok(stat.size > 0);
});
