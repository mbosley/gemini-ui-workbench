#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  buildContractSummary,
  compactTextFromGeminiResponse,
  ensureArray,
  formatCodeBlock,
  getLastModelText,
  inferMime,
  loadThread,
  parseCsv,
  parseEnvFile,
  repoRoot,
  saveThread,
  toContents,
  writeSummaryIfRequested,
} from './lib/workbench.mjs';

const ROOT = repoRoot();
const MODEL_DEFAULT = process.env.GOOGLE_GEMINI_MODEL || 'gemini-3.1-pro-preview';
const MODEL_ALIASES = {
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini-3-pro': 'gemini-3.1-pro-preview',
  'gemini-3pro': 'gemini-3.1-pro-preview',
};
const HISTORY_MODES = new Set(['compact', 'full', 'none']);
const GEMINI_ENDPOINT_TEMPLATE = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}';
const DEFAULT_SESSION = `ui-review-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, '')}`;

function printUsage() {
  console.log(`
Usage:
  node scripts/gemini-ui-review.mjs --session <name> --memo <markdown-file> [--images <img1,img2,...>] [--code <file1,file2,...>] [--append-message <text>] [--model gemini-3.1-pro-preview]
  node scripts/gemini-ui-review.mjs --session <name> --inspect-last [--required-files <f1,f2,...>] [--summary-out <path>]

Options:
  --session          Session name (default: ${DEFAULT_SESSION})
  --memo             Initial memo file
  --append-message   Additional user message to append
  --images           Comma-separated images to attach
  --code             Comma-separated code files to include
  --model            Gemini model id
  --history-mode     full | compact | none (default: compact)
  --history-turns    Include only the last N turns from history
  --quiet            Print compact JSON summary only
  --inspect-last     Parse last saved model turn from disk without calling Gemini
  --required-files   Comma-separated required file paths for contract checks
  --summary-out      Write summary JSON to path
  --fail-on-contract Exit 2 when contract checks fail
  --env-file         Alternate env file (default: .env)
  --model-list       Print common model ids
  --help             Show this message
`);
}

function parseArgs(argv) {
  const args = { session: DEFAULT_SESSION, model: MODEL_DEFAULT, historyMode: 'compact', envFile: '.env' };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--help') return { help: true };
    if (current === '--model-list') return { modelList: true };
    if (current === '--session') { args.session = argv[i + 1]; i += 1; continue; }
    if (current === '--memo') { args.memo = argv[i + 1]; i += 1; continue; }
    if (current === '--append-message') { args.appendMessage = argv[i + 1]; i += 1; continue; }
    if (current === '--images') { args.images = parseCsv(argv[i + 1]); i += 1; continue; }
    if (current === '--code') { args.code = parseCsv(argv[i + 1]); i += 1; continue; }
    if (current === '--model') { args.model = argv[i + 1]; i += 1; continue; }
    if (current === '--history-mode') { args.historyMode = argv[i + 1]; i += 1; continue; }
    if (current === '--history-turns') { args.historyTurns = Number(argv[i + 1]); i += 1; continue; }
    if (current === '--quiet') { args.quiet = true; continue; }
    if (current === '--inspect-last') { args.inspectLast = true; continue; }
    if (current === '--required-files') { args.requiredFiles = parseCsv(argv[i + 1]); i += 1; continue; }
    if (current === '--summary-out') { args.summaryOut = argv[i + 1]; i += 1; continue; }
    if (current === '--fail-on-contract') { args.failOnContract = true; continue; }
    if (current === '--env-file') { args.envFile = argv[i + 1]; i += 1; continue; }
  }
  return args;
}

function selectHistoryTurns(allTurns, args) {
  if ((args.historyMode || 'compact') === 'none') return [];
  if (Number.isInteger(args.historyTurns) && args.historyTurns > 0) return allTurns.slice(-args.historyTurns);
  return allTurns;
}

async function readTextOrFail(filePath, label) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed reading ${label} file: ${filePath}. ${message}`);
  }
}

async function callGemini({ model, apiKey, history, turn, historyMode }) {
  const endpoint = GEMINI_ENDPOINT_TEMPLATE.replace('{model}', model).replace('{apiKey}', apiKey);
  const contents = toContents(history, turn, { historyMode });
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.3, topP: 0.95, topK: 40 } }),
  });
  if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
  return response.json();
}

async function runInspectOnly(args) {
  const thread = await loadThread(ROOT, args.session);
  const lastModel = getLastModelText(thread);
  if (!lastModel) throw new Error(`No model turn found in session ${args.session}.`);
  const summary = buildContractSummary(ROOT, args.session, lastModel, args.requiredFiles);
  await writeSummaryIfRequested(ROOT, summary, args.summaryOut);
  console.log(JSON.stringify(summary, null, 2));
  if (args.failOnContract && !summary.contract.pass) process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();
  if (args.modelList) {
    console.log(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-3.1-pro-preview'].join('\n'));
    return;
  }
  if (!HISTORY_MODES.has(args.historyMode || 'compact')) {
    throw new Error(`Invalid --history-mode "${args.historyMode}". Use compact, full, or none.`);
  }
  if (args.inspectLast) return runInspectOnly(args);

  const envPath = path.isAbsolute(args.envFile) ? args.envFile : path.join(ROOT, args.envFile);
  const env = parseEnvFile(envPath);
  const apiKey = process.env.GOOGLE_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error(`GOOGLE_API_KEY is not available in env or ${envPath}`);
  if (!args.memo && !args.appendMessage) throw new Error('Provide --memo to start a thread or --append-message to continue.');

  const thread = await loadThread(ROOT, args.session);
  const codeFiles = [];
  for (const codePath of ensureArray(args.code)) {
    const full = path.isAbsolute(codePath) ? codePath : path.join(ROOT, codePath);
    const content = await readTextOrFail(full, 'code');
    codeFiles.push({ path: codePath, content: formatCodeBlock(codePath, content) });
  }
  const images = [];
  for (const imagePath of ensureArray(args.images)) {
    const full = path.isAbsolute(imagePath) ? imagePath : path.join(ROOT, imagePath);
    const buffer = await fs.readFile(full);
    images.push({ path: imagePath, mimeType: inferMime(full), data: buffer.toString('base64') });
  }

  const baseText = args.memo ? await readTextOrFail(path.isAbsolute(args.memo) ? args.memo : path.join(ROOT, args.memo), 'memo') : '';
  const turnText = [baseText, args.appendMessage || ''].filter(Boolean).join('\n\n---\n\n');
  const turn = { role: 'user', text: turnText, codeFiles, images, when: new Date().toISOString() };
  const payload = await callGemini({ model: MODEL_ALIASES[args.model] || args.model || MODEL_DEFAULT, apiKey, history: selectHistoryTurns(thread.turns, args), turn, historyMode: args.historyMode });
  const answer = compactTextFromGeminiResponse(payload);

  thread.turns.push({ role: 'user', text: turn.text, codeFiles, images });
  thread.turns.push({ role: 'model', text: answer });
  await saveThread(ROOT, args.session, thread);

  const summary = buildContractSummary(ROOT, args.session, answer, args.requiredFiles);
  await writeSummaryIfRequested(ROOT, summary, args.summaryOut);
  if (args.quiet) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('\n=== Gemini Response ===\n');
    console.log(answer);
    console.log('\n=== End Response ===\n');
  }
  if (args.failOnContract && !summary.contract.pass) process.exit(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
