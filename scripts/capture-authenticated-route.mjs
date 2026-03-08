#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { parseEnvFile, repoRoot } from './lib/workbench.mjs';

const ROOT = repoRoot();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function loadDotEnv(file = '.env') {
  const envPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const env = parseEnvFile(envPath);
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readMaybeFile(value) {
  if (!value) return '';
  const full = path.isAbsolute(value) ? value : path.join(ROOT, value);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    return fs.readFileSync(full, 'utf8');
  }
  return value;
}

function applyTemplate(raw, vars) {
  let output = String(raw ?? '');
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value == null ? '' : String(value));
  }
  return output;
}

function parseJsonInput(value, label, vars) {
  if (!value) return undefined;
  const raw = applyTemplate(readMaybeFile(value), vars);
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label} JSON: ${message}`);
  }
}

function buildPlan(args) {
  const baseUrl = args.baseUrl || 'http://127.0.0.1:3000';
  const route = args.route || '';
  const output = args.output || '';
  const email = args.email || `capture+${Date.now()}@local.test`;
  const password = args.password || 'capture_password_12345';
  const adminToken = args.adminToken || process.env.ADMIN_TOKEN || process.env.adminToken || '';
  const vars = {
    baseUrl,
    route,
    output,
    email,
    password,
    name: args.name || 'Capture User',
    adminToken,
  };
  return {
    baseUrl,
    route,
    output,
    email,
    password,
    adminToken,
    loginPath: args.loginPath || '/login',
    loginFormSelector: args.loginFormSelector || '',
    emailLabel: args.emailLabel || 'Email',
    passwordLabel: args.passwordLabel || 'Password',
    submitLabel: args.submitLabel || 'Sign in',
    postLoginUrl: args.postLoginUrl || '/courses',
    device: args.device || 'Desktop Chrome',
    clickRoleButton: args.clickRoleButton || '',
    clickSelector: args.clickSelector || '',
    hoverSelector: args.hoverSelector || '',
    tapSelector: args.tapSelector || '',
    waitForSelector: args.waitForSelector || '',
    postLoadDelayMs: Number(args.postLoadDelayMs || 0),
    storageState: args.storageState || '',
    bootstrapUrl: args.bootstrapUrl || '',
    bootstrapMethod: (args.bootstrapMethod || 'POST').toUpperCase(),
    bootstrapHeaders: parseJsonInput(args.bootstrapHeaders, 'bootstrap headers', vars),
    bootstrapBody: parseJsonInput(args.bootstrapBody, 'bootstrap body', vars),
    seedScript: args.seedScript || '',
    seedArgs: args.seedArgs || '',
    envFile: args.envFile || '.env',
    dryRun: args.dryRun === 'true' || args.plan === 'true',
  };
}

async function runBootstrap(plan) {
  if (!plan.bootstrapUrl) return;
  const response = await fetch(new URL(plan.bootstrapUrl, plan.baseUrl), {
    method: plan.bootstrapMethod,
    headers: { 'content-type': 'application/json', ...(plan.bootstrapHeaders || {}) },
    body: plan.bootstrapBody ? JSON.stringify(plan.bootstrapBody) : undefined,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`bootstrap request failed (${response.status}): ${text}`);
  }
}

function runSeedScript(plan) {
  if (!plan.seedScript) return;
  const extraArgs = plan.seedArgs
    ? plan.seedArgs.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const result = spawnSync(process.execPath, [
    plan.seedScript,
    '--baseUrl', plan.baseUrl,
    '--route', plan.route,
    '--email', plan.email,
    '--password', plan.password,
    ...extraArgs,
  ], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`seed script failed (${result.status}): ${result.stderr || result.stdout}`);
  }
}

async function signIn(page, plan) {
  await page.goto(`${plan.baseUrl}${plan.loginPath}`, { waitUntil: 'networkidle', timeout: 120_000 });
  const form = plan.loginFormSelector
    ? page.locator(plan.loginFormSelector)
    : page.locator('form').filter({ has: page.getByRole('button', { name: new RegExp(plan.submitLabel, 'i') }) });
  await form.getByLabel(new RegExp(plan.emailLabel, 'i')).fill(plan.email);
  await form.getByLabel(new RegExp(plan.passwordLabel, 'i')).fill(plan.password);
  await Promise.all([
    page.waitForURL(new RegExp(plan.postLoginUrl), { timeout: 120_000 }),
    form.getByRole('button', { name: new RegExp(plan.submitLabel, 'i') }).click(),
  ]);
}

async function capture(plan) {
  const { chromium, devices } = await import('@playwright/test');
  const device = devices[plan.device] || {};
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    baseURL: plan.baseUrl,
    ...(plan.storageState ? { storageState: path.isAbsolute(plan.storageState) ? plan.storageState : path.join(ROOT, plan.storageState) } : {}),
  });
  const page = await context.newPage();
  try {
    if (!plan.storageState) {
      await signIn(page, plan);
    }
    await page.goto(`${plan.baseUrl}${plan.route}`, { waitUntil: 'networkidle', timeout: 120_000 });
    if (plan.clickRoleButton) await page.getByRole('button', { name: new RegExp(plan.clickRoleButton, 'i') }).click();
    if (plan.clickSelector) {
      const target = page.locator(plan.clickSelector).first();
      const box = await target.boundingBox();
      if (!box) throw new Error(`could not resolve bounding box for selector: ${plan.clickSelector}`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    if (plan.hoverSelector) await page.locator(plan.hoverSelector).first().hover();
    if (plan.tapSelector) await page.locator(plan.tapSelector).first().tap();
    if (plan.waitForSelector) await page.waitForSelector(plan.waitForSelector, { timeout: 120_000 });
    if (plan.postLoadDelayMs > 0) await page.waitForTimeout(plan.postLoadDelayMs);
    await fs.promises.mkdir(path.dirname(path.isAbsolute(plan.output) ? plan.output : path.join(ROOT, plan.output)), { recursive: true });
    await page.screenshot({ path: path.isAbsolute(plan.output) ? plan.output : path.join(ROOT, plan.output), fullPage: true });
    console.log(plan.output);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnv(args.envFile || '.env');
  const plan = buildPlan(args);
  if (!plan.route) throw new Error('--route is required');
  if (!plan.output) throw new Error('--output is required');
  if (plan.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  await runBootstrap(plan);
  runSeedScript(plan);
  await capture(plan);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
