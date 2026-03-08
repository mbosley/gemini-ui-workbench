import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

export function parseCsv(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function repoRoot() {
  return process.cwd();
}

export function sessionDir(root = repoRoot()) {
  return path.join(root, '.gemini-sessions');
}

export function getThreadPath(root, session) {
  return path.join(sessionDir(root), `${session}.json`);
}

export async function loadThread(root, session) {
  const threadPath = getThreadPath(root, session);
  if (!fssync.existsSync(threadPath)) {
    return { session, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), turns: [] };
  }
  return JSON.parse(await fs.readFile(threadPath, 'utf8'));
}

export async function saveThread(root, session, thread) {
  const dir = sessionDir(root);
  await fs.mkdir(dir, { recursive: true });
  thread.updatedAt = new Date().toISOString();
  await fs.writeFile(getThreadPath(root, session), `${JSON.stringify(thread, null, 2)}\n`, 'utf8');
}

export function getLastModelText(thread) {
  for (let i = thread.turns.length - 1; i >= 0; i -= 1) {
    const turn = thread.turns[i];
    if (turn?.role === 'model' && typeof turn.text === 'string' && turn.text.trim()) {
      return turn.text;
    }
  }
  return null;
}

export function parseEnvFile(envPath) {
  const out = {};
  if (!fssync.existsSync(envPath)) return out;
  const raw = fssync.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function inferMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

export function formatCodeBlock(filePath, contents) {
  const ext = path.extname(filePath).toLowerCase();
  const lang = ext === '.tsx' || ext === '.ts' ? 'ts' : ext.replace('.', '');
  return `\n\n### ${filePath}\n\`\`\`${lang}\n${contents}\n\`\`\`\n`;
}

export function buildTurnParts(turn, options = {}) {
  const includeCodeContent = Boolean(options.includeCodeContent);
  const includeImageData = Boolean(options.includeImageData);
  const parts = [];
  if (turn.text) parts.push({ text: turn.text });
  if (Array.isArray(turn.codeFiles)) {
    const refs = [];
    for (const codeFile of turn.codeFiles) {
      const pathLabel = typeof codeFile === 'string' ? codeFile : codeFile.path;
      const content = typeof codeFile === 'string' ? codeFile : codeFile.content;
      if (includeCodeContent && content) {
        parts.push({ text: `\nCode file included: ${pathLabel ?? 'code snippet'}\n\n${content}` });
      } else if (pathLabel) {
        refs.push(pathLabel);
      }
    }
    if (!includeCodeContent && refs.length) parts.push({ text: `Code file references: ${refs.join(', ')}` });
  }
  if (Array.isArray(turn.images)) {
    const refs = [];
    for (const image of turn.images) {
      if (includeImageData && typeof image.mimeType === 'string' && typeof image.data === 'string') {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      } else if (image.path) {
        refs.push(image.path);
      }
    }
    if (refs.length) parts.push({ text: `Image references: ${refs.join(', ')}` });
  }
  return parts;
}

export function toContents(history, currentTurn, options = {}) {
  const includeCurrent = options.includeCurrent !== false;
  const historyMode = options.historyMode || 'compact';
  const includeHistoryCode = historyMode === 'full';
  const includeHistoryImages = historyMode === 'full';
  const out = [];
  for (const turn of history) {
    out.push({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: buildTurnParts(turn, { includeCodeContent: includeHistoryCode, includeImageData: includeHistoryImages }),
    });
  }
  if (includeCurrent) {
    out.push({
      role: currentTurn.role === 'model' ? 'model' : 'user',
      parts: buildTurnParts(currentTurn, { includeCodeContent: true, includeImageData: true }),
    });
  }
  return out;
}

export function compactTextFromGeminiResponse(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  if (!parts.length) {
    const reason = candidate?.finishReason ? `finishReason=${candidate.finishReason}` : 'no parts';
    return `No textual response returned (${reason}).`;
  }
  return parts.map((part) => part.text ?? '').filter(Boolean).join('\n\n');
}

export function extractJsonObjectsFromMarkdown(text) {
  const objects = [];
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match = fenceRegex.exec(text);
  while (match) {
    const block = (match[1] || '').trim();
    try {
      const parsed = JSON.parse(block);
      if (parsed && typeof parsed === 'object') objects.push(parsed);
    } catch {}
    match = fenceRegex.exec(text);
  }
  return objects;
}

export function unique(values) {
  return [...new Set(values)];
}

export function extractFileMap(text) {
  const jsonObjects = extractJsonObjectsFromMarkdown(text);
  const paths = [];
  for (const obj of jsonObjects) {
    if (Array.isArray(obj.fileMap)) {
      for (const candidate of obj.fileMap) {
        if (typeof candidate === 'string' && candidate.trim()) paths.push(candidate.trim());
      }
    }
  }
  return unique(paths);
}

export function extractCodeBlockPaths(text) {
  const paths = [];
  const regex = /###\s+([^\n]+)\n```[^\n]*\n[\s\S]*?```/g;
  let match = regex.exec(text);
  while (match) {
    const candidate = (match[1] || '').trim();
    if (candidate) paths.push(candidate);
    match = regex.exec(text);
  }
  return unique(paths);
}

export function extractJsonFilesObjectPaths(text) {
  const jsonObjects = extractJsonObjectsFromMarkdown(text);
  const paths = [];
  for (const obj of jsonObjects) {
    if (!obj || typeof obj !== 'object' || !obj.files || typeof obj.files !== 'object') continue;
    for (const [filePath, content] of Object.entries(obj.files)) {
      if (typeof filePath === 'string' && filePath.trim() && typeof content === 'string' && content.trim()) {
        paths.push(filePath.trim());
      }
    }
  }
  return unique(paths);
}

export function buildContractSummary(root, session, answer, requiredFiles = []) {
  const fileMap = extractFileMap(answer);
  const codeBlockPaths = extractCodeBlockPaths(answer);
  const jsonFilePaths = extractJsonFilesObjectPaths(answer);
  const provided = new Set([...fileMap, ...codeBlockPaths, ...jsonFilePaths]);
  const required = ensureArray(requiredFiles);
  const missingRequiredFiles = required.filter((item) => !provided.has(item));
  const hasBlocked = /^\s*BLOCKED\b/im.test(answer);
  const issues = [];
  if (hasBlocked) issues.push('blocked_response');
  if (!fileMap.length) issues.push('missing_file_map');
  if (!codeBlockPaths.length && !jsonFilePaths.length) issues.push('missing_code_payload');
  if (required.length && missingRequiredFiles.length) issues.push('missing_required_files');
  return {
    session,
    sessionPath: getThreadPath(root, session),
    lastModelChars: answer.length,
    fileMap,
    codeBlockPaths,
    jsonFilePaths,
    requiredFiles: required,
    missingRequiredFiles,
    hasBlocked,
    contract: { pass: issues.length === 0, issues },
  };
}

export function extractMarkdownFileBlocks(text) {
  const files = {};
  const regex = /###\s+([^\n]+)\n```[^\n]*\n([\s\S]*?)\n```/g;
  let match = regex.exec(text);
  while (match) {
    const filePath = (match[1] || '').trim();
    const content = match[2] ?? '';
    if (filePath && content.trim()) files[filePath] = content;
    match = regex.exec(text);
  }
  return files;
}

export function extractPackFromModelText(modelText) {
  const objects = extractJsonObjectsFromMarkdown(modelText);
  const jsonPack = objects.find((obj) => obj && typeof obj === 'object' && obj.files && typeof obj.files === 'object');
  if (jsonPack) {
    const fileMap = Array.isArray(jsonPack.fileMap) ? jsonPack.fileMap.filter((x) => typeof x === 'string') : [];
    const files = {};
    for (const [k, v] of Object.entries(jsonPack.files)) {
      if (typeof k === 'string' && typeof v === 'string') files[k] = v;
    }
    const applyOrder = Array.isArray(jsonPack.applyOrder) ? jsonPack.applyOrder.filter((x) => typeof x === 'string') : [];
    return {
      kind: 'json_files',
      fileMap: fileMap.length ? fileMap : Object.keys(files),
      applyOrder,
      files,
      behaviorCompatibilityNotes: typeof jsonPack.behaviorCompatibilityNotes === 'string' ? jsonPack.behaviorCompatibilityNotes : '',
    };
  }
  const mdFiles = extractMarkdownFileBlocks(modelText);
  if (Object.keys(mdFiles).length) {
    return { kind: 'markdown_blocks', fileMap: Object.keys(mdFiles), applyOrder: [], files: mdFiles, behaviorCompatibilityNotes: '' };
  }
  throw new Error('Could not extract a pack from model output.');
}

export function isCodeFile(filePath) {
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(path.extname(filePath).toLowerCase());
}

export function basePackageName(specifier) {
  if (!specifier || typeof specifier !== 'string') return null;
  if (specifier.startsWith('node:')) return null;
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('@/') || specifier.startsWith('#')) return null;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

export function extractImportSpecifiers(code) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
    /\bexport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(code);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(code);
    }
  }
  return unique(specifiers);
}

export async function loadInstalledDeps(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fssync.existsSync(pkgPath)) return new Set();
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  return new Set(Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}), ...(pkg.optionalDependencies || {}) }));
}

export function findMissingDeps(filesByPath, installedDeps) {
  const missing = new Map();
  for (const [filePath, content] of Object.entries(filesByPath)) {
    if (!isCodeFile(filePath)) continue;
    for (const specifier of extractImportSpecifiers(content)) {
      const base = basePackageName(specifier);
      if (!base || installedDeps.has(base)) continue;
      if (!missing.has(base)) missing.set(base, new Set());
      missing.get(base).add(filePath);
    }
  }
  return [...missing.entries()].map(([dep, files]) => ({ dep, files: [...files] }));
}

export function extractApiEndpoints(filesByPath) {
  const endpoints = new Set();
  const regex = /\/api\/[a-zA-Z0-9/_-]+/g;
  for (const [filePath, content] of Object.entries(filesByPath)) {
    if (!isCodeFile(filePath)) continue;
    const matches = content.match(regex) || [];
    for (const match of matches) endpoints.add(match.split(/[?#]/)[0].replace(/\/+$/, ''));
  }
  return [...endpoints];
}

export function apiEndpointExists(root, endpoint) {
  if (!endpoint.startsWith('/api/')) return true;
  const rest = endpoint.replace(/^\/api\//, '');
  const candidates = [
    path.join(root, 'src', 'app', 'api', rest, 'route.ts'),
    path.join(root, 'src', 'app', 'api', rest, 'route.js'),
    path.join(root, 'src', 'pages', 'api', `${rest}.ts`),
    path.join(root, 'src', 'pages', 'api', `${rest}.js`),
    path.join(root, 'pages', 'api', `${rest}.ts`),
    path.join(root, 'pages', 'api', `${rest}.js`),
  ];
  return candidates.some((candidate) => fssync.existsSync(candidate));
}

export function findMissingApiRoutes(root, endpoints) {
  return endpoints.filter((endpoint) => !apiEndpointExists(root, endpoint));
}

export function normalizeRelPath(candidatePath) {
  if (typeof candidatePath !== 'string' || !candidatePath.trim() || path.isAbsolute(candidatePath)) return null;
  const normalized = path.posix.normalize(candidatePath.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
}

export function pathPrefixAllowed(filePath, allowPrefixes) {
  if (!Array.isArray(allowPrefixes) || allowPrefixes.length === 0) return true;
  return allowPrefixes.some((prefix) => filePath.startsWith(prefix));
}

export async function writeSummaryIfRequested(root, summary, summaryOut) {
  if (!summaryOut) return;
  const fullPath = path.isAbsolute(summaryOut) ? summaryOut : path.join(root, summaryOut);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

export async function applyFiles(root, filesByPath, applyOrder = []) {
  const ordered = applyOrder.length ? applyOrder : Object.keys(filesByPath);
  for (const filePath of ordered) {
    const content = filesByPath[filePath];
    if (typeof content !== 'string') continue;
    const fullPath = path.join(root, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }
}
