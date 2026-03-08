#!/usr/bin/env node
import fssync from 'node:fs';
import process from 'node:process';
import {
  applyFiles,
  extractApiEndpoints,
  extractPackFromModelText,
  findMissingApiRoutes,
  findMissingDeps,
  getLastModelText,
  loadInstalledDeps,
  loadThread,
  normalizeRelPath,
  parseCsv,
  pathPrefixAllowed,
  repoRoot,
  writeSummaryIfRequested,
} from './lib/workbench.mjs';

const ROOT = repoRoot();

function printUsage() {
  console.log(`
Usage:
  node scripts/gemini-pack-apply.mjs --session <name> [--required-files <f1,f2,...>] [--allow-prefix <p1,p2,...>] [--allow-overwrite] [--apply] [--summary-out <path>] [--fail-on-violation]
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--help') return { help: true };
    if (current === '--session') { args.session = argv[i + 1]; i += 1; continue; }
    if (current === '--required-files') { args.requiredFiles = parseCsv(argv[i + 1]); i += 1; continue; }
    if (current === '--allow-prefix') { args.allowPrefixes = parseCsv(argv[i + 1]); i += 1; continue; }
    if (current === '--allow-overwrite') { args.allowOverwrite = true; continue; }
    if (current === '--apply') { args.apply = true; continue; }
    if (current === '--summary-out') { args.summaryOut = argv[i + 1]; i += 1; continue; }
    if (current === '--fail-on-violation') { args.failOnViolation = true; continue; }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();
  if (!args.session) throw new Error('Missing --session <name>.');

  const thread = await loadThread(ROOT, args.session);
  const modelText = getLastModelText(thread);
  if (!modelText) throw new Error(`No model output found in session: ${args.session}`);

  const pack = extractPackFromModelText(modelText);
  const requiredFiles = args.requiredFiles?.length ? args.requiredFiles : pack.fileMap;
  const invalidPaths = [];
  const packFiles = {};
  for (const [filePath, content] of Object.entries(pack.files || {})) {
    const normalized = normalizeRelPath(filePath);
    if (!normalized) {
      invalidPaths.push(filePath);
      continue;
    }
    packFiles[normalized] = content;
  }

  const missingRequiredFiles = requiredFiles.filter((filePath) => typeof packFiles[filePath] !== 'string' || !packFiles[filePath].trim());
  const installedDeps = await loadInstalledDeps(ROOT);
  const missingDeps = findMissingDeps(packFiles, installedDeps);
  const apiEndpoints = extractApiEndpoints(packFiles);
  const missingApiRoutes = findMissingApiRoutes(ROOT, apiEndpoints);
  const allowPrefixes = args.allowPrefixes ?? [];
  const pathViolations = [];
  const overwriteViolations = [];
  for (const filePath of Object.keys(packFiles)) {
    if (!pathPrefixAllowed(filePath, allowPrefixes)) pathViolations.push({ rule: 'path_not_allowed', filePath, allowPrefixes });
    if (!args.allowOverwrite && fssync.existsSync(`${ROOT}/${filePath}`)) overwriteViolations.push({ rule: 'overwrite_not_allowed', filePath });
  }

  const pass = !missingRequiredFiles.length && !invalidPaths.length && !missingDeps.length && !missingApiRoutes.length && !pathViolations.length && !overwriteViolations.length;
  const summary = {
    session: args.session,
    packKind: pack.kind,
    applyRequested: Boolean(args.apply),
    requiredFiles,
    packFileMap: pack.fileMap,
    packApplyOrder: pack.applyOrder,
    packFilesPresent: Object.keys(packFiles),
    gates: {
      pass,
      missingRequiredFiles,
      invalidPaths,
      missingDeps,
      referencedApiEndpoints: apiEndpoints,
      missingApiRoutes,
      allowPrefixes,
      pathViolations,
      allowOverwrite: Boolean(args.allowOverwrite),
      overwriteViolations,
    },
  };

  await writeSummaryIfRequested(ROOT, summary, args.summaryOut);
  console.log(JSON.stringify(summary, null, 2));
  if (!pass) {
    if (args.failOnViolation) process.exit(2);
    return;
  }
  if (args.apply) await applyFiles(ROOT, packFiles, pack.applyOrder);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
